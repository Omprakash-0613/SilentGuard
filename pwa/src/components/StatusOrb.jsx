import { useState, useEffect } from 'react';
import './StatusOrb.css';

/**
 * StatusOrb — pulsing circle indicating detection status.
 * green = listening | red = crisis detected | gray = inactive
 */
export default function StatusOrb({ status, crisisClass }) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (status !== 'crisis') {
      const resetTimer = setTimeout(() => setAnimating(false), 0);
      return () => clearTimeout(resetTimer);
    }

    const startTimer = setTimeout(() => setAnimating(true), 0);
    const stopTimer = setTimeout(() => setAnimating(false), 3000);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(stopTimer);
    };
  }, [status, crisisClass]);

  const getColor = () => {
    switch (status) {
      case 'listening': return 'orb--green';
      case 'crisis': return 'orb--red';
      case 'loading': return 'orb--amber';
      default: return 'orb--gray';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'listening': return 'Monitoring';
      case 'crisis': return crisisClass || 'Crisis Detected';
      case 'loading': return 'Loading Model…';
      case 'ready': return 'Ready';
      case 'error': return 'Error';
      default: return 'Inactive';
    }
  };

  return (
    <div className="orb-container">
      <div className={`orb ${getColor()} ${animating ? 'orb--pulse-alert' : ''}`}>
        <div className="orb__inner" />
      </div>
      <p className="orb__label">{getLabel()}</p>
      {status === 'crisis' && crisisClass && (
        <p className="orb__crisis-class">⚠️ {crisisClass}</p>
      )}
    </div>
  );
}
