import { NextResponse } from 'next/server';
import { getDishPrice } from '@/data/promoConfig';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { weeklyMenu } from '@/data/weeklyMenu';

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
      const code = promoCode.trim().toUpperCase();
      const voucherRef = db.collection('vouchers').doc(code);
      const snap = await voucherRef.get();

      if (!snap.exists) {
        return NextResponse.json({ error: '优惠码无效' }, { status: 400 });
      }
      const vData = snap.data()!;
      if (vData.isUsed) {
        return NextResponse.json({ error: '优惠码已被使用' }, { status: 400 });
      }
      if (vData.expiresAt && vData.expiresAt.toDate() < new Date()) {
        return NextResponse.json({ error: '优惠码已过期' }, { status: 400 });
      }
      serverPromoDiscount = typeof vData.discount === 'number' ? vData.discount : 1;

      // Verify client discount matches server
      if (Math.abs(serverPromoDiscount - clientPromoDiscount) > 0.02) {
        return NextResponse.json({ error: '优惠金额不一致' }, { status: 400 });
      }
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

      const payload: Record<string, any> = {
        userId, userName, userEmail, userPhone, userAddress,
        items,
        total: finalTotal,
        originalTotal: group.subtotal,
        deliveryDate: group.date,
        deliveryTime: group.time,
        paymentMethod,
        receiptUploaded: receiptUploaded || false,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Only add optional fields if they have values (Firestore doesn't allow undefined)
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

    // TODO: 优惠券在支付确认前就标记已用，FPX支付失败后优惠券会浪费。
    // 考虑将此逻辑移至 /api/confirm-order，在支付成功后再标记。
    // ── Mark voucher as used atomically after orders created ───
    if (promoCode && serverPromoDiscount > 0) {
      const code = promoCode.trim().toUpperCase();
      const voucherRef = db.collection('vouchers').doc(code);
      await voucherRef.update({
        isUsed: true,
        usedBy: userId,
        usedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      orderIds,
      groupId: groupId || null,
      isMultiPart,
      serverTotal: Math.max(0, serverCartTotal - serverPromoDiscount),
    });

  } catch (err: any) {
    console.error('submit-order error:', err);
    return NextResponse.json({ error: err.message || '提交订单失败' }, { status: 500 });
  }
}
