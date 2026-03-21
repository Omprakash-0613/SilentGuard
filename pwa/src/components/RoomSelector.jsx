import { useState, useEffect } from 'react';
import './RoomSelector.css';

const PRESET_ROOMS = ['101', '102', '201', '202', '301', 'Lobby', 'Pool', 'Gym'];

/**
 * RoomSelector — dropdown/input for setting the room ID.
 * Persists selection to localStorage.
 */
export default function RoomSelector({ roomId, onRoomChange, disabled }) {
  const [customRoom, setCustomRoom] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('silentguard_room_id');
    if (saved && !roomId) {
      onRoomChange(saved);
    }
  }, []);

  const handleSelect = (room) => {
    onRoomChange(room);
    localStorage.setItem('silentguard_room_id', room);
    setCustomRoom('');
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customRoom.trim()) {
      handleSelect(customRoom.trim());
    }
  };

  return (
    <div className="room-selector">
      <label className="room-selector__label">📍 Room Assignment</label>
      <div className="room-selector__presets">
        {PRESET_ROOMS.map((room) => (
          <button
            key={room}
            className={`room-btn ${roomId === room ? 'room-btn--active' : ''}`}
            onClick={() => handleSelect(room)}
            disabled={disabled}
          >
            {room}
          </button>
        ))}
      </div>
      <form className="room-selector__custom" onSubmit={handleCustomSubmit}>
        <input
          type="text"
          placeholder="Custom room…"
          value={customRoom}
          onChange={(e) => setCustomRoom(e.target.value)}
          disabled={disabled}
          className="room-input"
        />
        <button type="submit" disabled={disabled || !customRoom.trim()} className="room-btn room-btn--submit">
          Set
        </button>
      </form>
      {roomId && (
        <p className="room-selector__current">
          Current: <strong>{roomId}</strong>
        </p>
      )}
    </div>
  );
}
