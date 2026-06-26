import React, { useState } from 'react';
import videoRoomService, { VideoRoom } from '@/services/videoRoomService';

interface StartRandomCallModalProps {
  userLocation: { latitude: number; longitude: number } | null;
  displayName: string;
  onClose: () => void;
  onStarted: (room: VideoRoom) => void;
}

export const StartRandomCallModal: React.FC<StartRandomCallModalProps> = ({
  userLocation, displayName, onClose, onStarted,
}) => {
  const [title, setTitle] = useState('');
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async () => {
    if (!userLocation) {
      setError('Location permission required to start a random call');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const room = await videoRoomService.create({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radius,
        title: title.trim() || 'Random Video Chat',
        creatorName: displayName,
      });
      onStarted(room);
    } catch (err: any) {
      setError(err?.message || 'Failed to start video call. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
        <div className="modal__header">
          <h2>📹 Start Random Video Call</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label>Title (optional)</label>
            <input
              type="text"
              placeholder="e.g. Chat with neighbors"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className="form-group">
            <label>
              Visible within <strong>{radius} km</strong>
            </label>
            <input
              type="range"
              className="radius-slider"
              min={1} max={50} step={1}
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
            />
            <div className="radius-slider__labels"><span>1 km</span><span>50 km</span></div>
          </div>

          {!userLocation && (
            <p className="create-post-form__warning">
              Location permission is required for random video calls
            </p>
          )}

          {error && <p className="create-post-form__error">{error}</p>}

          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={loading || !userLocation}
          >
            {loading ? 'Starting…' : '📹 Start Call'}
          </button>
        </div>
      </div>
    </div>
  );
};
