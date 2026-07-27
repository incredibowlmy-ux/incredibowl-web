import { NextResponse } from 'next/server';
import { getDishPrice } from '@/data/promoConfig';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { weeklyMenu, dishVoucherValue } from '@/data/weeklyMenu';
import { validateVoucher } from '@/lib/voucherValidation';
import { calcPerDeliveryFees, type DeliveryZone } from '@/lib/deliveryUtils';
import { isOrderDateValid, isDishOrderableOn } from '@/lib/cartDateUtils';
import { sendCapiEvent, extractRequestContext } from '@/lib/meta-capi';
import { claimMealVouchers, countAvailableVouchers } from '@/lib/mealVoucherUtils';
import { claimAddonCredits, releaseAddonCredits, getAvailableAddonCredits } from '@/lib/addonCreditUtils';
import { planAddonCreditDeduction } from '@/lib/addonCreditMath';

import { generateTrackToken } from '@/lib/trackingUtils';

// Lazy-init Firebase Admin (same pattern as other API routes)
let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

/**
 * POST /api/submit-order
 *
 * Receives a cart bundle array + metadata from the client,
 * re-calculates prices server-side, validates against menu data,
 * and writes the order(s) to Firestore.
 */
export async function POST(req: Request) {
  try {
    // ── AuthN: the caller IS the customer ─────────────────────
    // The order's userId comes from the verified token, NEVER from the body —
    // a body userId let anyone place orders (and burn meal vouchers) as any
    // victim uid. Checkout UI requires login, so a token is always available.
    const { verifyBearerUser } = await import('@/lib/adminApi');
    const auth = await verifyBearerUser(req);
    if (!auth) {
      return NextResponse.json({ error: '请先登录再下单' }, { status: 401 });
    }

    const body = await req.json();
    const {
      userName, userEmail, userPhone, userAddress,
      cartBundles, // Array of { dishId, dishQty, addOns: [{ id, quantity }], price, quantity, selectedDate, selectedTime, note }
      paymentMethod, receiptUploaded, receiptUrl,
      promoCode, promoDiscount: clientPromoDiscount,
      clientDeliveryFee,
      orderNote,
      mealVouchersUsed: rawMealVouchersUsed,
      clientMealVoucherDiscount,
      clientAddonCreditDiscount,
    } = body;
    const userId = auth.uid; // authoritative — body userId ignored
    const mealVouchersUsed = Math.max(0, Math.floor(Number(rawMealVouchersUsed) || 0));

    // ── Basic validation ──────────────────────────────────────
    if (!userPhone || !userAddress) {
      return NextResponse.json({ error: '缺少用户信息' }, { status: 400 });
    }
    if (!cartBundles || !Array.isArray(cartBundles) || cartBundles.length === 0) {
      return NextResponse.json({ error: '购物车为空' }, { status: 400 });
    }
    if (!paymentMethod || !['qr', 'fpx', 'voucher'].includes(paymentMethod)) {
      return NextResponse.json({ error: '无效支付方式' }, { status: 400 });
    }

    // ── Date validation: every bundle's selectedDate must still be valid ──
    // Catches the stale-cart bug: customer added items yesterday with a
    // date that's now in the past, came back today and clicked pay.
    for (const bundle of cartBundles) {
      const check = isOrderDateValid(bundle.selectedDate);
      if (!check.ok) {
        return NextResponse.json({
          error: `购物车里有过期菜品（${check.message}）。请关闭购物车重新加入今日菜单。`,
        }, { status: 400 });
      }
    }

    // ── Build menu lookup ─────────────────────────────────────
    const menuById = new Map(weeklyMenu.map(d => [d.id, d]));

    // ── Re-calculate each bundle price server-side ────────────
    let serverCartTotal = 0;
    const validatedBundles: any[] = [];

    for (const bundle of cartBundles) {
      const dish = menuById.get(bundle.dishId);
      if (!dish) {
        return NextResponse.json({ error: `菜品不存在: ID ${bundle.dishId}` }, { status: 400 });
      }

      // 菜品 × 日期 校验（暂别 / 未上架 / 当日停售 / 周几不对）。
      // 共用 isDishOrderableOn —— CartDrawer 的购物车清理跑的是同一个函数，
      // 所以「灰显的卡片」和「服务端拒收」永远一致。直接调 API 绕过菜单卡
      // 的，或者拿上周的旧购物车来结账的，都在这里被挡住。
      const dishCheck = isDishOrderableOn(dish, String(bundle.selectedDate || ''));
      if (!dishCheck.ok) {
        return NextResponse.json({ error: dishCheck.message }, { status: 400 });
      }

      const serverDishPrice = getDishPrice(dish.price);
      let serverAddOnsTotal = 0;

      const validatedAddOns: any[] = [];
      if (bundle.addOns && Array.isArray(bundle.addOns)) {
        for (const addOn of bundle.addOns) {
          const serverPrice = ADD_ON_PRICES[addOn.id];
          if (serverPrice === undefined) {
            return NextResponse.json({ error: `加购项不存在: ${addOn.id}` }, { status: 400 });
          }
          serverAddOnsTotal += serverPrice * (addOn.quantity || 0);
          validatedAddOns.push({ ...addOn, price: serverPrice });
        }
      }

      const serverBundlePrice = (serverDishPrice * (bundle.dishQty || 1)) + serverAddOnsTotal;
      const serverBundleTotal = serverBundlePrice * (bundle.quantity || 1);
      serverCartTotal += serverBundleTotal;

      // Allow RM 0.02 rounding tolerance per bundle
      const clientBundleTotal = (bundle.price || 0) * (bundle.quantity || 1);
      if (Math.abs(serverBundleTotal - clientBundleTotal) > 0.02) {
        // 绝大多数情况不是攻击，是「购物车放了几天、期间菜单调过价」：
        // CartBundle 存 localStorage，dish 和 price 都是加入那天的快照。
        // 客户端 cartStore 的 merge 会在页面加载时按现价刷新（cartRepricing.ts），
        // 所以还能走到这里的只剩「标签页一直开着没刷新过」——文案要能指路，
        // 不能再甩「价格验证失败」这种开发者黑话给客户。
        return NextResponse.json({
          error: `${dish.name} 的价格已更新（现价 RM${serverBundleTotal.toFixed(2)}，购物车里是 RM${clientBundleTotal.toFixed(2)}）。请刷新页面后重新下单，购物车会自动同步最新价格。`,
        }, { status: 400 });
      }

      validatedBundles.push({
        ...bundle,
        dish,
        serverDishPrice,
        addOns: validatedAddOns,
        serverBundlePrice,
        serverBundleTotal,
      });
    }

    // ── Validate voucher (if provided) ────────────────────────
    let serverPromoDiscount = 0;
    const db = await getDb();

    // Mutex: meal vouchers and promo codes cannot stack on one order.
    if (mealVouchersUsed > 0 && promoCode && clientPromoDiscount > 0) {
      return NextResponse.json({ error: '餐券与优惠码不可同时使用，请取消其一' }, { status: 400 });
    }

    if (promoCode && clientPromoDiscount > 0) {
      const result = await validateVoucher(db, promoCode, { userId });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      serverPromoDiscount = result.discount;

      // Verify client discount matches server
      if (Math.abs(serverPromoDiscount - clientPromoDiscount) > 0.02) {
        return NextResponse.json({ error: '优惠金额不一致' }, { status: 400 });
      }
    }

    // ── Validate meal voucher redemption ──────────────────────
    let serverMealVoucherDiscount = 0;
    if (mealVouchersUsed > 0) {
      // Count main dish servings across cart, by VOUCHER VALUE (unit price minus
      // any per-dish top-up — e.g. premium salmon: voucher covers RM 19.90, the
      // remaining RM 4 stays payable). Mirrors CartDrawer's client-side math.
      const mainDishVoucherValues: number[] = [];
      for (const vb of validatedBundles) {
        const units = (vb.dishQty || 1) * (vb.quantity || 1);
        const value = dishVoucherValue(vb.serverDishPrice, vb.dish);
        for (let k = 0; k < units; k++) mainDishVoucherValues.push(value);
      }
      if (mealVouchersUsed > mainDishVoucherValues.length) {
        return NextResponse.json({ error: `餐券数量超过主餐数量（最多 ${mainDishVoucherValues.length} 张）` }, { status: 400 });
      }

      const available = await countAvailableVouchers(db, userId);
      if (mealVouchersUsed > available) {
        return NextResponse.json({ error: `账户餐券不足：需要 ${mealVouchersUsed} 张，可用 ${available} 张` }, { status: 400 });
      }

      // Discount = top X highest-value main dish servings (best-deal first)
      mainDishVoucherValues.sort((a, b) => b - a);
      serverMealVoucherDiscount = mainDishVoucherValues.slice(0, mealVouchersUsed).reduce((s, p) => s + p, 0);

      const clientMV = Number(clientMealVoucherDiscount) || 0;
      if (Math.abs(serverMealVoucherDiscount - clientMV) > 0.02) {
        return NextResponse.json({
          error: `餐券抵扣金额不一致，服务器: RM${serverMealVoucherDiscount.toFixed(2)}，客户端: RM${clientMV.toFixed(2)}`,
        }, { status: 400 });
      }
    }

    // ── Prepaid add-on credits: auto-apply (authoritative) ────
    // Same planAddonCreditDeduction the client runs (shared module — the two
    // sides literally execute the same code), fed with SERVER-read balances.
    // Credits stack with meal vouchers AND promo codes. groupKey matches the
    // delivery-group split key below so per-part discounts land exactly.
    const availByAddon = new Map(
      (await getAvailableAddonCredits(db, userId)).map(c => [c.addonId, c.remaining]),
    );
    const addonCreditPlan = planAddonCreditDeduction(
      validatedBundles.map(vb => ({
        groupKey: `${vb.selectedDate || '未定'}|${vb.selectedTime || 'Lunch'}`,
        voucherValue: dishVoucherValue(vb.serverDishPrice, vb.dish),
        topUpAddonId: vb.dish.topUpAddonId,
        topUpRM: vb.dish.voucherTopUp ?? 0,
        units: (vb.dishQty || 1) * (vb.quantity || 1),
        addOns: (vb.addOns || []).map((a: any) => ({
          id: a.id,
          totalQty: (a.quantity || 0) * (vb.quantity || 1),
        })),
      })),
      mealVouchersUsed,
      availByAddon,
    );
    const serverAddonCreditDiscount = addonCreditPlan.totalDiscount;

    const clientAC = Number(clientAddonCreditDiscount) || 0;
    if (Math.abs(serverAddonCreditDiscount - clientAC) > 0.02) {
      // Most common cause: balance consumed elsewhere (another device / the
      // subscription engine) between opening the cart and paying. Reopening
      // the cart refetches the balance and self-heals.
      return NextResponse.json({
        error: `预付加料抵扣金额不一致，服务器: RM${serverAddonCreditDiscount.toFixed(2)}，客户端: RM${clientAC.toFixed(2)}。请关闭购物车重新结账。`,
      }, { status: 400 });
    }

    // ── Validate delivery zone + fee server-side ──────────────
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const userZone = userData.deliveryZone as DeliveryZone | undefined;
    const userDistance = typeof userData.addressDistanceKm === 'number' ? userData.addressDistanceKm : null;

    if (userZone !== 'within2km' && userZone !== 'outside2km') {
      return NextResponse.json({ error: '请先在「个人资料」确认配送地址（验证配送范围）' }, { status: 400 });
    }

    // Anti-spoof: the saved address must match the address that was actually
    // geocoded. Catches the loophole where a customer verifies a within-2km
    // address (free delivery), then later edits to a far address via the
    // /member page or a direct write — bypassing the geocode flow.
    //
    // Legacy users (registered before the geocode flow) won't have
    // addressVerifiedText saved — we grandfather them in via the binary zone
    // field rather than forcing them to re-verify.
    const isLegacyUser = userDistance === null;
    if (!isLegacyUser) {
      const verifiedText = typeof userData.addressVerifiedText === 'string' ? userData.addressVerifiedText.trim() : '';
      const currentAddress = typeof userData.address === 'string' ? userData.address.trim() : '';
      if (!verifiedText || verifiedText !== currentAddress) {
        return NextResponse.json({
          error: '配送地址已修改但未重新验证。请到「个人资料 → 编辑资料」重新点「确认地址」。',
        }, { status: 400 });
      }
    }

    const subtotalAfterDiscount = Math.max(0, serverCartTotal - serverPromoDiscount - serverMealVoucherDiscount - serverAddonCreditDiscount);
    // Pricing-v2 grandfathering: existing customers (createdAt < 2026-05-16)
    // within 2 km keep their free delivery. Firebase Admin SDK serializes
    // Firestore Timestamp as { _seconds, _nanoseconds }.
    const createdAt = userData.createdAt as { _seconds?: number; seconds?: number } | undefined;
    const customerCreatedAtMs: number | null = typeof createdAt?._seconds === 'number'
      ? createdAt._seconds * 1000
      : typeof createdAt?.seconds === 'number'
        ? createdAt.seconds * 1000
        : null;

    // ── Group by date/time — each (date + lunch/dinner) group is ONE delivery
    //    (one kitchen trip) and is charged its own delivery fee. ───────────
    const grouped: Record<string, { date: string; time: string; bundles: any[]; subtotal: number }> = {};
    for (const vb of validatedBundles) {
      const key = `${vb.selectedDate || '未定'}|${vb.selectedTime || 'Lunch'}`;
      if (!grouped[key]) {
        grouped[key] = { date: vb.selectedDate || '未定', time: vb.selectedTime || 'Lunch', bundles: [], subtotal: 0 };
      }
      grouped[key].bundles.push(vb);
      grouped[key].subtotal += vb.serverBundleTotal;
    }
    const groups = Object.values(grouped);
    const isMultiPart = groups.length > 1;
    const groupId = isMultiPart ? `GRP-${Date.now().toString(36).toUpperCase()}` : undefined;

    // Per-delivery fee: each group's basis (subtotal − its proportional promo
    // share; meal voucher NOT subtracted) is judged against its own distance
    // threshold. Promo split here is byte-identical to the order-doc split in
    // the write loop below, and to CartDrawer's client-side call, so the
    // anti-tamper comparison further down passes.
    const perDelivery = calcPerDeliveryFees(
      groups.map(g => g.subtotal),
      serverCartTotal,
      serverPromoDiscount,
      userDistance,
      userZone,
      customerCreatedAtMs,
    );
    if (!perDelivery.resolvable) {
      return NextResponse.json({ error: '配送地址未确认，请到「个人资料」验证地址' }, { status: 400 });
    }
    const serverDeliveryFee = perDelivery.total;
    const serverDeliveryTier = perDelivery.tier;
    const partDeliveryFees = perDelivery.fees;

    // Compare against client (defense against tampering)
    const clientFeeNum = typeof clientDeliveryFee === 'number' ? clientDeliveryFee : 0;
    if (Math.abs(serverDeliveryFee - clientFeeNum) > 0.02) {
      return NextResponse.json({
        error: `运费计算不一致，服务器: RM${serverDeliveryFee.toFixed(2)}，客户端: RM${clientFeeNum.toFixed(2)}`,
      }, { status: 400 });
    }

    // Voucher-only payment must satisfy: vouchers used > 0 AND zero cash due.
    // Otherwise customer should pick QR/FPX for the cash portion (delivery fee
    // in mid/far zones, or add-ons that vouchers don't cover).
    if (paymentMethod === 'voucher') {
      if (mealVouchersUsed === 0) {
        return NextResponse.json({ error: '"餐券"支付需选择餐券抵扣' }, { status: 400 });
      }
      const cashDue = Math.max(0, serverCartTotal - serverPromoDiscount - serverMealVoucherDiscount - serverAddonCreditDiscount) + serverDeliveryFee;
      if (cashDue > 0.02) {
        return NextResponse.json({
          error: `还需付款 RM ${cashDue.toFixed(2)}，请选择 QR 或 FPX 支付方式`,
        }, { status: 400 });
      }
    }

    // ── Reserve limited-dish stock (e.g. petai) — atomic; reject if short ──
    // Dishes without a `dishStock` doc are unlimited. Reserved at submit;
    // released below if the voucher claim rolls the just-created orders back.
    const { consumeDishStock, releaseDishStock } = await import('@/lib/stockUtils');
    const stockItems = validatedBundles.map((vb: any) => ({
      dishId: vb.dish.id,
      qty: (vb.dishQty || 1) * (vb.quantity || 1),
      name: vb.dish.name,
    }));
    try {
      await consumeDishStock(db, stockItems);
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || '库存不足' }, { status: 400 });
    }

    // ── Create one order doc per delivery group (grouped above) ──────────
    let remainingPromo = serverPromoDiscount;
    let remainingMV = serverMealVoucherDiscount;
    const orderIds: string[] = [];
    const payloads: any[] = [];

    const { FieldValue } = await import('firebase-admin/firestore');

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      let currentPromo = 0;
      if (serverPromoDiscount > 0) {
        if (i === groups.length - 1) {
          currentPromo = Number(remainingPromo.toFixed(2));
        } else {
          currentPromo = Number(((group.subtotal / serverCartTotal) * serverPromoDiscount).toFixed(2));
          remainingPromo -= currentPromo;
        }
      }
      let currentMV = 0;
      if (serverMealVoucherDiscount > 0) {
        if (i === groups.length - 1) {
          currentMV = Number(remainingMV.toFixed(2));
        } else {
          currentMV = Number(((group.subtotal / serverCartTotal) * serverMealVoucherDiscount).toFixed(2));
          remainingMV -= currentMV;
        }
      }
      // Addon-credit discount is allocated per delivery group by the plan
      // itself (exact, no proportional split — the algorithm walks bundles).
      const currentAC = addonCreditPlan.perGroupDiscount[`${group.date}|${group.time}`] || 0;
      const finalTotal = Math.max(0, group.subtotal - currentPromo - currentMV - currentAC);

      // Build items array (same format as before)
      const items: any[] = [];
      for (const vb of group.bundles) {
        const dishLine: Record<string, any> = {
          name: vb.dish.name,
          nameEn: vb.dish.nameEn || '',
          price: vb.dish.price,
          quantity: (vb.dishQty || 1) * (vb.quantity || 1),
          image: vb.dish.image || '',
        };
        // Per-dish kitchen note from AddOnModal — admin reads items[].note
        // for the "📝 有备注" badge and inline yellow callout per dish line.
        const bundleNote = typeof vb.note === 'string' ? vb.note.trim() : '';
        if (bundleNote) dishLine.note = bundleNote;
        items.push(dishLine);
        if (vb.addOns) {
          for (const a of vb.addOns) {
            if (a.quantity > 0) {
              items.push({
                name: `↳ ${a.name || a.id}`,
                nameEn: a.nameEn || '',
                price: a.price,
                quantity: a.quantity * (vb.quantity || 1),
                image: a.image || '',
              });
            }
          }
        }
      }

      // Each delivery group carries its OWN fee (one fee per kitchen trip),
      // judged against this group's basis. Aligned to `groups` order.
      const partDeliveryFee = partDeliveryFees[i];

      const payload: Record<string, any> = {
        userId, userName, userEmail, userPhone, userAddress,
        trackToken: generateTrackToken(),
        items,
        total: finalTotal,
        originalTotal: group.subtotal,
        deliveryFee: partDeliveryFee,
        deliveryZone: userZone,
        deliveryTier: serverDeliveryTier,
        deliveryDate: group.date,
        deliveryTime: group.time,
        paymentMethod,
        receiptUploaded: receiptUploaded || false,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Only add optional fields if they have values (Firestore doesn't allow undefined)
      if (typeof userDistance === 'number') payload.deliveryDistanceKm = userDistance;
      if (receiptUrl) payload.receiptUrl = receiptUrl;
      if (promoCode) payload.promoCode = promoCode.trim().toUpperCase();
      if (currentPromo > 0) payload.promoDiscount = currentPromo;
      if (orderNote) payload.note = orderNote;
      if (isMultiPart) {
        payload.isMultiPart = true;
        payload.partIndex = i + 1;
        payload.totalParts = groups.length;
        payload.groupId = groupId;
      }
      // Meal voucher accounting (per-part RM discount only — voucherIds attach to part 1 only, populated below)
      if (currentMV > 0) payload.mealVoucherDiscount = currentMV;
      // Prepaid add-on credit accounting (per-part RM discount only — claim
      // lines + recognized revenue attach to part 1, populated below)
      if (currentAC > 0) payload.addonCreditDiscount = currentAC;

      const docRef = await db.collection('orders').add(payload);
      orderIds.push(docRef.id);
      payloads.push(payload);

      // Update user lastOrderAt
      await db.collection('users').doc(userId).update({
        lastOrderAt: FieldValue.serverTimestamp(),
      });
    }

    // ── Claim meal vouchers (FIFO) — attach IDs to part 1 ─────
    // Done AFTER order docs exist so claimed vouchers can reference orderId.
    // On any failure, delete the orders we just created to avoid orphans.
    //
    // mealVoucherAllocatedRevenue is the MFRS 15 contract-liability portion
    // recognized as revenue when these vouchers are redeemed: sum of
    // allocatedValueRM across the claimed vouchers (= amountPaid/voucherCount
    // for each source bundle). This lets the admin KPI compute true accrual
    // revenue = order.total + mealVoucherAllocatedRevenue, instead of the
    // face-value approximation that overstates revenue by the bulk discount.
    // Prepaid add-on credits claim FIRST (mirrors the subscription engine's
    // order), then meal vouchers — so the voucher catch can hand the credits
    // back before rolling the orders back.
    let addonClaimed = false;
    if (addonCreditPlan.lines.length > 0) {
      try {
        const addonClaim = await claimAddonCredits(db, userId, addonCreditPlan.lines, orderIds[0]);
        addonClaimed = true;
        await db.collection('orders').doc(orderIds[0]).update({
          addonCreditsUsed: addonClaim.lines.map(l => ({ addonId: l.addonId, count: l.count })),
          addonCreditsAllocatedRevenue: addonClaim.recognizedRevenueRM,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (err: any) {
        // Roll back the just-created orders + release the reserved dish stock
        for (const oid of orderIds) {
          try { await db.collection('orders').doc(oid).delete(); } catch {}
        }
        try { await releaseDishStock(db, stockItems); } catch {}
        return NextResponse.json({ error: err?.message || '预付加料抵扣失败，请重试' }, { status: 400 });
      }
    }

    if (mealVouchersUsed > 0) {
      try {
        const claimed = await claimMealVouchers(db, userId, mealVouchersUsed, orderIds[0]);
        await db.collection('orders').doc(orderIds[0]).update({
          mealVouchersUsed,
          claimedMealVoucherIds: claimed.ids,
          mealVoucherAllocatedRevenue: claimed.allocatedTotalRM,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (err: any) {
        // Give back the addon credits claimed above, then roll back the
        // just-created orders + release the reserved dish stock
        if (addonClaimed) {
          try { await releaseAddonCredits(db, userId, addonCreditPlan.lines, orderIds[0]); } catch {}
        }
        for (const oid of orderIds) {
          try { await db.collection('orders').doc(oid).delete(); } catch {}
        }
        try { await releaseDishStock(db, stockItems); } catch {}
        return NextResponse.json({ error: err?.message || '餐券抢占失败，请重试' }, { status: 400 });
      }
    }

    // Voucher consumption (usedCount + user.vouchersUsed) is intentionally
    // deferred to /api/confirm-order. Marking it here meant the voucher was
    // burnt the moment a customer hit pay — even when FPX failed and the
    // order ended up cancelled. Now we only validate at submit time;
    // confirmation atomically claims the voucher when the order transitions
    // to 'confirmed'.

    // ── Raw-ingredient inventory (advisory) ───────────────────
    // Decrement on-hand for what this order consumes, reusing the prep
    // aggregation. ADVISORY: best-effort + swallows its own errors, so a stock
    // hiccup can never fail a paid order. Drift is corrected by the daily 盘点.
    // (The per-dish sell-out limit was already reserved above via consumeDishStock.)
    try {
      const allItems = payloads.flatMap((p: any) => p.items || []);
      const { consumeIngredientStock } = await import('@/lib/ingredientStock');
      await consumeIngredientStock(db, allItems, { orderId: groupId || orderIds[0], source: '网页单' });
    } catch (err) {
      console.error('ingredient stock decrement skipped:', err);
    }

    const serverTotal = Math.max(0, serverCartTotal - serverPromoDiscount) + serverDeliveryFee;

    // ── Owner alert: new QR order ─────────────────────────────
    // QR orders sit at status:'pending' until the owner manually verifies the
    // DuitNow receipt in the dashboard — nothing else nudges them. Without this
    // ping a midnight QR order is invisible until morning (= missed, no prep).
    // FPX auto-confirms via the payment callback, so it isn't the gap.
    // Best-effort + AWAITED (Vercel freezes the instance post-response, which
    // would kill an un-awaited fetch); the helper swallows all its own errors.
    if (paymentMethod === 'qr') {
      const { notifyOwnerNewQrOrder } = await import('@/lib/ownerNotify');
      await notifyOwnerNewQrOrder(orderIds.map((id, i) => ({ id, data: payloads[i] })));
    }

    // ── Meta CAPI: InitiateCheckout ───────────────────────────
    // Fire ONCE per checkout action (regardless of multi-day split into
    // multiple orders — the customer clicked "Checkout" once with intent
    // to purchase the whole basket). event_id is used by browser fbq with
    // the same value to dedupe. Failures are swallowed so a CAPI outage
    // can't break checkout — we still return success to the client.
    const checkoutEventId = `ic_${groupId || orderIds[0]}`;
    const ctx = extractRequestContext(req);
    const allItemsForCapi = validatedBundles.flatMap(vb => ([{
      id: String(vb.dish.id),
      quantity: (vb.dishQty || 1) * (vb.quantity || 1),
      item_price: vb.serverDishPrice,
    }]));
    // AWAIT — fire-and-forget gets killed by Vercel serverless when the
    // function instance freezes post-response. Adds ~200ms, gains reliability.
    await sendCapiEvent({
      eventName: 'InitiateCheckout',
      eventId: checkoutEventId,
      eventSourceUrl: ctx.eventSourceUrl,
      userData: {
        email: userEmail || undefined,
        phone: userPhone,
        externalId: userId,
        fbp: ctx.fbp,
        fbc: ctx.fbc,
        clientIpAddress: ctx.clientIpAddress,
        clientUserAgent: ctx.clientUserAgent,
      },
      customData: {
        currency: 'MYR',
        value: serverTotal,
        numItems: validatedBundles.length,
        contentIds: validatedBundles.map(vb => String(vb.dish.id)),
        contents: allItemsForCapi,
        orderId: groupId || orderIds[0],
      },
    });

    return NextResponse.json({
      success: true,
      orderIds,
      // Aligned with orderIds — client builds /track/<token> links for the WA message
      trackInfo: payloads.map((p: any) => ({
        token: p.trackToken,
        date: p.deliveryDate,
        time: p.deliveryTime,
      })),
      groupId: groupId || null,
      isMultiPart,
      // serverTotal = food (after voucher) + delivery — what customer actually pays
      serverTotal,
      deliveryFee: serverDeliveryFee,
      // CAPI dedup key — front-end Pixel must use this same eventID
      // when calling fbq('track', 'InitiateCheckout', ..., { eventID })
      checkoutEventId,
    });

  } catch (err: any) {
    console.error('submit-order error:', err);
    return NextResponse.json({ error: err.message || '提交订单失败' }, { status: 500 });
  }
}
