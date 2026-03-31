/**
 * Cloud Functions for SilentGuard
 * Firestore trigger: on new crisisEvent → FCM multicast to all registered staff devices.
 *
 * Uses Firebase Cloud Functions v2 (onDocumentCreated).
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { logger } = require('firebase-functions');

initializeApp();

const db = getFirestore();
const messaging = getMessaging();
const HOTEL_ID = process.env.HOTEL_ID || '';

/**
 * Triggered when a new document is created in the crisisEvents collection.
 * Sends an FCM push notification to all registered staff devices.
 */
exports.onCrisisEvent = onDocumentCreated('crisisEvents/{eventId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.warn('No data in crisisEvent document');
    return;
  }

  const data = snapshot.data();
  const { className, confidence, roomId, hotelId } = data;
  const eventHotelId = hotelId || HOTEL_ID;

  logger.info(
    `🚨 Crisis event: ${className} (${(confidence * 100).toFixed(1)}%) in room ${roomId}`
  );

  // Get registered FCM tokens for this hotel
  let tokensSnapshot;
  if (eventHotelId) {
    tokensSnapshot = await db.collection('fcmTokens').where('hotelId', '==', eventHotelId).get();
  } else {
    tokensSnapshot = await db.collection('fcmTokens').get();
  }

  if (tokensSnapshot.empty) {
    logger.warn('No FCM tokens registered — no push sent');
    return;
  }

  const tokenDocs = tokensSnapshot.docs;
  const tokens = tokenDocs.map((doc) => doc.data().token);

  // Build FCM notification payload
  const message = {
    notification: {
      title: '🚨 SilentGuard Alert',
      body: `${className} detected in Room ${roomId} (${(confidence * 100).toFixed(0)}% confidence)`,
    },
    data: {
      className: className || '',
      confidence: String(confidence || 0),
      roomId: roomId || '',
      hotelId: eventHotelId,
      eventId: event.params.eventId,
      timestamp: new Date().toISOString(),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'silentguard_crisis',
        priority: 'max',
        defaultVibrateTimings: false,
        vibrateTimingsMillis: [300, 100, 300, 100, 300],
      },
    },
    webpush: {
      headers: {
        Urgency: 'high',
      },
      notification: {
        requireInteraction: true,
        tag: 'silentguard-crisis',
        renotify: true,
      },
    },
  };

  // Send to all registered devices in chunks of 500
  const CHUNK_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;
  const tokensToRemove = [];

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const tokensChunk = tokens.slice(i, i + CHUNK_SIZE);
    const chunkMessage = { tokens: tokensChunk, ...message };
    
    const response = await messaging.sendEachForMulticast(chunkMessage);
    successCount += response.successCount;
    failureCount += response.failureCount;

    // Clean up stale tokens
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token'
          ) {
            tokensToRemove.push(tokensChunk[idx]);
          }
        }
      });
    }
  }

  logger.info(
    `FCM sent: ${successCount} success, ${failureCount} failures`
  );

  if (tokensToRemove.length > 0) {
    logger.info(`Removing ${tokensToRemove.length} stale FCM token(s)`);
    // Delete in chunks of 500 (Firestore limit)
    for (let i = 0; i < tokensToRemove.length; i += CHUNK_SIZE) {
      const batch = db.batch();
      const tokensChunk = tokensToRemove.slice(i, i + CHUNK_SIZE);
      for (const token of tokensChunk) {
        const tokenDoc = tokenDocs.find((doc) => doc.data().token === token);
        if (tokenDoc) {
          batch.delete(tokenDoc.ref);
        }
      }
      await batch.commit();
    }
  }
});
