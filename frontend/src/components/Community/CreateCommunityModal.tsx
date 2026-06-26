import React, { useState, useRef } from 'react';
import communityService, { CreateCommunityPayload, Community } from '@/services/communityService';

interface CreateCommunityModalProps {
  onClose:   () => void;
  onCreated: (c: Community) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

export const CreateCommunityModal: React.FC<CreateCommunityModalProps> = ({
  onClose, onCreated, userLocation,
}) => {
  const [name,         setName]         = useState('');
  const [description,  setDescription]  = useState('');
  const [mode,         setMode]         = useState<'public' | 'private'>('public');
  const [visibility,   setVisibility]   = useState<'public' | 'nearby'>('public');
  const [nearbyRadius, setNearbyRadius] = useState(10);
  const [coverFile,    setCoverFile]    = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Community name is required'); return; }
    if (mode === 'public' && visibility === 'nearby' && !userLocation) {
      setError('Location permission is required for nearby visibility');
      return;
    }

    const payload: CreateCommunityPayload = {
      name:        name.trim(),
      description: description.trim(),
      mode,
      coverImage:  coverFile || undefined,
    };

    if (mode === 'public') {
      payload.visibility = visibility;
      if (visibility === 'nearby' && userLocation) {
        payload.nearbyRadius = nearbyRadius;
        payload.latitude     = userLocation.latitude;
        payload.longitude    = userLocation.longitude;
      }
    }

    setLoading(true);
    setError('');
    try {
      const community = await communityService.create(payload);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      onCreated(community);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create community');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop create-community-modal" onClick={onClose}>
      <div className="modal modal-backdrop__inner" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>✨ Create Community</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="create-community-form">
          <div className="create-community-form__body">
            {/* Cover image */}
            <div
              className="create-community-form__cover-upload"
              onClick={() => fileRef.current?.click()}
            >
              {coverPreview
                ? <img src={coverPreview} alt="Cover" />
                : <span>📷 Add cover image</span>
              }
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverChange} />
            </div>

            <div className="form-group">
              <label>Community Name *</label>
              <input
                type="text"
                placeholder="Give your community a name…"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={80}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="What is this community about?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Mode */}
            <div className="form-group">
              <label>Community Mode</label>
              <div className="community-mode-options">
                <button
                  type="button"
                  className={`community-mode-btn${mode === 'public' ? ' active' : ''}`}
                  onClick={() => setMode('public')}
                >
                  <span className="community-mode-btn__icon">🌐</span>
                  <span className="community-mode-btn__label">Public</span>
                  <span className="community-mode-btn__desc">Anyone can find & join</span>
                </button>
                <button
                  type="button"
                  className={`community-mode-btn${mode === 'private' ? ' active' : ''}`}
                  onClick={() => setMode('private')}
                >
                  <span className="community-mode-btn__icon">🔒</span>
                  <span className="community-mode-btn__label">Private</span>
                  <span className="community-mode-btn__desc">Admin adds members only</span>
                </button>
              </div>
            </div>

            {/* Visibility — only for public mode */}
            {mode === 'public' && (
              <div className="form-group">
                <label>Visibility</label>
                <div className="visibility-options" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button
                    type="button"
                    className={`visibility-btn${visibility === 'public' ? ' active' : ''}`}
                    onClick={() => setVisibility('public')}
                  >
                    🌐 Public
                  </button>
                  <button
                    type="button"
                    className={`visibility-btn${visibility === 'nearby' ? ' active' : ''}`}
                    onClick={() => setVisibility('nearby')}
                  >
                    📍 Nearby
                  </button>
                </div>

                {visibility === 'nearby' && (
                  <div className="create-post-form__radius" style={{ marginTop: '10px' }}>
                    <label>
                      Visible within <strong>{nearbyRadius} km</strong>
                    </label>
                    <input
                      type="range"
                      className="radius-slider"
                      min={0.5} max={100} step={0.5}
                      value={nearbyRadius}
                      onChange={e => setNearbyRadius(Number(e.target.value))}
                    />
                    <div className="radius-slider__labels"><span>0.5 km</span><span>100 km</span></div>
                    {!userLocation && (
                      <p className="create-post-form__warning">
                        Location permission is required for nearby visibility
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="create-post-form__error">{error}</p>}
          </div>

          <div className="create-post-form__footer">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Community'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
