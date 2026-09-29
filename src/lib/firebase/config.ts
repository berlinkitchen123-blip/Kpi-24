import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Demo mode when no config is present, or when built with `--mode preview`. */
export const isDemo = import.meta.env.MODE === "preview" || !config.apiKey;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function fb(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (isDemo) throw new Error("Firebase is not configured (demo mode).");
  if (!app) {
    app = initializeApp(config);
    // Offline cache: entries made with weak/no connection are queued and synced later.
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  }
  return { app, auth: getAuth(app), db: db! };
}
