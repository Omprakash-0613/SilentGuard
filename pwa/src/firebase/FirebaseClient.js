/**
 * FirebaseClient.js
 * Handles Firestore writes for crisis events, FCM token registration,
 * and real-time Firestore listeners. NO audio data is ever stored.
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig, { HOTEL_ID, VAPID_KEY } from './firebaseConfig';
import { saveEventLocally, initOfflineSync } from '../offlineQueue';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let messaging = null;

// Generate a persistent device ID
function getDeviceId() {
  let deviceId = localStorage.getItem('silentguard_device_id');
  if (!deviceId) {
    deviceId = 'device_' + crypto.randomUUID();
    localStorage.setItem('silentguard_device_id', deviceId);
  }
  return deviceId;
}

/**
 * Log a crisis event to Firestore.
 * Only metadata — NO audio data stored.
 */
export async function logCrisisEvent(event) {
  const eventData = {
    className: event.className,
    confidence: event.confidence,
    roomId: event.roomId,
    deviceId: getDeviceId(),
    hotelId: HOTEL_ID,
    timestamp: serverTimestamp(),
    localTimestamp: event.timestamp.toISOString(),
  };

  // If offline, save locally
  if (!navigator.onLine) {
    console.warn('FirebaseClient: offline — saving locally');
    await saveEventLocally(eventData);
    return null;
  }

  try {
    const docRef = await addDoc(collection(db, 'crisisEvents'), eventData);
    console.log('FirebaseClient: crisis logged →', docRef.id);
    return docRef.id;
  } catch (error) {
    // Firestore failed — save locally as fallback
    console.error('FirebaseClient: write failed — saving locally', error);
    await saveEventLocally(eventData);
    return null;
  }
}

/**
 * Register this device for FCM push notifications.
 * Saves the token to Firestore fcmTokens collection.
 */
export async function registerForPush() {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('FirebaseClient: notifications not supported');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('FirebaseClient: notification permission denied');
      return null;
    }

    messaging = getMessaging(app);

    // Register service worker for background messages
    const swRegistration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    );

    if (VAPID_KEY === 'YOUR_VAPID_KEY') {
      console.warn(
        'FirebaseClient: VAPID key is placeholder. Skipping FCM push registration. ' +
        'Get your Web Push certificate from Firebase Console -> Project Settings -> Cloud Messaging.'
      );
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      // Save token to Firestore
      await setDoc(doc(db, 'fcmTokens', token), {
        token,
        deviceId: getDeviceId(),
        hotelId: HOTEL_ID,
        createdAt: serverTimestamp(),
        platform: navigator.userAgent,
      });
      console.log('FirebaseClient: FCM token registered');
      return token;
    }

    console.warn('FirebaseClient: no FCM token received');
    return null;
  } catch (error) {
    console.error('FirebaseClient: FCM registration failed', error);
    return null;
  }
}

/**
 * Listen for incoming FCM messages while app is in foreground.
 * @param {function(object): void} callback
 */
export function onForegroundMessage(callback) {
  if (!messaging) {
    messaging = getMessaging(app);
  }
  return onMessage(messaging, (payload) => {
    console.log('FirebaseClient: foreground message received', payload);
    callback(payload);
  });
}

/**
 * Subscribe to real-time crisis events from Firestore.
 * @param {function(Array): void} callback - receives array of crisis event objects
 * @param {number} [maxEvents=20] - maximum number of events to listen for
 * @returns {function} unsubscribe function
 */
export function onCrisisAlert(callback, maxEvents = 20) {
  const q = query(
    collection(db, 'crisisEvents'),
    orderBy('timestamp', 'desc'),
    limit(maxEvents)
  );

  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(events);
  });
}

export { app, db };

// Initialize offline sync — auto-syncs when internet returns
initOfflineSync(async (eventData) => {
  await addDoc(collection(db, 'crisisEvents'), {
    ...eventData,
    timestamp: serverTimestamp(),
  });
});
