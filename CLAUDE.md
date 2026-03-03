# CLAUDE.md — Incredibowl Web

This file provides guidance for AI assistants working on this codebase.

---

## Project Overview

**Incredibowl** is a full-stack food delivery web application for a Malaysian home-style meal service based near Pearl Suria (3km neighbourhood/apartment radius). The app supports weekly meal subscriptions, individual orders, payment processing, a loyalty points system, and an admin dashboard.

**Live domain:** `incredibowl.my`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5 (strict mode) |
| UI | React 19.2.3 |
| Styling | Tailwind CSS v4 + PostCSS |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Google, Facebook, Email/Password) |
| Storage | Firebase Storage (receipt uploads) |
| State | Zustand v5 |
| Payments | Razorpay v2 |
| Icons | Lucide React |
| Spreadsheet | XLSX (Excel export/import) |

---

## Development Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

No test framework is currently configured.

---

## Environment Variables

Create a `.env.local` file (never commit it):

```env
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

Firebase config is intentionally hardcoded in `src/lib/firebase.ts` — this is standard practice for frontend Firebase (public keys protected by Firestore security rules).

---

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── page.tsx            # Home page — menu display, ordering UI (~800+ lines)
│   ├── layout.tsx          # Root layout with metadata
│   ├── globals.css         # Global styles & Tailwind CSS theme variables
│   ├── api/
│   │   └── payment/
│   │       ├── create-order/route.ts   # POST — create Razorpay order
│   │       └── verify/route.ts         # POST — verify payment HMAC signature
│   ├── account/page.tsx    # User profile, order history, loyalty points
│   ├── admin/page.tsx      # Admin dashboard (orders, customers, feedbacks)
│   ├── checkout/page.tsx   # Checkout flow
│   ├── login/page.tsx      # Authentication page
│   ├── member/page.tsx     # Member/loyalty program page
│   ├── refund/page.tsx     # Refund policy
│   ├── privacy/page.tsx    # Privacy policy
│   └── terms/page.tsx      # Terms of service
├── components/
│   ├── auth/AuthModal.tsx  # Login/signup/profile modal
│   ├── cart/CartDrawer.tsx # Shopping cart side drawer
│   └── menu/AddOnModal.tsx # Item customization/add-ons modal
├── lib/
│   ├── firebase.ts         # Firebase app init (auth, db, storage exports)
│   ├── auth.ts             # Auth helpers (Google, Facebook, email sign-in/up)
│   ├── orders.ts           # Firestore order CRUD + points logic
│   └── feedbacks.ts        # Firestore feedback CRUD
└── store/
    └── cartStore.ts        # Zustand cart store
```

---

## Firestore Data Model

### `users` collection
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  address?: string;
  referralCode: string;       // Format: "IB-{uid_slice}"
  referredBy?: string;        // referralCode of the referrer
  referralBonusAwarded?: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  lastOrderAt?: Timestamp;
  totalOrders: number;
  totalSpent: number;
  points: number;
}
```

### `orders` collection
```typescript
{
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userAddress: string;
  items: OrderItem[];
  total: number;
  originalTotal?: number;
  promoCode?: string;
  promoDiscount?: number;
  deliveryDate: string;        // "YYYY-MM-DD"
  deliveryTime: string;
  paymentMethod: 'qr' | 'fpx' | 'curlec';
  receiptUploaded: boolean;
  receiptUrl?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled';
  note?: string;
  isMultiPart?: boolean;       // For orders split across multiple Firestore docs
  partIndex?: number;
  totalParts?: number;
  groupId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `feedbacks` collection
```typescript
{
  name: string;
  text: string;
  time: string;
  status: 'PENDING' | 'APPROVED';
  createdAt: Timestamp;
}
```

---

## Business Logic Rules

### Points / Loyalty
- **Points are NOT awarded on order submission** — only when admin sets status to `confirmed`.
- Rate: RM 1 spent = 1 point (integer, `Math.floor(total)`).
- **Referral bonus:** 50 points to both referrer and new user, triggered on the new user's **first confirmed order only**. Guard: `referralBonusAwarded` boolean prevents double-awarding.
- Referral codes format: `IB-{first_6_chars_of_uid}`.

### Admin Access
- Restricted to emails listed in the `ADMIN_EMAILS` constant in `src/app/admin/page.tsx`.
- Add new admin emails there directly.

### Multi-Part Orders
- Large orders may be split into multiple Firestore documents (`isMultiPart: true`).
- Related parts share a `groupId` and are indexed with `partIndex` / `totalParts`.

### Firestore `undefined` values
- Firestore rejects `undefined` fields. Always sanitize order data before writing:
  ```typescript
  const sanitized = Object.entries(data).reduce((acc, [k, v]) => {
      if (v !== undefined) acc[k] = v;
      return acc;
  }, {} as any);
  ```

### User Order Queries
- `getUserOrders` intentionally omits `orderBy` in the Firestore query to avoid requiring a composite index. Sorting is done client-side on `createdAt.seconds`.

---

## API Routes

### `POST /api/payment/create-order`
Creates a Razorpay order. Requires `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` env vars.

**Body:** `{ amount: number, currency?: string, receipt?: string, notes?: object }`
- `amount` is in sen (smallest unit); minimum 100 (RM 1.00)

**Response:** `{ orderId, amount, currency }`

### `POST /api/payment/verify`
Verifies Razorpay payment signature using HMAC-SHA256.

**Body:** `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`

**Response:** `{ verified: boolean, paymentId, orderId }`

---

## State Management

Cart state is managed entirely via Zustand in `src/store/cartStore.ts`:

```typescript
useCartStore.getState().addItem(item, options?)
useCartStore.getState().removeItem(id)
useCartStore.getState().updateQuantity(id, delta)
useCartStore.getState().toggleCart()
useCartStore.getState().clearCart()
useCartStore.getState().getCartTotal()   // Returns number (MYR)
useCartStore.getState().getCartCount()   // Returns total item count
```

`addItem` uses `options?.cartItemId` as a composite key to differentiate the same item with different customisations.

---

## Styling Conventions

Tailwind CSS v4 utility classes are used throughout. Custom CSS variables are defined in `src/app/globals.css`:

| Variable | Value | Usage |
|---|---|---|
| `--primary` | `#FF6B00` | Orange — primary brand colour |
| `--primary-dark` | `#E66000` | Darker orange for hover states |
| `--secondary` | `#E63946` | Red — secondary accent |
| `--accent` | `#FFD60A` | Yellow accent |
| `--kraft` | `#F4EFE6` | Off-white background (kraft paper) |
| `--rooster` | `#D62828` | Dark red |
| `--twine` | `#9D8461` | Brown/muted |

**Fonts:**
- Body: `Inter`
- Headings/Display: `Outfit`
- Chinese text: `Noto Serif SC`, `ZCOOL XiaoWei`
- Decorative: `Quicksand`, `Fredoka One`

**Rules:**
- Prefer Tailwind utility classes over custom CSS.
- No CSS Modules — all component styling via Tailwind.
- Responsive design uses Tailwind breakpoints (`sm:`, `md:`, `lg:`).

---

## Code Conventions

### Naming
- **Components:** PascalCase (`AuthModal`, `CartDrawer`)
- **Files:** PascalCase for components; camelCase for utilities/lib
- **Constants:** UPPER_SNAKE_CASE (`ADMIN_EMAILS`, `COLLECTION_NAME`)
- **State/variables:** camelCase with boolean prefix (`isLoading`, `hasError`, `currentUser`)

### Imports
- Use the `@/` path alias for all `src/` imports:
  ```typescript
  import { useCartStore } from '@/store/cartStore';
  import { db } from '@/lib/firebase';
  ```
- Never use relative paths like `../../lib/firebase`.

### Components
- All pages and components that use hooks or browser APIs must have `"use client"` at the top.
- Functional components only — no class components.
- Explicit TypeScript types for all function parameters and return values.

### Firestore
- Export all Firestore operations from `src/lib/` (never write Firestore calls directly in page components).
- Always use `serverTimestamp()` for `createdAt` and `updatedAt`.

---

## Bilingual UI

The app is bilingual (English + Simplified Chinese). Key points:
- Menu item names have both Chinese (`name`) and English (`nameEn`) fields.
- UI copy is often duplicated in Chinese below English labels.
- The `.cursorrules` file instructs AI assistants using Cursor to reply in Simplified Chinese — this does not affect Claude Code.

---

## Deployment

- Target platform: **Vercel** (standard Next.js deployment).
- CORS is configured in `cors.json` for Firebase Storage:
  - Production: `incredibowl.my`, `www.incredibowl.my`
  - Development: `localhost:3000`, `localhost:3001`
- Next.js image optimisation is configured for `lh3.googleusercontent.com` (Google Auth profile photos).

---

## What Does NOT Exist (yet)

- No test framework (no Jest/Vitest/Playwright).
- No CI/CD pipeline (no GitHub Actions).
- No Storybook or component docs.
- No API documentation beyond this file.

---

## Common Pitfalls

1. **Never award points on `submitOrder`** — only on `updateOrderStatus` with `status === 'confirmed'`.
2. **Never pass `undefined` to Firestore** — sanitize objects before writing.
3. **`getUserOrders` sorts client-side** — do not add `orderBy` to that query without also creating the required Firestore composite index.
4. **Razorpay is lazy-initialized** in API routes to avoid build-time errors. Do not move the `require('razorpay')` call to the top level.
5. **Admin emails are hardcoded** in `src/app/admin/page.tsx` — check `ADMIN_EMAILS` before assuming someone has admin access.
