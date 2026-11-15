// Connects the tablet app to the Firebase project. Settings come from app/.env.
// Missing settings leave the health app running with no Firebase calls.
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = firebaseConfig.apiKey && firebaseConfig.projectId
  ? initializeApp(firebaseConfig)
  : null;

export function startAnalytics() {
  if (!firebaseApp || !firebaseConfig.measurementId) return;
  isSupported()
    .then((ok) => { if (ok) getAnalytics(firebaseApp); })
    .catch(() => { /* analytics is optional; the health app still runs */ });
}
