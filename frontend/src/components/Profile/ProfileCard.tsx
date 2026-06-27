import React from 'react';
import { MapPin, Users, UserPlus, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { UserProfile } from '@/types/api';

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

interface ProfileCardProps {
  profile:          UserProfile;
  onFollow?:        () => void;
  onUnfollow?:      () => void;
  isFollowing?:     boolean;
  showFollowButton?: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile, onFollow, onUnfollow, isFollowing = false, showFollowButton = false,
}) => {
  const initial = (profile.userId).charAt(0).toUpperCase();

  return (
    <div className="glass-hover rounded-2xl overflow-hidden">
      {/* Gradient banner */}
      <div
        className="h-16 w-full"
        style={{ background: `linear-gradient(135deg,${avatarGradient(profile.userId).includes('indigo') ? '#6366f1,#8b5cf6' : '#ec4899,#f97316'})` }}
      />

      <div className="px-4 pb-4 -mt-8">
        {/* Avatar + follow row */}
        <div className="flex items-end justify-between mb-3">
          {/* Avatar with gradient ring */}
          <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
            <div
              className="absolute -inset-[2px] rounded-full"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#38bdf8)' }}
            />
            <div
              className={`relative w-full h-full rounded-full overflow-hidden border-[2.5px] border-white ${
                !profile.photos?.[0] ? `bg-gradient-to-br ${avatarGradient(profile.userId)} flex items-center justify-center text-white text-xl font-bold` : ''
              }`}
            >
              {profile.photos?.[0]
                ? <img src={profile.photos[0]} alt="Profile" className="w-full h-full object-cover" />
                : initial}
            </div>
          </div>

          {/* Follow button */}
          {showFollowButton && (
            <motion.button
              onClick={isFollowing ? onUnfollow : onFollow}
              className={`${isFollowing ? 'btn-secondary' : 'btn-primary'} text-xs px-3`}
              style={{ minHeight: 32 }}
              whileTap={{ scale: 0.95 }}
              transition={SPRING}
            >
              {isFollowing
                ? <><UserCheck size={12} /> Following</>
                : <><UserPlus size={12} /> Follow</>
              }
            </motion.button>
          )}
        </div>

        {/* Name */}
        <p className="text-sm font-bold text-slate-800 truncate">{profile.userId}</p>

        {/* Bio */}
        {profile.bio && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{profile.bio}</p>
        )}

        {/* Location */}
        {profile.location && (
          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1.5">
            <MapPin size={10} className="text-indigo-400" />
            {profile.location}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <Users size={12} className="text-indigo-400" />
            <span className="font-bold">{profile.followers ?? 0}</span>
            <span className="text-slate-400">followers</span>
          </div>
          <div className="text-xs text-slate-600">
            <span className="font-bold">{profile.following ?? 0}</span>
            <span className="text-slate-400 ml-1">following</span>
          </div>
        </div>

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {profile.interests.slice(0, 5).map((tag, i) => (
              <span key={i} className="inline-flex items-center px-2 py-[3px] rounded-full text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60">
                {tag}
              </span>
            ))}
            {profile.interests.length > 5 && (
              <span className="inline-flex items-center px-2 py-[3px] rounded-full text-[10px] font-semibold text-slate-500 glass border-white/40">
                +{profile.interests.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Photo grid */}
        {profile.photos && profile.photos.length > 1 && (
          <div className="grid grid-cols-3 gap-1 mt-3 rounded-xl overflow-hidden">
            {profile.photos.slice(1, 4).map((photo, i) => (
              <img key={i} src={photo} alt="" className="aspect-square object-cover w-full" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
