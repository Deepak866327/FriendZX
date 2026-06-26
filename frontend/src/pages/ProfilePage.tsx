import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { ProfileEditor } from '@/components/Profile/ProfileEditor';
import { FollowListModal } from '@/components/Profile/FollowListModal';
import { SettingsModal } from '@/components/Profile/SettingsModal';
import { Loading } from '@/components/Common/Loading';
import { CreatePostModal } from '@/components/Posts/CreatePostModal';
import { PostFeed } from '@/components/Posts/PostFeed';
import { CrationCard } from '@/components/Cration/CrationCard';
import { CreateCrationModal } from '@/components/Cration/CreateCrationModal';
import { userService } from '@/services/userService';
import postService from '@/services/postService';
import crationService, { Cration } from '@/services/crationService';
import communityService from '@/services/communityService';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { profile, isLoading, fetchProfile } = useUser();
  const [activeTab, setActiveTab] = useState<'posts' | 'cration' | 'tagged'>('posts');
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [postRefreshKey, setPostRefreshKey] = useState(0);
  const [showCreateCration, setShowCreateCration] = useState(false);
  const [crations, setCrations] = useState<Cration[]>([]);
  const [crationPage, setCrationPage] = useState(1);
  const [crationHasMore, setCrationHasMore] = useState(true);
  const [crationLoading, setCrationLoading] = useState(false);
  const [activeCration, setActiveCration] = useState<Cration | null>(null);
  const [uploading, setUploading] = useState(false);
  const [communityCount, setCommunityCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
    communityService.getMine().then(c => setCommunityCount(c.length)).catch(() => {});
    if (user?.id) {
      postService.getUserPosts(user.id, undefined, 1).then(r => setPostCount(r.posts.length)).catch(() => {});
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {}
      );
    }
  }, [fetchProfile]);

  const myPostsFetcher = useCallback(
    (cursor?: string) => {
      if (!user?.id) return Promise.resolve({ posts: [], nextCursor: null, hasMore: false });
      return postService.getUserPosts(user.id, cursor);
    },
    [user?.id],
  );

  const loadCrations = useCallback(async (page: number, reset = false) => {
    if (!user?.id) return;
    setCrationLoading(true);
    try {
      const res = await crationService.getUserCrations(user.id, page);
      setCrations(prev => reset ? res.crations : [...prev, ...res.crations]);
      setCrationHasMore(res.hasMore);
      setCrationPage(page);
    } catch { /* silent */ }
    finally { setCrationLoading(false); }
  }, [user?.id]);

  const handleDeleteCration = useCallback(async (id: string) => {
    try {
      await crationService.remove(id);
      setCrations(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete cration');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'cration' && crations.length === 0) loadCrations(1, true);
  }, [activeTab]);

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await userService.uploadPhoto(file);
      await fetchProfile();
    } catch (err) {
      console.error('Photo upload failed', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return <Loading message="Loading profile..." />;
  }

  const initial = user?.firstName?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="profile-page">
      {/* Profile Header */}
      <div className="profile-header-section">
        <div className="profile-pic-wrapper">
          <div
            className="profile-pic"
            onClick={handlePhotoClick}
            style={{ cursor: 'pointer', position: 'relative' }}
            title="Change profile photo"
          >
            <div className="profile-pic-inner">
              {profile?.photos && profile.photos.length > 0 ? (
                <img src={profile.photos[0]} alt="Profile" />
              ) : (
                initial
              )}
            </div>
            {/* Camera overlay */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: uploading ? 1 : 0,
              transition: 'opacity 0.2s',
              fontSize: uploading ? '12px' : '20px',
              color: 'white', fontWeight: 600,
            }}
              onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
              onMouseLeave={e => { if (!uploading) (e.currentTarget as HTMLDivElement).style.opacity = '0'; }}
            >
              {uploading ? 'Uploading…' : '📷'}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />
        </div>

        <div className="profile-info-section">
          <div className="profile-username-row">
            <div>
              <h2 className="profile-username">
                {user?.firstName} {user?.lastName}
              </h2>
              {user?.username && (
                <p style={{ fontSize: '13px', color: 'var(--ig-secondary)', margin: '2px 0 0', fontWeight: 500 }}>
                  @{user.username}
                </p>
              )}
            </div>
            <button className="btn btn-secondary btn-sm">Edit Profile</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Post</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSettings(true)}>⚙</button>
          </div>

          <div className="profile-stats-row">
            <div className="profile-stat" onClick={() => setActiveTab('posts')} style={{ cursor: 'pointer' }}>
              <strong>{postCount}</strong>
              <span>posts</span>
            </div>
            <div
              className="profile-stat"
              onClick={() => setFollowModal('following')}
              style={{ cursor: 'pointer' }}
            >
              <strong>{(profile as any)?.friends ?? 0}</strong>
              <span>friends</span>
            </div>
            <div
              className="profile-stat"
              onClick={() => setFollowModal('followers')}
              style={{ cursor: 'pointer' }}
            >
              <strong>{profile?.followers ?? 0}</strong>
              <span>followers</span>
            </div>
            <div className="profile-stat">
              <strong>{communityCount}</strong>
              <span>communities</span>
            </div>
          </div>

          <div className="profile-bio">
            <strong>{user?.firstName} {user?.lastName}</strong>
            {user?.username && <span style={{ marginLeft: '6px', fontSize: '13px', color: 'var(--ig-secondary)', fontWeight: 500 }}>@{user.username}</span>}
            {profile?.bio && <p style={{ marginTop: '4px' }}>{profile.bio}</p>}
            {profile?.location && (
              <p className="profile-location-text">📍 {profile.location}</p>
            )}
          </div>

          {profile?.interests && profile.interests.length > 0 && (
            <div className="interests-tags" style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {profile.interests.map((interest, idx) => (
                <span key={idx} className="tag">{interest}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profile Tabs */}
      <div className="profile-tabs">
        <button
          className={`profile-tab${activeTab === 'posts' ? ' active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          ⊞ POSTS
        </button>
        <button
          className={`profile-tab${activeTab === 'cration' ? ' active' : ''}`}
          onClick={() => setActiveTab('cration')}
        >
          🎬 CREATION
        </button>
        <button
          className={`profile-tab${activeTab === 'tagged' ? ' active' : ''}`}
          onClick={() => setActiveTab('tagged')}
        >
          🏷️ TAGGED
        </button>
      </div>

      {/* Tab Content */}
      <div className="profile-content">
        {activeTab === 'posts' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <PostFeed fetcher={myPostsFetcher} refreshKey={postRefreshKey} />
          </div>
        )}

        {activeTab === 'cration' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="profile-cration-header">
              <span className="profile-cration-title">My Creations</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreateCration(true)}
              >
                + New Creation
              </button>
            </div>

            {crationLoading && crations.length === 0 ? (
              <div className="feed-loading">Loading creations…</div>
            ) : crations.length === 0 ? (
              <div className="profile-cration-empty">
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎬</div>
                <p>No creations yet. Share your first video!</p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '12px' }}
                  onClick={() => setShowCreateCration(true)}
                >
                  + New Creation
                </button>
              </div>
            ) : (
              <>
                <div className="profile-cration-grid">
                  {crations.map(c => (
                    <CrationCard
                      key={c.id}
                      cration={c}
                      onClick={() => setActiveCration(c)}
                      onDelete={handleDeleteCration}
                    />
                  ))}
                </div>
                {crationHasMore && (
                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={crationLoading}
                      onClick={() => loadCrations(crationPage + 1)}
                    >
                      {crationLoading ? 'Loading…' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'tagged' && (
          <div className="profile-edit" style={{ gridColumn: '1 / -1' }}>
            <ProfileEditor />
          </div>
        )}
      </div>

      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setPostRefreshKey(k => k + 1); setPostCount(c => c + 1); }}
          userLocation={userLocation}
        />
      )}

      {showCreateCration && (
        <CreateCrationModal
          onClose={() => setShowCreateCration(false)}
          onCreated={() => { setShowCreateCration(false); loadCrations(1, true); }}
        />
      )}

      {activeCration && (
        <div className="modal-overlay" onClick={() => setActiveCration(null)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ padding: 0, maxWidth: '480px', width: '100%', background: '#000', borderRadius: '12px', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setActiveCration(null)}>✕</button>
            </div>
            <video
              src={activeCration.videoUrl.startsWith('http') ? activeCration.videoUrl : `/api/crations/uploads/${activeCration.videoUrl.split('/').pop()}`}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '70vh', display: 'block' }}
            />
            {activeCration.caption && (
              <div style={{ padding: '12px 16px', color: '#fff', fontSize: '14px' }}>
                {activeCration.caption}
              </div>
            )}
          </div>
        </div>
      )}

      {followModal && (
        <FollowListModal
          type={followModal}
          onClose={() => setFollowModal(null)}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};
