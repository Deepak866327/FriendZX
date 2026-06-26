import React, { useRef, useState } from 'react';
import { storyService } from '@/services/storyService';

interface Props {
  userLocation?: { latitude: number; longitude: number } | null;
  onCreated: () => void;
  onClose: () => void;
  // Pre-loaded media from share flow
  initialMediaUrl?: string;
  initialMediaType?: 'image' | 'video';
}

const VIS_OPTIONS = [
  { value: 'public',  label: 'Public',       icon: '🌐', desc: 'Everyone can see' },
  { value: 'friends', label: 'Friends only',  icon: '🔒', desc: 'Followers only' },
  { value: 'nearby',  label: 'Nearby',        icon: '📍', desc: 'People close to you' },
] as const;

export const StoryCreator: React.FC<Props> = ({ userLocation, onCreated, onClose, initialMediaUrl, initialMediaType }) => {
  const [file, setFile]               = useState<File | null>(null);
  // Pre-load from share flow
  const [preview, setPreview]         = useState<string>(initialMediaUrl || '');
  const [previewType, setPreviewType] = useState<'image' | 'video'>(initialMediaType || 'image');
  const [text, setText]               = useState('');
  const [visibility, setVisibility]   = useState<'public' | 'friends' | 'nearby'>('public');
  const [nearbyRadius, setNearbyRadius] = useState(5);
  const [uploading, setUploading]     = useState(false);
  const [progress, setProgress]       = useState(0);
  const [error, setError]             = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      setError('Only images and videos are allowed');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setPreviewType(f.type.startsWith('video/') ? 'video' : 'image');
    setError('');
  };

  const handlePost = async () => {
    // If no local file but we have a pre-loaded URL, fetch it as a blob
    let mediaFile = file;
    if (!mediaFile && preview) {
      try {
        const resp = await fetch(preview);
        const blob = await resp.blob();
        const ext  = previewType === 'video' ? '.mp4' : '.jpg';
        mediaFile  = new File([blob], `shared${ext}`, { type: blob.type || (previewType === 'video' ? 'video/mp4' : 'image/jpeg') });
      } catch {
        setError('Failed to load media from source');
        return;
      }
    }
    if (!mediaFile) return;
    setUploading(true);
    setError('');
    try {
      await storyService.createStory({
        media: mediaFile,
        text: text.trim(),
        visibility,
        nearbyRadius: visibility === 'nearby' ? nearbyRadius : undefined,
        latitude:  userLocation?.latitude,
        longitude: userLocation?.longitude,
      }, setProgress);
      if (preview && !initialMediaUrl) URL.revokeObjectURL(preview);
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to post story');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="story-creator-overlay" onClick={onClose}>
      <div className="story-creator" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="story-creator__header">
          <button className="story-creator__close" onClick={onClose}>✕</button>
          <span className="story-creator__title">New Story</span>
          <button
            className="btn btn-primary"
            style={{ padding: '6px 18px', fontSize: '13px' }}
            disabled={(!file && !preview) || uploading}
            onClick={handlePost}
          >
            {uploading ? `${progress}%` : 'Share'}
          </button>
        </div>

        {/* Media picker */}
        {!preview ? (
          <div className="story-media-picker" onClick={() => fileRef.current?.click()}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Add photo or video</div>
            <div style={{ fontSize: '12px', opacity: 0.6 }}>Tap to select from your gallery</div>
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFile} />
          </div>
        ) : (
          <div className="story-preview-wrap">
            {previewType === 'image'
              ? <img src={preview} className="story-preview-media" alt="preview" />
              : <video src={preview} className="story-preview-media" controls muted playsInline />
            }
            <button className="story-preview-change" onClick={() => { setFile(null); setPreview(''); if (preview) URL.revokeObjectURL(preview); }}>
              Change
            </button>
          </div>
        )}

        {/* Text overlay */}
        <div className="story-creator__section">
          <textarea
            className="story-text-input"
            placeholder="Add a caption…"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={200}
            rows={2}
          />
        </div>

        {/* Visibility */}
        <div className="story-creator__section">
          <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--ig-secondary)' }}>WHO CAN SEE THIS</div>
          <div className="story-vis-options">
            {VIS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`story-vis-btn${visibility === opt.value ? ' active' : ''}`}
                onClick={() => setVisibility(opt.value)}
              >
                <span className="story-vis-icon">{opt.icon}</span>
                <div>
                  <div className="story-vis-label">{opt.label}</div>
                  <div className="story-vis-desc">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {visibility === 'nearby' && (
            <div style={{ marginTop: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Visible within <strong>{nearbyRadius} km</strong>
              </label>
              <input type="range" min={1} max={50} step={1} value={nearbyRadius}
                onChange={e => setNearbyRadius(Number(e.target.value))}
                style={{ width: '100%', marginTop: '4px', accentColor: 'var(--ig-blue)' }}
              />
            </div>
          )}
        </div>

        {error && <p style={{ color: '#ef4444', fontSize: '13px', padding: '0 16px 8px', margin: 0 }}>{error}</p>}
      </div>
    </div>
  );
};
