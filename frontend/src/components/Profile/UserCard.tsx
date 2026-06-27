import React from 'react';
import { MapPin, UserPlus, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { NearbyUser } from '@/types/api';
import { formatDistance } from '@/utils/helpers';

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-500',
  'from-pink-500 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
];
function avatarGradient(uid: string) {
  const n = uid.charCodeAt(0) + uid.charCodeAt(uid.length - 1);
  return GRADIENTS[n % GRADIENTS.length];
}

const SPRING = { type: 'spring', damping: 20, stiffness: 400 } as const;

interface UserCardProps {
  user:            NearbyUser;
  onViewProfile?:  () => void;
  onFollow?:       () => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onViewProfile, onFollow }) => {
  const initial = user.userId.charAt(0).toUpperCase();

  return (
    <div className="glass-hover rounded-2xl p-3.5 flex items-center gap-3">
      {/* Avatar */}
      <div
        className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(user.userId)} flex items-center justify-center text-white text-sm font-bold ring-2 ring-white flex-shrink-0`}
      >
        {initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          User {user.userId.slice(0, 8)}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {user.distance != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-[2px] rounded-full">
              <MapPin size={8} />{formatDistance(user.distance)}
            </span>
          )}
          {user.address && (
            <span className="text-[11px] text-slate-400 truncate">{user.address}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onViewProfile && (
          <motion.button
            onClick={onViewProfile}
            className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-indigo-600 glass transition-colors"
            whileTap={{ scale: 0.85 }}
            transition={SPRING}
            aria-label="View profile"
          >
            <Eye size={14} />
          </motion.button>
        )}
        {onFollow && (
          <motion.button
            onClick={onFollow}
            className="btn-primary text-[11px] px-2.5 h-8 rounded-xl"
            whileTap={{ scale: 0.9 }}
            transition={SPRING}
          >
            <UserPlus size={12} /> Follow
          </motion.button>
        )}
      </div>
    </div>
  );
};
