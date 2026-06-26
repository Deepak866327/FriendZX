import React, { useEffect, useState, useCallback } from 'react';
import { storyService, StoryGroup, resolveStoryMediaUrl } from '@/services/storyService';
import { useAuth } from '@/hooks/useAuth';
import { StoryViewer } from './StoryViewer';
import { StoryCreator } from './StoryCreator';

interface Props {
  refreshKey?: number;
  userLocation?: { latitude: number; longitude: number } | null;
}

export const StoryBar: React.FC<Props> = ({ refreshKey, userLocation }) => {
  const { user } = useAuth();
  const [groups, setGroups]           = useState<StoryGroup[]>([]);
  const [viewGroupIdx, setViewGroupIdx] = useState<number | null>(null);
  const [showCreator, setShowCreator] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const data = await storyService.getFeed(userLocation?.latitude, userLocation?.longitude);
      setGroups(data);
    } catch { /* silent */ }
  }, [userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => { loadFeed(); }, [loadFeed, refreshKey]);

  const myGroup  = groups.find(g => g.userId === user?.id);
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

  const othersWithStories = groups.filter(g => g.userId !== user?.id && g.stories.length > 0);
  if (!user) return null; // always show if authenticated (lets user create their first story)

  return (
    <>
      <div className="story-bar">
        {/* Current user's circle */}
        <div className="story-circle-wrap" onClick={handleMyCircle}>
          <div className={`story-ring ${hasMyStory ? (myGroup?.hasUnseen ? 'story-ring--active' : 'story-ring--seen') : 'story-ring--none'}`}>
            <div className="story-circle">
              {user?.profilePicture
                ? <img src={user.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user?.firstName || '?').charAt(0).toUpperCase()}
            </div>
          </div>
          {!hasMyStory && (
            <div className="story-add-badge">+</div>
          )}
          <div className="story-circle-label">Your story</div>
        </div>

        {/* Other users */}
        {groups
          .filter(g => g.userId !== user?.id && g.stories.length > 0)
          .map((group) => {
            const idx = groups.indexOf(group);
            const displayName = group.firstName ? group.firstName : group.userId.slice(0, 6);
            const latestStory = group.stories[0];
            const hasThumb = latestStory?.mediaType === 'image';
            const thumbUrl = hasThumb ? resolveStoryMediaUrl(latestStory.mediaUrl) : undefined;

            return (
              <div key={group.userId} className="story-circle-wrap" onClick={() => setViewGroupIdx(idx)}>
                <div className={`story-ring ${group.hasUnseen ? 'story-ring--active' : 'story-ring--seen'}`}>
                  <div className="story-circle story-circle--other">
                    {group.photo
                      ? <img src={group.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (group.firstName || group.userId).charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="story-circle-label">{displayName}</div>
              </div>
            );
          })}
      </div>

      {/* Viewer */}
      {viewGroupIdx !== null && (
        <StoryViewer
          groups={groups}
          startGroupIndex={viewGroupIdx}
          onClose={() => { setViewGroupIdx(null); loadFeed(); }}
          onStoryViewed={handleStoryViewed}
        />
      )}

      {/* Creator */}
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
