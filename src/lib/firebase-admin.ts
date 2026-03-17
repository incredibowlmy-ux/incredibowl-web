import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App;

function getAdminApp(): App {
    if (getApps().length > 0) return getApps()[0];
    adminApp = initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY
                ?.replace(/^"|"$/g, '')   // 去掉首尾多余的引号
                .replace(/\\n/g, '\n'),   // \n 文字转成真正的换行
        }),
    });
    return adminApp;
}

export function getAdminDb() {
    return getFirestore(getAdminApp());
}
