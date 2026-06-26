import React from 'react';
import { VideoRoom } from '@/services/videoRoomService';

interface RandomCallCardProps {
  room: VideoRoom;
  currentUserId?: string;
  onJoin: (room: VideoRoom) => void;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just started';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export const RandomCallCard: React.FC<RandomCallCardProps> = ({ room, currentUserId, onJoin }) => {
  const isInRoom = room.participants.includes(currentUserId ?? '');
  const count = room.participants.length;

  return (
    <div className="random-call-card">
      <div className="random-call-card__live-dot" />
      <div className="random-call-card__body">
        <div className="random-call-card__title">{room.title}</div>
        <div className="random-call-card__meta">
          <span>📍 within {room.radius} km</span>
          <span className="random-call-card__dot">·</span>
          <span>{timeAgo(room.createdAt)}</span>
          <span className="random-call-card__dot">·</span>
          <span>{count} {count === 1 ? 'person' : 'people'}</span>
        </div>
        <div className="random-call-card__creator">
          Started by <strong>{room.creatorName || 'Someone nearby'}</strong>
        </div>
      </div>
      <button
        className={`btn btn-sm ${isInRoom ? 'btn-secondary' : 'btn-primary'} random-call-card__join-btn`}
        onClick={() => onJoin(room)}
      >
        {isInRoom ? 'Rejoin' : 'Join 📹'}
      </button>
    </div>
  );
};
