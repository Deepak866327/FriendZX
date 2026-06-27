import React from 'react';
import { MapPin, Users, Video } from 'lucide-react';
import { VideoRoom } from '@/services/videoRoomService';

interface Props {
  room:           VideoRoom;
  currentUserId?: string;
  onJoin:         (room: VideoRoom) => void;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just started';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export const RandomCallCard: React.FC<Props> = ({ room, currentUserId, onJoin }) => {
  const isInRoom = room.participants.includes(currentUserId ?? '');
  const count    = room.participants.length;

  return (
    <div className="glass-hover rounded-2xl p-4 flex items-center gap-3">
      {/* Live indicator */}
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center flex-shrink-0 relative">
        <Video size={18} className="text-rose-500" />
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-white" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{room.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
            <MapPin size={9} className="text-indigo-400" /> within {room.radius} km
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-200 flex-shrink-0" />
          <span className="text-[11px] text-slate-400">{timeAgo(room.createdAt)}</span>
          <span className="w-1 h-1 rounded-full bg-slate-200 flex-shrink-0" />
          <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
            <Users size={9} /> {count}
          </span>
        </div>
        {room.creatorName && (
          <p className="text-[11px] text-slate-400 mt-0.5">
            by <span className="font-medium text-slate-600">{room.creatorName}</span>
          </p>
        )}
      </div>

      {/* Join */}
      <button
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 transition-all"
        style={
          isInRoom
            ? { background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', color: '#6366f1', border: '1.5px solid rgba(99,102,241,0.3)' }
            : { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff' }
        }
        onClick={() => onJoin(room)}
      >
        <Video size={13} />
        {isInRoom ? 'Rejoin' : 'Join'}
      </button>
    </div>
  );
};
