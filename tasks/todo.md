# 修复:切页面后购物车地址/电话丢失(需刷新)

## 问题
登录后加购物车 → 不付款先点去别的页(餐券/会员/博客…)→ 回到结账时地址电话变「尚未填写」、下单被锁,要刷新才恢复。
购物车的菜不丢(localStorage 持久化),丢的是「身份 + 地址/电话」这一层。

## 根因(代码可验证)
1. `userProfile`(地址/电话)是 CartDrawer 的临时 React state,每次开抽屉才去 Firestore 现拉,**无缓存**(CartDrawer.tsx:248-253)。
2. Firebase Auth 初始化被 requestIdleCallback 延迟≤3s,且首页卸载时会取消未跑完的初始化(page.tsx:59-71)。快速切页时 Auth 反复被取消 → currentUser 一直 null → profile 拉不到。
3. 全站 9 个文件各自订阅 onAuthChange + 各自拉 profile,互不同步,无单一数据源。

## 方案:根 layout 共享 AuthProvider + 持久化 profile 缓存

- [ ] 1. 新建 `src/context/AuthContext.tsx`('use client')
    - 只在 layout 级初始化一次 Auth(保留 requestIdleCallback 延迟保性能,但不再随页面卸载被取消)
    - 持有 currentUser / userProfile / loading,暴露 `useAuth()` + `refreshProfile()`
    - mount 时先从 localStorage 秒读 profile(瞬显地址电话);user 解析后再拉 Firestore 覆盖 + 写回缓存
    - **logout / user=null 时清掉缓存**(地址电话是 PII,共用设备防串号)
- [ ] 2. `layout.tsx`:用 `<AuthProvider>` 包住 `{children}`(server layout 套 client provider,可行)
- [ ] 3. `page.tsx`:删掉本地 currentUser + 可取消的延迟 onAuthChange,改用 `useAuth()`
- [ ] 4. `CartDrawer.tsx`:删掉自带 onAuthChange + getUserProfile,改用 `useAuth()`;地址电话来自缓存=瞬显;开抽屉时 refreshProfile() 后台刷新,但不卡 UI
- [ ] 5. `AuthModal.tsx`:`updateUserProfile` 后调 `refreshProfile()`,改完地址购物车立即反映(顺带修「存了但购物车不更新」)
- [ ] 暂不动 member / meal-vouchers / admin / en 页(独立路由,照常工作,后续再迁)

## 验证
- [ ] tsc / next build 通过
- [ ] browse dogfood:登录→加购物车→去 /meal-vouchers→返回→开购物车,地址电话**不刷新就在**;before/after 对比
- [ ] logout 后缓存清空,下一个用户看不到上一个人的地址
- [ ] 确认未回归 LCP(Auth 仍延迟初始化)

## Review(已实施 2026-06-05)

改动文件:
- 新增 `src/context/AuthContext.tsx`:全站 AuthProvider,根 layout 级一次性初始化、survive 导航;profile 按 uid 缓存到 localStorage(`incredibowl-profile`),登出/换用户即清。
- `src/app/layout.tsx`:`<AuthProvider>` 包住 `{children}`。
- `src/app/page.tsx`:删本地 currentUser + 延迟 onAuthChange,改 `useAuth()`。
- `src/components/cart/CartDrawer.tsx`:删自带 onAuthChange/getUserProfile,改 `useAuth()`;开抽屉后台 refreshProfile()。
- `src/components/auth/AuthModal.tsx`:更新地址后 `refreshProfile()` 同步全站。

验证结果:
- ✅ `tsc --noEmit` 零报错
- ✅ `next build` 通过(全页面预渲染 + sitemap 正常)
- ✅ 所有路由 200(/、/meal-vouchers、/member、/order、/en)
- ✅ browse:首页渲染→去 /meal-vouchers→返回→无新 console 报错(仅既有 Meta pixel/web-share 警告)
- ✅ browse:打开购物车抽屉「我的订单」正常,useAuth() 无 context/undefined 报错

未能自动验证(需老板真账号):登录态下「加购物车→切页→返回地址电话仍在」的端到端流程。
建议老板用真账号手动复测一次该路径,以及登出后换账号确认不串地址。
