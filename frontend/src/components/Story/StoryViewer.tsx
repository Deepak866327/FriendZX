import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Story, StoryGroup, storyService, resolveStoryMediaUrl } from '@/services/storyService';
import { useAuth } from '@/hooks/useAuth';

const STORY_DURATION_MS = 5000;

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  groups: StoryGroup[];
  startGroupIndex: number;
  onClose: () => void;
  onStoryViewed?: (storyId: string) => void;
}

export const StoryViewer: React.FC<Props> = ({ groups, startGroupIndex, onClose, onStoryViewed }) => {
  const { user } = useAuth();
  const [groupIdx, setGroupIdx]   = useState(startGroupIndex);
  const [storyIdx, setStoryIdx]   = useState(0);
  const [progress, setProgress]   = useState(0);
  const [paused, setPaused]       = useState(false);

  const timerRef    = useRef<ReturnType<typeof setInterval>>();
  const startRef    = useRef<number>(Date.now());
  const elapsedRef  = useRef<number>(0);

  const group   = groups[groupIdx];
  const story   = group?.stories[storyIdx];

  // Mark story as viewed
  useEffect(() => {
    if (!story) return;
    storyService.viewStory(story.id);
    onStoryViewed?.(story.id);
  }, [story?.id]);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = elapsedRef.current + (Date.now() - startRef.current);
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) advance();
    }, 50);
  }, []);

  const stopTimer = useCallback(() => {
    elapsedRef.current += Date.now() - startRef.current;
    clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    if (!paused) startTimer();
    return () => clearInterval(timerRef.current);
  }, [storyIdx, groupIdx]);

  useEffect(() => {
    if (paused) stopTimer();
    else startTimer();
  }, [paused]);

  const advance = useCallback(() => {
    elapsedRef.current = 0;
    setProgress(0);
    if (storyIdx < (group?.stories.length ?? 0) - 1) {
      setStoryIdx(i => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(g => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [storyIdx, groupIdx, groups, group, onClose]);

  const retreat = useCallback(() => {
    elapsedRef.current = 0;
    setProgress(0);
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx(g => g - 1);
      setStoryIdx(0);
    }
  }, [storyIdx, groupIdx]);

  const handleAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) retreat();
    else advance();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') retreat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, retreat, onClose]);

  if (!group || !story) return null;

  const isOwn = user?.id === group.userId;
  const displayName = group.firstName ? `${group.firstName} ${group.lastName || ''}`.trim() : group.userId.slice(0, 8);
  const mediaUrl = resolveStoryMediaUrl(story.mediaUrl);

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div
        className="story-viewer"
        onClick={e => e.stopPropagation()}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {/* Progress bars */}
        <div className="story-progress-row">
          {group.stories.map((_, i) => (
            <div key={i} className="story-progress-track">
              <div
                className="story-progress-fill"
                style={{
                  width: i < storyIdx ? '100%' : i === storyIdx ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="story-header">
          <div className="story-user-info">
            <div className="story-avatar-sm">
              {group.photo
                ? <img src={group.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (group.firstName || group.userId).charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>{displayName}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.65)' }}>{timeAgo(story.createdAt)}</div>
            </div>
          </div>
          <button
            className="story-close-btn"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onClose(); }}
          >✕</button>
        </div>

        {/* Click zones */}
        <div className="story-click-zones" onClick={handleAreaClick}>
          <div className="story-zone-left" />
          <div className="story-zone-right" />
        </div>

        {/* Media */}
        {story.mediaType === 'image'
          ? <img src={mediaUrl} className="story-media" alt="story" />
          : <video src={mediaUrl} className="story-media" autoPlay muted={false} playsInline loop={false}
              onEnded={advance} />
        }

        {/* Text overlay */}
        {story.text && (
          <div className="story-text-overlay">
            {story.text}
          </div>
        )}

        {/* View count (own stories only) */}
        {isOwn && (
          <div className="story-views">
            👁 {story.viewCount} {story.viewCount === 1 ? 'view' : 'views'}
          </div>
        )}

        {/* Visibility badge */}
        <div className="story-visibility-badge">
          {story.visibility === 'public' ? '🌐' : story.visibility === 'friends' ? '🔒' : '📍'}
        </div>
      </div>
    </div>
  );
};
