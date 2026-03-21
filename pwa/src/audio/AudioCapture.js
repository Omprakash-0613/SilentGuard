/**
 * AudioCapture.js
 * Captures mic audio via Web Audio API, resamples to 16 kHz mono
 * using OfflineAudioContext, and emits Float32Array buffers of 15600 samples
 * (0.975s at 16 kHz) — the exact input size YAMNet expects.
 *
 * Audio NEVER leaves the device.
 */

const TARGET_SAMPLE_RATE = 16000;
const YAMNET_FRAME_LENGTH = 15600; // 0.975s at 16 kHz
const PROCESSOR_BUFFER_SIZE = 4096;

/**
 * Resample audio from native sample rate to 16 kHz using OfflineAudioContext.
 * Browser-native resampling is more accurate than linear interpolation.
 */
async function resampleTo16k(samples, fromRate) {
  const offCtx = new OfflineAudioContext(
    1,
    Math.ceil(samples.length * TARGET_SAMPLE_RATE / fromRate),
    TARGET_SAMPLE_RATE
  );
  const buf = offCtx.createBuffer(1, samples.length, fromRate);
  buf.copyToChannel(samples, 0);
  const src = offCtx.createBufferSource();
  src.buffer = buf;
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();
  return rendered.getChannelData(0);
}

export class AudioCapture {
  constructor() {
    this._stream = null;
    this._audioContext = null;
    this._processor = null;
    this._source = null;
    this._buffer = new Float32Array(0);
    this._onAudioDataCallback = null;
    this._running = false;
  }

  /**
   * Register callback for when a full YAMNet frame (15600 samples) is ready.
   * @param {function(Float32Array): void} callback
   */
  onAudioData(callback) {
    this._onAudioDataCallback = callback;
  }

  /**
   * Start capturing audio from the microphone.
   */
  async start() {
    if (this._running) return;

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this._source = this._audioContext.createMediaStreamSource(this._stream);

      // ScriptProcessorNode for raw PCM access
      this._processor = this._audioContext.createScriptProcessor(
        PROCESSOR_BUFFER_SIZE,
        1, // input channels (mono)
        1  // output channels (mono)
      );

      this._buffer = new Float32Array(0);
      this._running = true;

      this._processor.onaudioprocess = async (event) => {
        if (!this._running) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const nativeSampleRate = this._audioContext.sampleRate;

        // Resample to 16 kHz if needed
        let resampled;
        if (nativeSampleRate !== TARGET_SAMPLE_RATE) {
          resampled = await resampleTo16k(inputData, nativeSampleRate);
        } else {
          resampled = new Float32Array(inputData);
        }

        // Append to rolling buffer
        const newBuffer = new Float32Array(this._buffer.length + resampled.length);
        newBuffer.set(this._buffer);
        newBuffer.set(resampled, this._buffer.length);
        this._buffer = newBuffer;

        // Emit full YAMNet frames
        while (this._buffer.length >= YAMNET_FRAME_LENGTH) {
          const frame = this._buffer.slice(0, YAMNET_FRAME_LENGTH);
          this._buffer = this._buffer.slice(YAMNET_FRAME_LENGTH);

          if (this._onAudioDataCallback) {
            this._onAudioDataCallback(frame);
          }
        }
      };

      this._source.connect(this._processor);
      this._processor.connect(this._audioContext.destination);

      console.log(
        `AudioCapture: started (native ${this._audioContext.sampleRate} Hz → ${TARGET_SAMPLE_RATE} Hz)`
      );
    } catch (error) {
      console.error('AudioCapture: failed to start', error);
      throw error;
    }
  }

  /**
   * Stop capturing audio and release resources.
   */
  stop() {
    this._running = false;

    if (this._processor) {
      this._processor.disconnect();
      this._processor = null;
    }
    if (this._source) {
      this._source.disconnect();
      this._source = null;
    }
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
    if (this._stream) {
      this._stream.getTracks().forEach((track) => track.stop());
      this._stream = null;
    }

    this._buffer = new Float32Array(0);
    console.log('AudioCapture: stopped');
  }

  /**
   * @returns {boolean} Whether the capture is currently running.
   */
  get isRunning() {
    return this._running;
  }
}
