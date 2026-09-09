// Server-side (firebase-admin) user lookup shared by admin API routes.
// 所有「按电话找客户账号」的服务端入口必须走这里，别再各自 .limit(1) 取第一个。

/**
 * Find the user doc for a normalized phone (see phoneUtils.normalizePhone).
 * 同电话可能匹配多个文档（账号合并后的旧匿名壳带 mergedInto）——未合并的优先，
 * 都带 mergedInto 才退回第一个。找不到返回 null。
 */
export async function findUserByNormalizedPhone(
  db: FirebaseFirestore.Firestore,
  phoneNormalized: string,
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const docs = await findUsersByNormalizedPhone(db, phoneNormalized);
  return docs[0] || null;
}

/**
 * 同电话的**全部** users 文档，未合并的排前面。给需要「把一个人的几个账号一起看」
 * 的只读场景用（碗妈 bot 查订单）：同号码两个真实账号（不带 mergedInto）时
 * 只取第一个会漏掉另一个账号的订单。
 */
export async function findUsersByNormalizedPhone(
  db: FirebaseFirestore.Firestore,
  phoneNormalized: string,
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  if (!phoneNormalized) return [];
  const snap = await db.collection('users')
    .where('phoneNormalized', '==', phoneNormalized)
    .get();
  if (snap.empty) return [];
  return [...snap.docs.filter(d => !d.data().mergedInto), ...snap.docs.filter(d => d.data().mergedInto)];
}
