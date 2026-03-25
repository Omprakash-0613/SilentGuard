/**
 * firebaseConfig.js
 * Firebase project configuration.
 * 
 * ⚠️ REPLACE these placeholder values with your actual Firebase project config.
 * Get these from: Firebase Console → Project settings → Your apps → SDK setup
 */

// Your web app's Firebase configuration
const firebaseConfig = {
   apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// VAPID key for FCM web push
// Get from: Firebase Console → Cloud Messaging → Web configuration → Key pair
export const VAPID_KEY = import.meta.env.VITE_VAPID_KEY;
export const HOTEL_ID = import.meta.env.VITE_HOTEL_ID || '';

export default firebaseConfig;
