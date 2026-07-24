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
  if (!phoneNormalized) return null;
  const snap = await db.collection('users')
    .where('phoneNormalized', '==', phoneNormalized)
    .get();
  if (snap.empty) return null;
  return snap.docs.find(d => !d.data().mergedInto) || snap.docs[0];
}
