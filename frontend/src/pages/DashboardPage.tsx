import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { NearbyUsers } from '@/components/Location/NearbyUsers';
import { CreatePostModal } from '@/components/Posts/CreatePostModal';
import { CommunityFeed } from '@/components/Community/CommunityFeed';
import { RandomCallCard } from '@/components/VideoRoom/RandomCallCard';
import { VideoRoomModal } from '@/components/VideoRoom/VideoRoomModal';
import { MixedFeed } from '@/components/Posts/MixedFeed';
import { StoryBar } from '@/components/Story/StoryBar';
import crationService, { Cration } from '@/services/crationService';
import { CrationPlayerModal } from '@/components/Cration/CrationPlayerModal';
import { ChatModal } from '@/components/Chat/ChatModal';
import { userService } from '@/services/userService';
import postService from '@/services/postService';
import videoRoomService, { VideoRoom } from '@/services/videoRoomService';
import { Community } from '@/services/communityService';
import { PublicProfile } from '@/types/api';

type FeedTab = 'public' | 'friends' | 'nearby' | 'community';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { nearbyUsers } = useLocation();
  const navigate = useNavigate();

  const [feedTab, setFeedTab] = useState<FeedTab>('public');
  const [refreshKey, setRefreshKey] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [communityPostTarget, setCommunityPostTarget] = useState<Community[] | null>(null);
  const [nearbyRooms, setNearbyRooms] = useState<VideoRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<VideoRoom | null>(null);

  const [sidebarProfiles, setSidebarProfiles] = useState<Record<string, PublicProfile>>({});
  const [addedFriends, setAddedFriends] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<PublicProfile | null>(null);
  const [nearbyModal, setNearbyModal] = useState(false);
  const [selectedCration, setSelectedCration] = useState<Cration | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {}
    );
  }, []);

  useEffect(() => {
    nearbyUsers.slice(0, 5).forEach(u => {
      if (!sidebarProfiles[u.userId]) {
        userService.getPublicProfile(u.userId)
          .then(p => setSidebarProfiles(prev => ({ ...prev, [u.userId]: p })))
          .catch(() => {});
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

  useEffect(() => {
    if (!userLocation) return;
    videoRoomService.getNearby(userLocation.latitude, userLocation.longitude)
      .then(setNearbyRooms)
      .catch(() => {});
  }, [userLocation, feedTab, refreshKey]);

  const displayName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'User' : 'User';

  const handleJoinRoom = useCallback(async (room: VideoRoom) => {
    setActiveRoom(room);
  }, []);

  const publicFetcher  = useCallback((cursor?: string) => postService.getFeed(cursor), []);
  const friendsFetcher = useCallback((cursor?: string) => postService.getFriendsFeed(cursor), []);
  const nearbyFetcher  = useCallback(
    (cursor?: string) => {
      if (!userLocation) return Promise.resolve({ posts: [], nextCursor: null, hasMore: false });
      return postService.getNearbyFeed(userLocation.latitude, userLocation.longitude, 50, cursor);
    },
    [userLocation],
  );

  const publicCrationFetcher  = useCallback((page: number) => crationService.getPublicFeed(page), []);
  const friendsCrationFetcher = useCallback((page: number) => crationService.getFriendsFeed(page), []);
  const nearbyCrationFetcher  = useCallback(
    (page: number) => {
      if (!userLocation) return Promise.resolve({ crations: [], total: 0, page: 1, hasMore: false });
      return crationService.getNearbyFeed(userLocation.latitude, userLocation.longitude, page);
    },
    [userLocation]
  );

  const FEED_TABS: { key: FeedTab; label: string; icon: string }[] = [
    { key: 'public',    label: 'Public',    icon: '🌐' },
    { key: 'friends',   label: 'Friends',   icon: '🔒' },
    { key: 'nearby',    label: 'Nearby',    icon: '📍' },
    { key: 'community', label: 'Community', icon: '🏘️' },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        {/* Feed column */}
        <div className="dashboard-feed">
          <div className="feed-page__header">
            <h1>Home</h1>
          </div>

          {/* Story bar */}
          <StoryBar refreshKey={refreshKey} userLocation={userLocation} />

          <div className="feed-tabs">
            {FEED_TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                className={`feed-tab feed-tab--${key} ${feedTab === key ? 'active' : ''}`}
                onClick={() => setFeedTab(key)}
              >
                <span className="feed-tab__icon">{icon}</span>
                <span className="feed-tab__label">{label}</span>
              </button>
            ))}
          </div>

          <div className="feed-content">
            {feedTab === 'public' && (
              <MixedFeed
                postFetcher={publicFetcher}
                crationFetcher={publicCrationFetcher}
                onOpenCration={setSelectedCration}
                refreshKey={refreshKey}
              />
            )}
            {feedTab === 'friends' && (
              <MixedFeed
                postFetcher={friendsFetcher}
                crationFetcher={friendsCrationFetcher}
                onOpenCration={setSelectedCration}
                refreshKey={refreshKey}
              />
            )}
            {feedTab === 'nearby' && (
              <>
                {nearbyRooms.length > 0 && (
                  <div className="nearby-rooms-section">
                    <div className="nearby-rooms-section__header">
                      <span className="nearby-rooms-section__title">📹 Live Video Calls Nearby</span>
                    </div>
                    {nearbyRooms.map(room => (
                      <RandomCallCard
                        key={room.id}
                        room={room}
                        currentUserId={user?.id}
                        onJoin={handleJoinRoom}
                      />
                    ))}
                  </div>
                )}
                <MixedFeed
                  postFetcher={nearbyFetcher}
                  crationFetcher={nearbyCrationFetcher}
                  onOpenCration={setSelectedCration}
                  refreshKey={refreshKey}
                />
              </>
            )}
            {feedTab === 'community' && (
              <CommunityFeed
                onPostInCommunity={(communities) => setCommunityPostTarget(communities)}
                userLocation={userLocation}
                refreshKey={refreshKey}
              />
            )}
          </div>
        </div>

        {/* Sidebar — desktop only */}
        <div className="dashboard-sidebar">
          {nearbyUsers.length > 0 && (
            <div>
              <div className="sidebar-suggestions-header">
                <span className="sidebar-suggestions-title">Suggested For You</span>
                <button className="sidebar-see-all">See All</button>
              </div>
              {nearbyUsers.slice(0, 5).map(u => {
                const p = sidebarProfiles[u.userId];
                const displayName = p?.firstName
                  ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`
                  : u.userId.slice(0, 10) + '…';
                const initial = (p?.firstName || u.userId).charAt(0).toUpperCase();
                const isFriend = addedFriends.has(u.userId);
                const isAdding = addingId === u.userId;

                return (
                  <div key={u.userId} className="suggested-user">
                    <div className="suggested-avatar">
                      {p?.photos?.[0]
                        ? <img src={p.photos[0]} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : initial}
                    </div>
                    <div className="suggested-info">
                      <div className="suggested-username">{displayName}</div>
                      {p?.username && <div style={{ fontSize: '11px', color: 'var(--ig-secondary)' }}>@{p.username}</div>}
                      <div className="suggested-meta">
                        {u.distance != null ? `${(u.distance / 1000).toFixed(1)}km away` : 'Nearby'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                      <button
                        className="btn btn-sm btn-primary"
                        style={{ fontSize: '11px', padding: '3px 8px', width: 'auto' }}
                        onClick={() => p && setChatTarget(p)}
                        disabled={!p}
                      >
                        💬 Chat
                      </button>
                      <button
                        className={`btn btn-sm ${isFriend ? 'btn-secondary' : 'btn-outline'}`}
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => !isFriend && handleAddFriend(u.userId)}
                        disabled={isFriend || isAdding}
                      >
                        {isAdding ? '…' : isFriend ? '✓ Friend' : '+ Add'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}

      {nearbyModal && (
        <div className="modal-overlay" onClick={() => setNearbyModal(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '80vh', width: '600px' }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--ig-border)',
            }}>
              <span style={{ fontWeight: 700, fontSize: '16px' }}>📍 Nearby Users</span>
              <button className="modal-close" onClick={() => setNearbyModal(false)}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <NearbyUsers />
            </div>
          </div>
        </div>
      )}

      {communityPostTarget && (
        <CreatePostModal
          onClose={() => setCommunityPostTarget(null)}
          onCreated={() => { setRefreshKey(k => k + 1); setCommunityPostTarget(null); }}
          userLocation={userLocation}
        />
      )}

      {activeRoom && (
        <VideoRoomModal
          room={activeRoom}
          currentUserId={user?.id ?? ''}
          displayName={displayName}
          onClose={() => { setActiveRoom(null); setRefreshKey(k => k + 1); }}
        />
      )}

      {selectedCration && (
        <CrationPlayerModal
          cration={selectedCration}
          onClose={() => setSelectedCration(null)}
        />
      )}
    </div>
  );
};
