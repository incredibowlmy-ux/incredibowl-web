# Incredibowl Project Context & Guidelines for Claude Code

## 📌 Introduction
You are an AI Coding Assistant collaborating on **Incredibowl**, a local neighborhood food delivery web application targeting the Pearl Suria / Pearl Point area (Kuala Lumpur). 
The brand's core values are: **家的味道 (Home-cooked taste), 无味精 (No MSG), 新鲜采购 (Freshly sourced), 每日一味 (Daily special).**

## 🚨 CRITICAL INSTRUCTIONS FOR CLAUDE
1. **Language Policy**: You **MUST** communicate with the user and write all user-facing UI text in **Simplified Chinese (简体中文)**.
2. **Honesty & No Guessing**: If you don't know something, say you don't know. Don't make up details.
3. **Communication Style**: Friendly and honest. No need to flatter the user. 
4. **Action-Oriented**: Proactively fix code and suggest solutions rather than just explaining.

## 💻 Tech Stack
- **Framework**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **Database & Services**: Firebase (Firestore for orders/users, Storage for receipt uploads, Auth for Admin login)
- **Payment Providers**: 
  - **DuitNow QR** (Manual receipt upload to Firebase Storage)
  - **Curlec by Razorpay** (Online payment gateway via Next.js API Routes)
- **Deployment**: Vercel

## 📂 Project Structure
- `src/app/page.tsx`: The main landing page, containing brand copy and the menu.
- `src/app/admin/page.tsx`: The Admin Dashboard. Features multi-day order projections, lunch/dinner splits, and kitchen prep summaries. Restricted to `incredibowl.my@gmail.com`.
- `src/components/cart/CartDrawer.tsx`: The core checkout component handling cart state, add-ons, user info collection, and triggering payment flows.
- `src/lib/orders.ts` & `src/lib/firebase.ts`: Handles Firestore schemas, data injection, and sanitized document creation.
- `src/app/api/payment/*`: Backend routes for Razorpay `create-order` (uses lazy initialization to prevent Vercel build errors) and `verify`.

## ⚙️ Key Workflows & Known Quirks
- **Firebase Storage CORS**: DuitNow QR payments require an image upload. The bucket CORS is securely configured; do not overwrite it without checking.
- **Razorpay Instantiation**: In Next.js API routes, Razorpay is initialized *lazily* inside the POST handler rather than at the module level. This prevents Vercel build failures when env variables aren't present at build time.
- **Undefined Fields in Firestore**: Always sanitize custom objects before saving to Firestore to prevent `undefined` field errors (e.g., removing `undefined` from add-ons arrays).

## 🚀 Common Commands
- **Run dev server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`

## ✅ How to Contribute
When the user gives you a task:
1. Identify the impact area (Frontend UI, API Route, or Firebase logic).
2. Check existing components first to avoid reinventing the wheel.
3. Apply changes directly and suggest git commit commands.
