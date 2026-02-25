import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBSTpQdHv0XkijnWcLN8Ys8eNusdaNbgDc",
    authDomain: "incredibowl-1eedd.firebaseapp.com",
    projectId: "incredibowl-1eedd",
    storageBucket: "incredibowl-1eedd.firebasestorage.app",
    messagingSenderId: "22311453978",
    appId: "1:22311453978:web:5646ded9a0d7d90f7318a3",
    measurementId: "G-Z78ZLBH7CF"
};

// Initialize Firebase (prevent duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
