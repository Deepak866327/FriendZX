import React, { useEffect, useState, useCallback } from 'react';
import { MessageCircle, Phone, Video, UserPlus, UserCheck, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerListVariants, staggerItemVariants } from '@/utils/animations';
import { useLocation } from '@/hooks/useLocation';
import { formatDistance } from '@/utils/helpers';
import { PublicProfile } from '@/types/api';
import { userService } from '@/services/userService';
import { ChatModal } from '@/components/Chat/ChatModal';
import { UserProfileModal } from '@/components/Profile/UserProfileModal';
import { useCallContext } from '@/context/CallContext';

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

export const NearbyUsers: React.FC = () => {
  const { nearbyUsers, getNearbyUsers, isLoading } = useLocation();
  const { initiateCall } = useCallContext();
  const [profiles,      setProfiles]      = useState<Record<string, PublicProfile>>({});
  const [addedFriends,  setAddedFriends]  = useState<Set<string>>(new Set());
  const [chatTarget,    setChatTarget]    = useState<PublicProfile | null>(null);
  const [addingId,      setAddingId]      = useState<string | null>(null);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  useEffect(() => {
    getNearbyUsers();
    const interval = setInterval(() => getNearbyUsers(), 60000);
    return () => clearInterval(interval);
  }, [getNearbyUsers]);

  useEffect(() => {
    nearbyUsers.forEach(u => {
      if (!profiles[u.userId]) {
        userService.getPublicProfile(u.userId)
          .then(p => setProfiles(prev => ({ ...prev, [u.userId]: p })))
          .catch(() => {
            setProfiles(prev => ({
              ...prev,
              [u.userId]: { userId: u.userId, interests: [], photos: [], followers: 0, following: 0 },
            }));
          });
      }
    });
  }, [nearbyUsers]);

  const handleAddFriend = useCallback(async (userId: string) => {
    setAddingId(userId);
    try {
      await userService.addFriend(userId);
      setAddedFriends(prev => new Set(prev).add(userId));
    } catch (err: any) {
      if (err?.response?.data?.error?.includes('Already following')) {
        setAddedFriends(prev => new Set(prev).add(userId));
      }
    } finally {
      setAddingId(null);
    }
  }, []);

  const getDisplayName = (p: PublicProfile) =>
    p.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : p.userId.slice(0, 10) + '…';

  const getInitial = (p: PublicProfile) =>
    (p.firstName || p.userId).charAt(0).toUpperCase();

  /* Loading skeleton */
  if (isLoading && nearbyUsers.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className="skeleton w-12 h-12 rounded-full flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="skeleton h-3 rounded-full w-1/2" />
              <div className="skeleton h-2.5 rounded-full w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* Empty state */
  if (nearbyUsers.length === 0) {
    return (
      <div className="glass rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
          <Users size={26} className="text-indigo-300" />
        </div>
        <div>
          <p className="font-semibold text-slate-700 mb-1">No one nearby yet</p>
          <p className="text-sm text-slate-400">Start location tracking to discover people around you.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        className="flex flex-col gap-3"
        variants={staggerListVariants}
        initial="hidden"
        animate="visible"
      >
        {nearbyUsers.map(u => {
          const profile  = profiles[u.userId];
          const isFriend = addedFriends.has(u.userId);
          const isAdding = addingId === u.userId;
          const initial  = profile ? getInitial(profile) : u.userId.charAt(0).toUpperCase();

          return (
            <motion.div key={u.userId} variants={staggerItemVariants} className="glass-hover rounded-2xl p-4 flex items-center gap-3">
              {/* Avatar */}
              <button
                className="flex-shrink-0 relative"
                onClick={() => setViewProfileId(u.userId)}
                aria-label="View profile"
              >
                {profile?.photos?.[0] ? (
                  <img
                    src={profile.photos[0]}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-avatar"
                  />
                ) : (
                  <div
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradient(u.userId)} flex items-center justify-center text-white font-bold text-base border-2 border-white shadow-avatar`}
                  >
                    {initial}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
              </button>

              {/* Info */}
              <button
                className="flex-1 min-w-0 text-left"
                onClick={() => setViewProfileId(u.userId)}
              >
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {profile ? getDisplayName(profile) : u.userId.slice(0, 10) + '…'}
                </p>
                {profile?.username && (
                  <p className="text-xs text-slate-400">@{profile.username}</p>
                )}
                <p className="text-xs text-indigo-500 font-medium mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  {formatDistance(u.distance)}
                </p>
                {profile?.bio && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{profile.bio}</p>
                )}
              </button>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button
                  onClick={() => profile && setChatTarget(profile)}
                  disabled={!profile}
                  className="btn-icon w-8 h-8 rounded-lg text-indigo-500 hover:bg-indigo-50 disabled:opacity-40"
                  title="Chat"
                >
                  <MessageCircle size={16} />
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => profile && initiateCall(profile, 'audio')}
                    disabled={!profile}
                    className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-violet-500 hover:bg-violet-50 disabled:opacity-40"
                    title="Audio call"
                  >
                    <Phone size={14} />
                  </button>
                  <button
                    onClick={() => profile && initiateCall(profile, 'video')}
                    disabled={!profile}
                    className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-sky-500 hover:bg-sky-50 disabled:opacity-40"
                    title="Video call"
                  >
                    <Video size={14} />
                  </button>
                </div>
                <button
                  onClick={() => !isFriend && handleAddFriend(u.userId)}
                  disabled={isFriend || isAdding}
                  className={`btn-icon w-8 h-8 rounded-lg disabled:opacity-60 ${
                    isFriend
                      ? 'text-emerald-500 bg-emerald-50'
                      : 'text-slate-500 hover:text-emerald-500 hover:bg-emerald-50'
                  }`}
                  title={isFriend ? 'Friend' : 'Add friend'}
                >
                  {isAdding
                    ? <span className="text-[10px]">…</span>
                    : isFriend
                      ? <UserCheck size={15} />
                      : <UserPlus size={15} />}
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
      {viewProfileId && (
        <UserProfileModal userId={viewProfileId} onClose={() => setViewProfileId(null)} />
      )}
    </>
  );
};
