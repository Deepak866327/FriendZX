import React, { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerListVariants, staggerItemVariants } from '@/utils/animations';
import { storyService, StoryGroup, resolveStoryMediaUrl } from '@/services/storyService';
import { useAuth } from '@/hooks/useAuth';
import { StoryViewer } from './StoryViewer';
import { StoryCreator } from './StoryCreator';

interface Props {
  refreshKey?: number;
  userLocation?: { latitude: number; longitude: number } | null;
}

/* ── Ring wrapper — gradient for unseen, gray for seen, dashed for none ── */
const Ring: React.FC<{
  state: 'active' | 'seen' | 'none';
  children: React.ReactNode;
}> = ({ state, children }) => {
  if (state === 'active') {
    return (
      <div
        className="p-[2.5px] rounded-full flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 55%, #f97316 100%)' }}
      >
        <div className="p-[2px] bg-white rounded-full">{children}</div>
      </div>
    );
  }
  if (state === 'seen') {
    return (
      <div className="p-[2.5px] rounded-full bg-slate-200 flex-shrink-0">
        <div className="p-[2px] bg-white rounded-full">{children}</div>
      </div>
    );
  }
  return (
    <div className="p-[2px] rounded-full border-2 border-dashed border-slate-300 flex-shrink-0">
      {children}
    </div>
  );
};

/* ── Single story circle ── */
const StoryCircle: React.FC<{
  src?: string;
  initial: string;
  gradient: string;
  label: string;
  ringState: 'active' | 'seen' | 'none';
  badge?: React.ReactNode;
  onClick: () => void;
}> = ({ src, initial, gradient, label, ringState, badge, onClick }) => (
  <motion.div
    className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0"
    variants={staggerItemVariants}
    onClick={onClick}
    whileTap={{ scale: 0.92 }}
    transition={{ type: 'spring', damping: 20, stiffness: 400 }}
  >
    <div className="relative">
      <Ring state={ringState}>
        <div
          className={`w-[54px] h-[54px] rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br ${gradient}`}
        >
          {src
            ? <img src={src} alt="" className="w-full h-full object-cover" />
            : initial}
        </div>
      </Ring>

      {badge && (
        <div className="absolute -bottom-0.5 -right-0.5">{badge}</div>
      )}
    </div>

    <span className="text-[10px] font-medium text-slate-500 truncate w-[62px] text-center leading-tight">
      {label}
    </span>
  </motion.div>
);

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-500',
  'from-pink-500 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
];

function pickGradient(uid: string) {
  const n = (uid.charCodeAt(0) ?? 0) + (uid.charCodeAt(uid.length - 1) ?? 0);
  return GRADIENTS[n % GRADIENTS.length];
}

export const StoryBar: React.FC<Props> = ({ refreshKey, userLocation }) => {
  const { user } = useAuth();
  const [groups, setGroups]         = useState<StoryGroup[]>([]);
  const [viewGroupIdx, setViewGroupIdx] = useState<number | null>(null);
  const [showCreator, setShowCreator]   = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const data = await storyService.getFeed(userLocation?.latitude, userLocation?.longitude);
      setGroups(data);
    } catch { /* silent */ }
  }, [userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => { loadFeed(); }, [loadFeed, refreshKey]);

  const myGroup    = groups.find(g => g.userId === user?.id);
  const hasMyStory = !!myGroup && myGroup.stories.length > 0;

  const handleMyCircle = () => {
    if (hasMyStory) {
      const idx = groups.findIndex(g => g.userId === user?.id);
      setViewGroupIdx(idx);
    } else {
      setShowCreator(true);
    }
  };

  const handleStoryViewed = (storyId: string) => {
    setGroups(prev => prev.map(g => ({
      ...g,
      stories: g.stories.map(s => s.id === storyId ? { ...s, viewers: [...(s.viewers || []), user?.id || ''] } : s),
      hasUnseen: g.stories.some(s => s.id !== storyId && !(s.viewers || []).includes(user?.id || '')),
    })));
  };

  if (!user) return null;

  const myRingState = hasMyStory
    ? (myGroup?.hasUnseen ? 'active' : 'seen')
    : 'none';

  return (
    <>
      <motion.div
        className="flex gap-3 overflow-x-auto pb-3 mb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        variants={staggerListVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ── My story circle ── */}
        <StoryCircle
          src={user.profilePicture || undefined}
          initial={(user.firstName || '?').charAt(0).toUpperCase()}
          gradient="from-indigo-500 to-violet-600"
          label="Your story"
          ringState={myRingState}
          badge={
            !hasMyStory ? (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
              >
                <Plus size={11} strokeWidth={3} />
              </div>
            ) : undefined
          }
          onClick={handleMyCircle}
        />

        {/* ── Other users' stories ── */}
        {groups
          .filter(g => g.userId !== user?.id && g.stories.length > 0)
          .map(group => {
            const idx = groups.indexOf(group);
            const displayName = group.firstName ? group.firstName : group.userId.slice(0, 6);
            const ringState: 'active' | 'seen' = group.hasUnseen ? 'active' : 'seen';

            return (
              <StoryCircle
                key={group.userId}
                src={group.photo || undefined}
                initial={(group.firstName || group.userId).charAt(0).toUpperCase()}
                gradient={pickGradient(group.userId)}
                label={displayName}
                ringState={ringState}
                onClick={() => setViewGroupIdx(idx)}
              />
            );
          })}
      </motion.div>

      {viewGroupIdx !== null && (
        <StoryViewer
          groups={groups}
          startGroupIndex={viewGroupIdx}
          onClose={() => { setViewGroupIdx(null); loadFeed(); }}
          onStoryViewed={handleStoryViewed}
        />
      )}

      {showCreator && (
        <StoryCreator
          userLocation={userLocation}
          onCreated={() => { setShowCreator(false); loadFeed(); }}
          onClose={() => setShowCreator(false)}
        />
      )}
    </>
  );
};
