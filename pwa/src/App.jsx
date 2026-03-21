import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import StatusOrb from './components/StatusOrb';
import RoomSelector from './components/RoomSelector';
import StaffAlert from './components/StaffAlert';
import { CrisisDetector } from './audio/CrisisDetector';
import {
  logCrisisEvent,
  registerForPush,
  onCrisisAlert,
  onForegroundMessage,
} from './firebase/FirebaseClient';
import './App.css';

function App() {
  const [status, setStatus] = useState('stopped');
  const [roomId, setRoomId] = useState(
    () => localStorage.getItem('silentguard_room_id') || ''
  );
  const [modelLoaded, setModelLoaded] = useState(false);
  const [crisisEvents, setCrisisEvents] = useState([]);
  const [lastCrisisClass, setLastCrisisClass] = useState(null);
  const [error, setError] = useState(null);

  const detectorRef = useRef(null);

  // Initialize detector once
  useEffect(() => {
    detectorRef.current = new CrisisDetector();
    return () => {
      if (detectorRef.current?.isRunning) {
        detectorRef.current.stop();
      }
    };
  }, []);

  // Load model on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        setStatus('loading');
        await detectorRef.current.loadModel();
        setModelLoaded(true);
        setStatus('ready');
      } catch (err) {
        console.error('App: failed to load model', err);
        setError('Failed to load YAMNet model. Check your connection.');
        setStatus('error');
      }
    };
    loadModel();
  }, []);


  // Subscribe to Firestore crisis events
  useEffect(() => {
    const unsubscribe = onCrisisAlert((events) => {
      setCrisisEvents(events);
    });
    return () => unsubscribe();
  }, []);

  // Handle foreground FCM messages
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('App: foreground push received', payload);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Toggle monitoring on/off
  const handleToggle = useCallback(async () => {
    const detector = detectorRef.current;
    if (!detector) return;

    if (detector.isRunning) {
      detector.stop();
      setStatus('ready');
      setLastCrisisClass(null);
    } else {
      if (!roomId) {
        setError('Please select a room before starting.');
        return;
      }
      setError(null);

      try {
        await registerForPush();
      } catch (err) {
        console.warn('App: push registration skipped or failed', err);
      }

      // Wire up callbacks
      detector.onStatus((newStatus) => setStatus(newStatus));

      detector.onCrisis(async (event) => {
        setLastCrisisClass(event.className);

        // Log to Firestore (metadata only — NO audio)
        try {
          await logCrisisEvent(event);
        } catch (err) {
          console.error('App: failed to log crisis', err);
        }

        // Return to listening after 3 seconds
        setTimeout(() => {
          setStatus('listening');
          setLastCrisisClass(null);
        }, 3000);
      });

      try {
        await detector.start(roomId);
      } catch (err) {
        console.error('App: failed to start detection', err);
        setError('Failed to access microphone. Check permissions.');
        setStatus('error');
      }
    }
  }, [roomId]);

  const isListening = status === 'listening' || status === 'crisis';

  return (
    <div className="app">
      <Header modelLoaded={modelLoaded} status={status} />

      <main className="app__content">
        <StatusOrb status={status} crisisClass={lastCrisisClass} />

        <div className="power-section">
          <button
            className={`power-btn ${isListening ? 'power-btn--active' : ''}`}
            onClick={handleToggle}
            disabled={!modelLoaded || status === 'loading'}
            title={isListening ? 'Stop monitoring' : 'Start monitoring'}
          >
            {isListening ? '⏹' : '▶'}
          </button>
        </div>

        <RoomSelector
          roomId={roomId}
          onRoomChange={setRoomId}
          disabled={isListening}
        />

        {error && <div className="error-banner">{error}</div>}

        <StaffAlert events={crisisEvents} />
      </main>
    </div>
  );
}

export default App;
