# Lessons learned

## 2026-05-11 — Discount mechanisms must handle the zero-total edge case

**Bug:** Customer with 5+ meal vouchers redeems 5 main dishes in free-delivery zone → cart total = RM 0.00, but UI still required them to select QR/FPX and upload a receipt. "确认下单" button was permanently disabled because it required `paymentMethod` to be set.

**Root cause:** The checkout flow was built assuming there's always cash to collect. When the discount fully covered the bill, none of the existing code paths handled "no payment needed."

**Rule for myself:** When introducing ANY new discount mechanism (vouchers, promo codes, loyalty points, refer-a-friend credits, etc.), explicitly enumerate the boundary cases:
- finalTotal = 0 → no cash flow path needs to exist (skip payment selector, skip receipt upload, skip Razorpay)
- finalTotal < 0 → impossible by `Math.max(0, ...)` but worth a server-side guard
- finalTotal between 0 and 1 → Razorpay will reject (min 100 paise / 1 INR equivalent), so still needs the no-cash branch

**Pattern to apply:** Add a computed `isFullyCovered = total <= 0 && discount > 0` and short-circuit the payment ceremony. Don't try to bend the existing QR/FPX flow to accept zero-amount transactions.
