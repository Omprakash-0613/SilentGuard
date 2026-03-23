/**
 * CrisisDetector.js
 * Orchestrates AudioCapture → YAMNetDetector → crisis event filtering.
 * Detects: Screaming, Glass breaking, Gunshot/gunfire
 * Confidence threshold: 0.80 | Cooldown: 10 seconds
 *
 * Audio NEVER leaves the device — only metadata is emitted.
 */

import { AudioCapture } from './AudioCapture';
import { YAMNetDetector } from './YAMNetDetector';

// Expanded crisis classes to cast a wider net
const CRISIS_CLASSES = [
  'Screaming', 'Scream', 'Shout', 'Yell',
  'Crying', 'Whimper', 'Wail', 'Sobbing',
  'Glass', 'Shatter', 'Breaking', 'Smash',
  'Gunshot', 'Gunfire', 'Explosion', 'Bang',
  'Female scream', 'Male shout',
];

const CONFIDENCE_THRESHOLD = 0.60; // Minimum confidence for a prediction to be considered a crisis
const COOLDOWN_MS = 5000; // 5 seconds between alerts

export class CrisisDetector {
  constructor() {
    this._audioCapture = new AudioCapture();
    this._yamnet = new YAMNetDetector();
    this._roomId = null;
    this._running = false;
    this._processing = false;

    // Cooldown tracking — per-class last alert time
    this._lastAlertTime = {};

    // Callbacks
    this._onCrisisCallback = null;
    this._onStatusCallback = null;
    this._onPredictionCallback = null;
  }

  /**
   * Register callback for crisis events.
   * @param {function({className: string, confidence: number, timestamp: Date, roomId: string}): void} callback
   */
  onCrisis(callback) {
    this._onCrisisCallback = callback;
  }

  /**
   * Register callback for status changes.
   * @param {function(string): void} callback — statuses: 'loading', 'ready', 'listening', 'crisis', 'stopped', 'error'
   */
  onStatus(callback) {
    this._onStatusCallback = callback;
  }

  /**
   * Register callback for all predictions (for debug/monitoring).
   * @param {function(Array): void} callback
   */
  onPrediction(callback) {
    this._onPredictionCallback = callback;
  }

  /**
   * Load the YAMNet model and prepare for detection.
   */
  async loadModel() {
    this._emitStatus('loading');
    await this._yamnet.loadModel();
    this._emitStatus('ready');
  }

  /**
   * Start the crisis detection pipeline.
   * @param {string} roomId — Room identifier for this device
   */
  async start(roomId) {
    if (this._running) return;

    this._roomId = roomId;
    this._lastAlertTime = {};

    // Ensure model is loaded
    if (!this._yamnet.isLoaded) {
      await this.loadModel();
    }

    // Wire up audio capture → classification
    this._audioCapture.onAudioData(async (audioFrame) => {
      if (!this._running || this._processing) return;
      this._processing = true;

      try {
        const predictions = await this._yamnet.classify(audioFrame);

        // Emit all predictions for monitoring
        if (this._onPredictionCallback) {
          this._onPredictionCallback(predictions);
        }

        // Check for crisis classes
        console.log('TOP 5:', predictions.slice(0,5).map(p => `${p.className}:${(p.confidence*100).toFixed(0)}%`).join(' | '));

        // Background noise filter: if the absolute top prediction is speech or environment with high confidence, skip
        const topClass = predictions[0];
        if (
          topClass.confidence >= 0.60 &&
          (topClass.className.includes('Speech') ||
           topClass.className.includes('Boat, Water vehicle') ||
           topClass.className.includes('Outside, rural or natural'))
        ) {
           // Skip this frame, it's dominated by generic noise
           return;
        }

        for (const pred of predictions) {
          if (this._isCrisisClass(pred.className) && pred.confidence >= CONFIDENCE_THRESHOLD) {
            if (this._isInCooldown(pred.className)) {
              console.log(
                `CrisisDetector: ${pred.className} (${(pred.confidence * 100).toFixed(1)}%) — cooldown active, skipping`
              );
              continue;
            }

            // CRISIS DETECTED
            const event = {
              className: pred.className,
              confidence: pred.confidence,
              timestamp: new Date(),
              roomId: this._roomId,
            };

            this._lastAlertTime[pred.className] = Date.now();
            this._emitStatus('crisis');

            console.log(
              `CrisisDetector: 🚨 ALERT — ${pred.className} (${(pred.confidence * 100).toFixed(1)}%) in room ${this._roomId}`
            );

            if (this._onCrisisCallback) {
              this._onCrisisCallback(event);
            }

            // Only emit one crisis per audio frame
            break;
          }
        }
      } catch (error) {
        console.error('CrisisDetector: classification error', error);
      } finally {
        this._processing = false;
      }
    });

    await this._audioCapture.start();
    this._running = true;
    this._emitStatus('listening');

    console.log(`CrisisDetector: started monitoring room ${roomId}`);
  }

  /**
   * Stop the detection pipeline.
   */
  stop() {
    this._running = false;
    this._processing = false;
    this._audioCapture.stop();
    this._emitStatus('stopped');
    console.log('CrisisDetector: stopped');
  }

  /**
   * Check if a class name matches any crisis class (partial match).
   */
  _isCrisisClass(className) {
    return CRISIS_CLASSES.some(
      (crisis) => className.toLowerCase().includes(crisis.toLowerCase())
    );
  }

  /**
   * Check if a class is still in cooldown.
   */
  _isInCooldown(className) {
    const lastTime = this._lastAlertTime[className];
    if (!lastTime) return false;
    return Date.now() - lastTime < COOLDOWN_MS;
  }

  /**
   * Emit a status change.
   */
  _emitStatus(status) {
    if (this._onStatusCallback) {
      this._onStatusCallback(status);
    }
  }

  /**
   * @returns {boolean} Whether detection is currently running.
   */
  get isRunning() {
    return this._running;
  }

  /**
   * @returns {boolean} Whether the model is loaded.
   */
  get isModelLoaded() {
    return this._yamnet.isLoaded;
  }
}
