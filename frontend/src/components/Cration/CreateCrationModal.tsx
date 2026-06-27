import React, { useState, useRef, useEffect } from 'react';
import { ASPECT_RATIOS, AspectRatioKey } from '@/components/Common/ImageCropper';
import { getApiToken } from '@/services/api';

type Visibility = 'public' | 'friends' | 'nearby';

interface CreateCrationModalProps {
  onClose:   () => void;
  onCreated: () => void;
}

export const CreateCrationModal: React.FC<CreateCrationModalProps> = ({ onClose, onCreated }) => {
  const [caption,      setCaption]      = useState('');
  const [frameAr,      setFrameAr]      = useState<AspectRatioKey>('original');
  const [videoFile,    setVideoFile]    = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbFile,    setThumbFile]    = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [visibility,   setVisibility]   = useState<Visibility>('public');
  const [nearbyRadius, setNearbyRadius] = useState(10);
  const [userLat,      setUserLat]      = useState<number | null>(null);
  const [userLng,      setUserLng]      = useState<number | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [uploadPct,    setUploadPct]    = useState(0);

  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visibility === 'nearby' && userLat == null) {
      navigator.geolocation?.getCurrentPosition(
        (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
        () => {}
      );
    }
  }, [visibility]);

  const handleVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { setError('Please select a video file'); return; }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) { setError('Please select a video'); return; }
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('caption', caption);
      form.append('video', videoFile);
      if (thumbFile) form.append('thumbnail', thumbFile);
      form.append('visibility', visibility);
      if (visibility === 'nearby') {
        form.append('nearbyRadius', String(nearbyRadius));
        if (userLat != null) form.append('latitude',  String(userLat));
        if (userLng != null) form.append('longitude', String(userLng));
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const token = getApiToken() || '';
        xhr.open('POST', '/api/crations');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(JSON.parse(xhr.responseText)?.error || 'Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(form);
      });

      if (videoPreview) URL.revokeObjectURL(videoPreview);
      if (thumbPreview) URL.revokeObjectURL(thumbPreview);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload cration');
    } finally {
      setLoading(false);
      setUploadPct(0);
    }
  };

  const VIS_OPTIONS: { key: Visibility; label: string; icon: string }[] = [
    { key: 'public',  label: 'Public',  icon: '🌐' },
    { key: 'friends', label: 'Friends', icon: '🔒' },
    { key: 'nearby',  label: 'Nearby',  icon: '📍' },
  ];

  return (
    <div className="cration-create-overlay" onClick={onClose}>
      <div className="cration-create-modal" onClick={e => e.stopPropagation()}>
        <div className="cration-create-modal__header">
          <button className="cration-create-modal__close" onClick={onClose}>✕</button>
          <span className="cration-create-modal__title">🎬 New Cration</span>
          <span className="cration-create-modal__subtitle">Share your moment with the world</span>
        </div>

        <form onSubmit={handleSubmit} className="cration-create-modal__body">
          {/* Video picker */}
          {!videoFile ? (
            <div className="cration-video-drop" onClick={() => videoRef.current?.click()}>
              <div className="cration-video-drop__icon">🎥</div>
              <p className="cration-video-drop__title">Tap to select video</p>
              <p className="cration-video-drop__sub">MP4, MOV, WebM · up to 200 MB</p>
              <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideo} />
            </div>
          ) : (
            <>
              {/* Framed video preview */}
              <div className="cration-frame-wrap">
                <div
                  className="cration-frame-viewport"
                  style={{
                    aspectRatio: (() => {
                      const def = ASPECT_RATIOS.find(a => a.key === frameAr)!;
                      return def.w > 0 ? `${def.w}/${def.h}` : 'auto';
                    })(),
                  }}
                >
                  <video
                    src={videoPreview!}
                    controls
                    className="cration-frame-video"
                    style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                  />
                </div>

                {/* Aspect ratio selector */}
                <div className="cration-frame-ratios">
                  {ASPECT_RATIOS.map(({ key, label, icon }) => (
                    <button
                      key={key}
                      type="button"
                      className={`img-cropper__ratio-btn${frameAr === key ? ' active' : ''}`}
                      onClick={() => setFrameAr(key)}
                    >
                      <span className="img-cropper__ratio-icon">{icon}</span>
                      <span className="img-cropper__ratio-label">{label}</span>
                    </button>
                  ))}
                </div>

                <button type="button" className="cration-video-preview__change" onClick={() => videoRef.current?.click()}>
                  Change video
                </button>
              </div>
              <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideo} />
            </>
          )}

          {/* Thumbnail */}
          <div className="cration-thumb-row" onClick={() => thumbRef.current?.click()}>
            {thumbPreview
              ? <img src={thumbPreview} alt="thumb" className="cration-thumb-preview" />
              : <div className="cration-thumb-empty">🖼️ Add cover image <span>(optional)</span></div>
            }
            <input ref={thumbRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleThumb} />
          </div>

          {/* Caption */}
          <div className="cration-caption-wrap">
            <textarea
              className="cration-caption"
              placeholder="Write a caption… #trending ✨"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={3}
              maxLength={300}
            />
            <span className="cration-caption__count">{caption.length}/300</span>
          </div>

          {/* Visibility */}
          <div className="cration-vis-section">
            <span className="cration-vis-label">Who can see this?</span>
            <div className="cration-vis-pills">
              {VIS_OPTIONS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  className={`cration-vis-pill${visibility === key ? ' cration-vis-pill--active' : ''}`}
                  onClick={() => setVisibility(key)}
                >
                  <span className="cration-vis-pill__icon">{icon}</span>
                  <span className="cration-vis-pill__label">{label}</span>
                </button>
              ))}
            </div>

            {visibility === 'nearby' && (
              <div className="cration-radius-row">
                <span className="cration-radius-label">Visible within <strong>{nearbyRadius} km</strong></span>
                <input
                  type="range"
                  className="cration-radius-slider"
                  min={1} max={100} step={1}
                  value={nearbyRadius}
                  onChange={e => setNearbyRadius(Number(e.target.value))}
                />
                <div className="cration-radius-ticks">
                  <span>1 km</span><span>50 km</span><span>100 km</span>
                </div>
              </div>
            )}
          </div>

          {error && <p className="cration-error">{error}</p>}

          {loading && (
            <div className="cration-progress">
              <div className="cration-progress__bar" style={{ width: `${uploadPct}%` }} />
              <span className="cration-progress__label">{uploadPct}%</span>
            </div>
          )}

          <button type="submit" className="cration-submit" disabled={loading || !videoFile}>
            {loading ? 'Uploading…' : '🚀 Share Cration'}
          </button>
        </form>
      </div>
    </div>
  );
};
