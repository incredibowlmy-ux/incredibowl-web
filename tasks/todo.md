# 手动录入单加「地址 + 自动距离」(dashboard)

## 目标
让 dashboard 手动录入的订单，在 admin 卡片上和网站自动单一样显示：
完整地址 + 精确公里数 + 距离档位（近距离/中距离…）。

## 根因
`public/dashboard-h7x2q9.html` 手动表单没有地址输入框，保存时 `userAddress: ''`、
无 `deliveryDistanceKm`、无 `deliveryTier`。admin 卡片（src/app/admin/page.tsx:1214-1246）
靠这三个字段渲染地址+距离标签，所以手动单只剩被当成 free 的「免运区（老客户）」。

## 方案（用户选定：输入地址 → 自动算距离）
复用现成公开接口 `POST /api/check-delivery`（无需 auth，同源），
返回 `{ tier, distanceKm, fee, formattedAddress }`，和网站自动单同一套 Google 地图算法。

## 改动清单（全部在 dashboard-h7x2q9.html）
- [ ] 1. HTML：手动订单 modal 加「配送地址」输入框 + 「算距离」按钮 + 结果预览行
- [ ] 2. JS：geocodeManualAddress() 调 /api/check-delivery，存 state.moDistanceResolved；
        自动同步 moZone；建议运费回填（仅当运费仍为 0）
- [ ] 3. JS：地址 input/Enter 监听（改地址→失效，Enter→触发）
- [ ] 4. JS：openOrderModal 重置区清空地址 + state.moDistanceResolved
- [ ] 5. JS：编辑模式回填 userAddress + 从已存 km/tier 还原 state
- [ ] 6. JS：保存时 orderData.userAddress + deliveryDistanceKm + deliveryTier
- [ ] 7. 处理 >7.5km「outside」：仍可保存，按 far 记，预览警告

## 验证
- [ ] 真实地址 → 预览 km+档位 → 保存 → admin 卡片显示地址 + 「🛵 xx · X.XXkm」
- [ ] 不点算距离直接保存 → 地址照存、不写 km、不报错
- [ ] 编辑已有手动单 → 地址/距离回填，重存不丢

## Review（2026-06-02 完成代码）
全部 7 处改动落在 public/dashboard-h7x2q9.html：
1. ✅ 手动 modal 加 #moAddress 输入框 + #moGeocodeBtn「算距离」+ #moDistancePreview
2. ✅ geocodeManualAddress() 调 ADMIN_API_BASE+/api/check-delivery（公开无 auth、同源）
3. ✅ 地址 Enter 触发 / input 改动失效重算
4. ✅ openOrderModal 重置区清空地址 + state.moDistanceResolved
5. ✅ 编辑模式回填 userAddress + 从已存 km/tier 还原（重存不丢；updateDoc 会带上新字段）
6. ✅ 保存写 userAddress + deliveryDistanceKm + deliveryTier（admin/page.tsx 直接读这俩渲染）
7. ✅ outside(>7.5km) 按 far 记 + 警告，仍可保存

设计取舍：
- 运费只在仍为 0 时自动回填建议值，绝不覆盖老板手填的运费
- deliveryZone（成本会计用）随 tier 自动同步：free→within2km，其余→outside2km
- 不点「算距离」也能存，只是不写距离字段（地址照存）

待老板线上冒烟（需登录 + Google Maps key，本地跑不了）：
- [ ] 真实地址 → 预览 km+档位 → 保存 → admin 卡片显示地址 + 「🛵 xx · X.XXkm」
- [ ] 编辑现有 #4HLRLZ → 补地址 → 重存 → 卡片从「免运区」变精确距离
