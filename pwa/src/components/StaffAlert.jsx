import { useEffect, useRef } from 'react';
import './StaffAlert.css';

/**
 * StaffAlert — scrollable feed of recent crisis events.
 * Shows crisis type, room, confidence, and time.
 */
export default function StaffAlert({ events }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current && events.length > 0) {
      listRef.current.scrollTop = 0;
    }
  }, [events]);

  const getIcon = (className) => {
    if (!className) return '⚠️';
    const lower = className.toLowerCase();
    if (lower.includes('scream')) return '🗣️';
    if (lower.includes('glass')) return '🔨';
    if (lower.includes('gunshot') || lower.includes('gunfire')) return '💥';
    return '⚠️';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '—';

    // Handle Firestore timestamps
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (!events || events.length === 0) {
    return (
      <div className="staff-alert staff-alert--empty">
        <p className="staff-alert__empty-text">No alerts yet.</p>
        <p className="staff-alert__empty-sub">
          Crisis events will appear here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="staff-alert" ref={listRef}>
      <h3 className="staff-alert__title">🚨 Recent Alerts</h3>
      <div className="staff-alert__list">
        {events.map((event, index) => (
          <div
            key={event.id || index}
            className={`alert-card ${index === 0 ? 'alert-card--new' : ''}`}
          >
            <div className="alert-card__icon">{getIcon(event.className)}</div>
            <div className="alert-card__content">
              <div className="alert-card__header">
                <span className="alert-card__class">{event.className}</span>
                <span className="alert-card__confidence">
                  {(event.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="alert-card__meta">
                <span className="alert-card__room">Room {event.roomId}</span>
                <span className="alert-card__time">
                  {formatTime(event.timestamp || event.localTimestamp)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
