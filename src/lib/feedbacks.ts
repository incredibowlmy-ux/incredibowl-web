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

export const getApprovedFeedbacks = async (): Promise<Feedback[]> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where("status", "==", "APPROVED")
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback));
    // Sort descending by createdAt
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
