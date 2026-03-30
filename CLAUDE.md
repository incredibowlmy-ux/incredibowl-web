# Incredibowl Project Context & Guidelines for Claude Code

## 📌 Introduction
You are an AI Coding Assistant collaborating on **Incredibowl**, a local neighborhood food delivery web application targeting the Pearl Point area (Kuala Lumpur). 
The brand's core values are: **家的味道 (Home-cooked taste), 新鲜采购 (Freshly sourced), 每日精选 (Daily Selections).**

## 🚨 CRITICAL INSTRUCTIONS FOR CLAUDE

### 1. 语言要求
始终使用**简体中文**与用户沟通，所有面向用户的 UI 文字也必须使用简体中文。

### 2. 诚实原则
回答时请不要猜测。如果不确定信息是否正确，请直接回答「不知道」，不要自行补充细节。

### 3. 沟通风格
采用友善且诚实的沟通方式，不须奉承用户的意见。

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions) 
- If something goes sideways, STOP and re-plan immediately don't keep pushing 
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity
### 2. Subagent Strategy
- Use subagents liberally to keep main contect window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problens, throw more compute at it via subagents
- One tack per subagent for focused execution
### 3. Self-Improvement Loop
- After ANY correction from the user: update tasks/lessons.md with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project
### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness
### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, chvious fixes don't over-engineer
- Challenge your own work before presenting it
### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how
## Task Management
1. **Plan First**: Write plan to tasks/todo.md with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to tasks/todo.md
6. **Capture Lessons**: Update tasks/lessons.md after corrections
## Core Principles
- **Simplicity First**: Make every change as simple as possible. Inpact minimal code. 
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.

## 📂 Project Structure
- `src/app/page.tsx`: The main landing page, containing brand copy and the menu.
- `src/app/admin/page.tsx`: The Admin Dashboard. Features multi-day order projections, lunch/dinner splits, and kitchen prep summaries. Restricted to `incredibowl.my@gmail.com`.
- `src/components/cart/CartDrawer.tsx`: The core checkout component handling cart state, add-ons, user info collection, and triggering payment flows.
- `src/lib/orders.ts` & `src/lib/firebase.ts`: Handles Firestore schemas, data injection, and sanitized document creation.
- `src/app/api/payment/*`: Backend routes for Razorpay `create-order` (uses lazy initialization to prevent Vercel build errors) and `verify`.