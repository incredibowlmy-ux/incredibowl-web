import { NextResponse } from 'next/server';
import { getDishPrice } from '@/data/promoConfig';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { weeklyMenu } from '@/data/weeklyMenu';
import { validateVoucher } from '@/lib/voucherValidation';
import { resolveDeliveryFee, type DeliveryZone } from '@/lib/deliveryUtils';
import { isOrderDateValid } from '@/lib/cartDateUtils';
import { sendCapiEvent, extractRequestContext } from '@/lib/meta-capi';

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
    const body = await req.json();
    const {
      userId, userName, userEmail, userPhone, userAddress,
      cartBundles, // Array of { dishId, dishQty, addOns: [{ id, quantity }], price, quantity, selectedDate, selectedTime, note }
      paymentMethod, receiptUploaded, receiptUrl,
      promoCode, promoDiscount: clientPromoDiscount,
      clientDeliveryFee,
      orderNote,
    } = body;

    // ── Basic validation ──────────────────────────────────────
    if (!userId || !userPhone || !userAddress) {
      return NextResponse.json({ error: '缺少用户信息' }, { status: 400 });
    }
    if (!cartBundles || !Array.isArray(cartBundles) || cartBundles.length === 0) {
      return NextResponse.json({ error: '购物车为空' }, { status: 400 });
    }
    if (!paymentMethod || !['qr', 'fpx'].includes(paymentMethod)) {
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
        return NextResponse.json({
          error: `价格验证失败: ${dish.name} 服务器计算 RM${serverBundleTotal.toFixed(2)}, 客户端提交 RM${clientBundleTotal.toFixed(2)}`,
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

    const subtotalAfterDiscount = Math.max(0, serverCartTotal - serverPromoDiscount);
    const resolved = resolveDeliveryFee(userDistance, userZone, subtotalAfterDiscount);
    if (!resolved) {
      return NextResponse.json({ error: '配送地址未确认，请到「个人资料」验证地址' }, { status: 400 });
    }
    const serverDeliveryFee = resolved.fee;
    const serverDeliveryTier = resolved.tier;

    // Compare against client (defense against tampering)
    const clientFeeNum = typeof clientDeliveryFee === 'number' ? clientDeliveryFee : 0;
    if (Math.abs(serverDeliveryFee - clientFeeNum) > 0.02) {
      return NextResponse.json({
        error: `运费计算不一致，服务器: RM${serverDeliveryFee.toFixed(2)}，客户端: RM${clientFeeNum.toFixed(2)}`,
      }, { status: 400 });
    }

    // ── Group by date/time and create orders ──────────────────
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
    let remainingPromo = serverPromoDiscount;
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
      const finalTotal = Math.max(0, group.subtotal - currentPromo);

      // Build items array (same format as before)
      const items: any[] = [];
      for (const vb of group.bundles) {
        items.push({
          name: vb.dish.name,
          nameEn: vb.dish.nameEn || '',
          price: vb.dish.price,
          quantity: (vb.dishQty || 1) * (vb.quantity || 1),
          image: vb.dish.image || '',
        });
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

      // Delivery fee is charged ONCE per submission. Apply it to part 1 only
      // (or the single order if not multi-part). Other parts get fee 0.
      const partDeliveryFee = i === 0 ? serverDeliveryFee : 0;

      const payload: Record<string, any> = {
        userId, userName, userEmail, userPhone, userAddress,
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

      const docRef = await db.collection('orders').add(payload);
      orderIds.push(docRef.id);
      payloads.push(payload);

      // Update user lastOrderAt
      await db.collection('users').doc(userId).update({
        lastOrderAt: FieldValue.serverTimestamp(),
      });
    }

    // Voucher consumption (usedCount + user.vouchersUsed) is intentionally
    // deferred to /api/confirm-order. Marking it here meant the voucher was
    // burnt the moment a customer hit pay — even when FPX failed and the
    // order ended up cancelled. Now we only validate at submit time;
    // confirmation atomically claims the voucher when the order transitions
    // to 'confirmed'.

    const serverTotal = Math.max(0, serverCartTotal - serverPromoDiscount) + serverDeliveryFee;

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
    void sendCapiEvent({
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
