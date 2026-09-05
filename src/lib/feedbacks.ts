import { db } from './firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

export interface Feedback {
    id?: string;
    name: string;
    text: string;
    time: string;
    status: 'PENDING' | 'APPROVED';
    createdAt: string;
}

const COLLECTION_NAME = 'feedbacks';

export const submitFeedback = async (name: string, text: string) => {
    const newFeedback: Omit<Feedback, 'id'> = {
        name,
        text,
        time: "刚刚",
        status: 'PENDING',
        createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, COLLECTION_NAME), newFeedback);
};

/**
 * 首页「邻居好评」的已审核评价。
 *
 * 2026-09-05：从客户端 SDK 的 getDocs 改成 fetch('/api/feedbacks')。签名和返回
 * 形状不变，调用方（FeedbackSection / FeedbackSectionEN）一行没改。
 *
 * 原因是实测出来的：Firestore Web SDK 一读就开 Listen 长连接并常驻，首页因此
 * **永远到不了 network idle**，15 秒内主线程任务多 26%。这份数据本来就是公开
 * 只读的，没必要为它在每个访客的浏览器里维持一条实时连接。详见该路由的注释。
 *
 * 拿不到就返回空数组：评价区少一块社会证明，不该让首页崩掉。
 */
export const getApprovedFeedbacks = async (): Promise<Feedback[]> => {
    try {
        const res = await fetch('/api/feedbacks');
        if (!res.ok) return [];
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        // 服务端已按 createdAt 倒序，这里不再排一遍。
        return items as Feedback[];
    } catch {
        return [];
    }
};

export const getAllFeedbacks = async (): Promise<Feedback[]> => {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback));
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const updateFeedbackStatus = async (id: string, status: 'PENDING' | 'APPROVED') => {
    await updateDoc(doc(db, COLLECTION_NAME, id), { status });
};

export const deleteFeedback = async (id: string) => {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
};
