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

  logger.info(
    `🚨 Crisis event: ${className} (${(confidence * 100).toFixed(1)}%) in room ${roomId}`
  );

  // Get all registered FCM tokens
  const tokensSnapshot = await db.collection('fcmTokens').get();

  if (tokensSnapshot.empty) {
    logger.warn('No FCM tokens registered — no push sent');
    return;
  }

  const tokens = tokensSnapshot.docs.map((doc) => doc.data().token);

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
      hotelId: hotelId || 'default',
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

  // Send to all registered devices
  const response = await messaging.sendEachForMulticast({
    tokens,
    ...message,
  });

  logger.info(
    `FCM sent: ${response.successCount} success, ${response.failureCount} failures`
  );

  // Clean up stale tokens
  if (response.failureCount > 0) {
    const tokensToRemove = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token'
        ) {
          tokensToRemove.push(tokens[idx]);
        }
      }
    });

    if (tokensToRemove.length > 0) {
      logger.info(`Removing ${tokensToRemove.length} stale FCM token(s)`);
      const batch = db.batch();
      for (const token of tokensToRemove) {
        const tokenDoc = tokensSnapshot.docs.find(
          (doc) => doc.data().token === token
        );
        if (tokenDoc) {
          batch.delete(tokenDoc.ref);
        }
      }
      await batch.commit();
    }
  }
});
