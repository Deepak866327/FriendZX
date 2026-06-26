import React, { useState, useCallback, useRef, useEffect } from 'react';
import postService, { Post } from '@/services/postService';
import { uploadFile, MediaItem, UploadProgress } from '@/services/mediaService';

type Visibility = 'PUBLIC' | 'FRIENDS' | 'NEARBY';

const VIS_OPTS: { key: Visibility; label: string; icon: string; desc: string }[] = [
  { key: 'PUBLIC',  label: 'Public',  icon: '🌐', desc: 'Anyone can see' },
  { key: 'FRIENDS', label: 'Friends', icon: '🔒', desc: 'Your followers only' },
  { key: 'NEARBY',  label: 'Nearby',  icon: '📍', desc: 'People near you' },
];

interface UploadingFile {
  file:    File;
  preview: string;
  pct:     number;
  done:    boolean;
  error:   string;
  media:   MediaItem | null;
}

interface CreatePostModalProps {
  onClose:      () => void;
  onCreated:    (post: Post) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ onClose, onCreated, userLocation }) => {
  // 'pick' = image selection step, 'compose' = caption/visibility step
  const [step,        setStep]       = useState<'pick' | 'compose'>('pick');
  const [files,       setFiles]      = useState<UploadingFile[]>([]);
  const [caption,     setCaption]    = useState('');
  const [visibility,  setVisibility] = useState<Visibility>('PUBLIC');
  const [radius,      setRadius]     = useState(10);
  const [location,    setLocation]   = useState(userLocation ?? null);
  const [submitting,  setSubmitting] = useState(false);
  const [error,       setError]      = useState('');
  const [dragging,    setDragging]   = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const inputRef    = useRef<HTMLInputElement>(null);
  const captionRef  = useRef<HTMLTextAreaElement>(null);

  // Auto-grab location when nearby selected
  useEffect(() => {
    if (visibility === 'NEARBY' && !location) {
      navigator.geolocation?.getCurrentPosition(
        p => setLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => {},
      );
    }
  }, [visibility]);

  // Focus caption when arriving at compose step
  useEffect(() => {
    if (step === 'compose') setTimeout(() => captionRef.current?.focus(), 80);
  }, [step]);

  // Supported MIME types (covers .jpg .jpeg .png .webp)
  const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

  const addFiles = useCallback(async (incoming: File[]) => {
    // Reject unsupported formats with a user-visible error
    const rejected = incoming.filter(f => !ALLOWED.has(f.type.toLowerCase()));
    if (rejected.length) {
      setError(`Unsupported format: ${rejected.map(f => f.name.split('.').pop()?.toUpperCase()).join(', ')}. Use JPG, PNG or WebP.`);
    }
    const valid = incoming.filter(f => ALLOWED.has(f.type.toLowerCase()));
    const slots = 10 - files.length;
    const toAdd = valid.slice(0, slots);
    if (!toAdd.length) return;
    setError('');

    // Snapshot the current length before the state update
    const startIdx = files.length;

    const newItems: UploadingFile[] = toAdd.map(f => ({
      file: f, preview: URL.createObjectURL(f),
      pct: 0, done: false, error: '', media: null,
    }));

    setFiles(prev => [...prev, ...newItems]);

    // Upload each file; use startIdx + i so the index is always correct
    toAdd.forEach((file, i) => {
      const idx = startIdx + i;
      uploadFile(file, (prog: UploadProgress) => {
        setFiles(prev => prev.map((x, j) => j === idx ? { ...x, pct: prog.percent } : x));
      })
        .then(media => setFiles(prev => prev.map((x, j) => j === idx ? { ...x, media, done: true, pct: 100 } : x)))
        .catch(err => setFiles(prev => prev.map((x, j) => j === idx ? { ...x, error: err.message } : x)));
    });
  }, [files.length]);

  const removeFile = (idx: number) => {
    setFiles(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      const next = prev.filter((_, i) => i !== idx);
      setCarouselIdx(Math.min(carouselIdx, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const uploading   = files.some(f => !f.done && !f.error);
  const anyError    = files.some(f => !!f.error);
  const readyMedia  = files.filter(f => f.done && f.media).map(f => f.media!);
  const canContinue = files.length > 0 && !uploading && !anyError;

  const submit = async () => {
    if (!caption.trim() && !readyMedia.length) {
      return setError('Add some text or at least one photo');
    }
    setSubmitting(true);
    setError('');
    try {
      const post = await postService.createPost({
        caption:   caption.trim() || undefined,
        visibility,
        latitude:  visibility === 'NEARBY' ? location?.latitude  : undefined,
        longitude: visibility === 'NEARBY' ? location?.longitude : undefined,
        mediaIds:  readyMedia.map(m => m.id),
      });
      onCreated(post);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const current = files[carouselIdx];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="post-create-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="post-create-modal__header">
          {step === 'compose' ? (
            <button className="btn-text btn-text--secondary" onClick={() => setStep('pick')}>← Back</button>
          ) : (
            <button className="modal-close" onClick={onClose}>✕</button>
          )}

          <h3 className="post-create-modal__title">
            {step === 'pick' ? '📷 New Post' : 'Write your post'}
          </h3>

          {/* Share button lives in header on compose step */}
          {step === 'compose' ? (
            <button
              className="btn-text btn-text--primary"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? 'Sharing…' : 'Share'}
            </button>
          ) : (
            /* Placeholder so title stays centered */
            <span style={{ width: 60 }} />
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════
            STEP 1 — Pick images
        ══════════════════════════════════════════════════════════ */}
        {step === 'pick' && (
          <div className="post-create-modal__body">

            {files.length === 0 ? (
              /* ── Empty state: drop zone ── */
              <div
                className={`post-pick-zone${dragging ? ' post-pick-zone--active' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
              >
                <div className="post-pick-zone__icon">🖼️</div>
                <p className="post-pick-zone__title">Drag photos here</p>
                <p className="post-pick-zone__sub">JPG · PNG · WebP — max 20 MB each · up to 10</p>
                <button type="button" className="post-pick-zone__btn">Select from device</button>
              </div>
            ) : (
              /* ── Images selected: preview stage ── */
              <div className="post-pick-preview">
                {/* Main image stage */}
                <div className="post-pick-preview__stage">
                  {current && (
                    <div className="post-pick-preview__img-wrap">
                      <img src={current.preview} alt="" className="post-pick-preview__img" />

                      {/* Upload progress overlay */}
                      {!current.done && !current.error && (
                        <div className="post-pick-preview__prog-overlay">
                          <div className="post-pick-preview__prog-track">
                            <div className="post-pick-preview__prog-fill" style={{ width: `${current.pct}%` }} />
                          </div>
                          <span className="post-pick-preview__prog-pct">Uploading {current.pct}%</span>
                        </div>
                      )}
                      {current.done && <div className="post-pick-preview__check">✓</div>}
                      {current.error && <div className="post-pick-preview__err">⚠️ {current.error}</div>}
                    </div>
                  )}

                  {files.length > 1 && (
                    <>
                      <button
                        className="post-pick-preview__arrow post-pick-preview__arrow--l"
                        onClick={() => setCarouselIdx(i => Math.max(0, i - 1))}
                        disabled={carouselIdx === 0}
                      >‹</button>
                      <button
                        className="post-pick-preview__arrow post-pick-preview__arrow--r"
                        onClick={() => setCarouselIdx(i => Math.min(files.length - 1, i + 1))}
                        disabled={carouselIdx === files.length - 1}
                      >›</button>
                      <span className="post-pick-preview__counter">{carouselIdx + 1} / {files.length}</span>
                    </>
                  )}
                </div>

                {/* Thumbnail strip */}
                <div className="post-pick-strip">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className={`post-pick-thumb${i === carouselIdx ? ' post-pick-thumb--active' : ''}`}
                      onClick={() => setCarouselIdx(i)}
                    >
                      <img src={f.preview} alt="" />
                      {f.done && <span className="post-pick-thumb__check">✓</span>}
                      {!f.done && !f.error && <span className="post-pick-thumb__pct">{f.pct}%</span>}
                      <button
                        className="post-pick-thumb__del"
                        onClick={e => { e.stopPropagation(); removeFile(i); }}
                      >✕</button>
                    </div>
                  ))}
                  {files.length < 10 && (
                    <button className="post-pick-thumb post-pick-thumb--add" onClick={() => inputRef.current?.click()}>＋</button>
                  )}
                </div>

                {/* ── Prominent Continue button ── */}
                <div className="post-pick-actions">
                  {uploading && (
                    <p className="post-pick-actions__status">
                      Uploading {files.filter(f => !f.done && !f.error).length} photo{files.filter(f => !f.done && !f.error).length > 1 ? 's' : ''}…
                    </p>
                  )}
                  {anyError && (
                    <p className="post-pick-actions__error">Some uploads failed — remove them and try again</p>
                  )}
                  <button
                    className="post-pick-actions__continue"
                    onClick={() => setStep('compose')}
                    disabled={!canContinue}
                  >
                    {uploading ? `Uploading… (${readyMedia.length}/${files.length})` : `Continue with ${readyMedia.length} photo${readyMedia.length !== 1 ? 's' : ''} →`}
                  </button>
                </div>
              </div>
            )}

            {/* ── Text-only shortcut ── */}
            <button
              className="post-pick-text-btn"
              onClick={() => setStep('compose')}
            >
              ✏️ Write a text-only post instead
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ''; }}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP 2 — Compose
        ══════════════════════════════════════════════════════════ */}
        {step === 'compose' && (
          <div className="post-create-modal__body post-create-modal__body--compose">

            {/* Image thumbnail row — only if images were added */}
            {files.filter(f => f.done).length > 0 && (
              <div className="post-compose-thumbs">
                {files.filter(f => f.done).map((f, i) => (
                  <div key={i} className="post-compose-thumb">
                    <img src={f.preview} alt="" />
                  </div>
                ))}
                <button
                  className="post-compose-thumb post-compose-thumb--add"
                  onClick={() => setStep('pick')}
                  title="Edit photos"
                >✎</button>
              </div>
            )}

            {/* Caption — prominent and full-width */}
            <div className="post-caption-wrap">
              <textarea
                ref={captionRef}
                className="post-caption-input"
                placeholder={readyMedia.length ? 'Write a caption…' : 'What\'s on your mind?'}
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={2200}
                rows={readyMedia.length ? 4 : 7}
              />
              <span className="post-caption-count">{caption.length} / 2200</span>
            </div>

            {/* Visibility */}
            <div className="post-vis-section">
              <span className="post-vis-label">Who can see this?</span>
              <div className="post-vis-pills">
                {VIS_OPTS.map(({ key, label, icon, desc }) => (
                  <button
                    key={key}
                    type="button"
                    className={`post-vis-pill${visibility === key ? ' post-vis-pill--active' : ''}`}
                    onClick={() => setVisibility(key)}
                  >
                    <span className="post-vis-pill__icon">{icon}</span>
                    <div className="post-vis-pill__body">
                      <span className="post-vis-pill__label">{label}</span>
                      <span className="post-vis-pill__desc">{desc}</span>
                    </div>
                    {visibility === key && <span className="post-vis-pill__check">✓</span>}
                  </button>
                ))}
              </div>

              {visibility === 'NEARBY' && (
                <div className="post-radius-row">
                  <span className="post-radius-label">
                    Visible within <strong>{radius} km</strong>
                  </span>
                  <input
                    type="range"
                    className="cration-radius-slider"
                    min={1} max={100} step={1}
                    value={radius}
                    onChange={e => setRadius(Number(e.target.value))}
                  />
                  <div className="cration-radius-ticks">
                    <span>1 km</span><span>50 km</span><span>100 km</span>
                  </div>
                  {!location && (
                    <p className="post-create-modal__warn">⚠️ Location access required for nearby posts</p>
                  )}
                </div>
              )}
            </div>

            {error && <p className="form-error" style={{ margin: '0 16px 8px' }}>{error}</p>}

            {/* Bottom share button — visible alternative to header button */}
            <div className="post-compose-footer">
              <button
                className="post-compose-share-btn"
                onClick={submit}
                disabled={submitting || (!caption.trim() && !readyMedia.length)}
              >
                {submitting ? 'Sharing…' : '🚀 Share Post'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
