import React, { useCallback, useRef, useState } from 'react';
import { uploadFile, MediaItem, UploadProgress } from '@/services/mediaService';

const ACCEPTED_IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEOS = ['video/mp4', 'video/mov', 'video/webm', 'video/quicktime'];
const ACCEPTED = [...ACCEPTED_IMAGES, ...ACCEPTED_VIDEOS];
const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_VIDEO = 200 * 1024 * 1024;
const MAX_FILES = 10;

export interface PendingMedia {
  file:      File;
  preview:   string;
  mediaItem: MediaItem | null;
  progress:  number;
  error:     string | null;
  uploading: boolean;
  done:      boolean;
}

interface MediaUploadProps {
  onMediaReady: (items: MediaItem[]) => void;
  maxFiles?:    number;
  accept?:      'images' | 'videos' | 'both';
}

export const MediaUpload: React.FC<MediaUploadProps> = ({
  onMediaReady,
  maxFiles = MAX_FILES,
  accept   = 'both',
}) => {
  const [pending, setPending] = useState<PendingMedia[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = accept === 'images' ? ACCEPTED_IMAGES
                      : accept === 'videos' ? ACCEPTED_VIDEOS
                      : ACCEPTED;

  const validate = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) return `Unsupported format: ${file.type}`;
    if (file.type.startsWith('image/') && file.size > MAX_IMAGE) return 'Image exceeds 20 MB';
    if (file.type.startsWith('video/') && file.size > MAX_VIDEO) return 'Video exceeds 200 MB';
    return null;
  };

  const processFiles = useCallback(async (files: File[]) => {
    const available = maxFiles - pending.length;
    const toProcess = files.slice(0, available);
    if (!toProcess.length) return;

    const newPending: PendingMedia[] = toProcess.map(file => ({
      file,
      preview:   URL.createObjectURL(file),
      mediaItem: null,
      progress:  0,
      error:     validate(file),
      uploading: false,
      done:      false,
    }));

    setPending(prev => {
      const updated = [...prev, ...newPending];
      return updated;
    });

    // Upload valid files
    for (let i = 0; i < toProcess.length; i++) {
      const file  = toProcess[i];
      const error = validate(file);
      if (error) continue;

      const idx = pending.length + i;

      setPending(prev => prev.map((p, j) => j === idx ? { ...p, uploading: true } : p));

      try {
        const mediaItem = await uploadFile(file, (prog: UploadProgress) => {
          setPending(prev => prev.map((p, j) => j === idx ? { ...p, progress: prog.percent } : p));
        });

        setPending(prev => {
          const next = prev.map((p, j) => j === idx ? { ...p, mediaItem, uploading: false, done: true, progress: 100 } : p);
          const ready = next.filter(p => p.done && p.mediaItem).map(p => p.mediaItem!);
          onMediaReady(ready);
          return next;
        });
      } catch (err: any) {
        setPending(prev => prev.map((p, j) => j === idx ? { ...p, uploading: false, error: err.message } : p));
      }
    }
  }, [pending, maxFiles, onMediaReady]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const remove = (idx: number) => {
    setPending(prev => {
      const item = prev[idx];
      URL.revokeObjectURL(item.preview);
      const next = prev.filter((_, i) => i !== idx);
      const ready = next.filter(p => p.done && p.mediaItem).map(p => p.mediaItem!);
      onMediaReady(ready);
      return next;
    });
  };

  const allDone     = pending.length > 0 && pending.every(p => p.done || p.error);
  const anyUploading = pending.some(p => p.uploading);

  return (
    <div className="media-upload">
      {/* Drop zone */}
      {pending.length < maxFiles && (
        <div
          className={`media-upload__zone${dragging ? ' media-upload__zone--active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept={acceptedTypes.join(',')}
            onChange={onInput}
          />
          <div className="media-upload__icon">📁</div>
          <p className="media-upload__hint">
            Drag & drop or <span className="media-upload__browse">browse</span>
          </p>
          <p className="media-upload__sub">
            {accept === 'both'   ? 'Images (JPG, PNG, WebP) · Videos (MP4, MOV, WebM)' :
             accept === 'images' ? 'JPG, PNG, WebP — max 20 MB each' :
                                   'MP4, MOV, WebM — max 200 MB each'}
          </p>
          {maxFiles > 1 && <p className="media-upload__sub">Up to {maxFiles} files</p>}
        </div>
      )}

      {/* Previews */}
      {pending.length > 0 && (
        <div className="media-upload__grid">
          {pending.map((item, idx) => (
            <div key={idx} className={`media-upload__item${item.error ? ' media-upload__item--error' : ''}`}>
              {item.file.type.startsWith('video/') ? (
                <video src={item.preview} className="media-upload__preview" muted />
              ) : (
                <img src={item.preview} className="media-upload__preview" alt="" />
              )}

              {item.uploading && (
                <div className="media-upload__overlay">
                  <div className="media-upload__bar-track">
                    <div className="media-upload__bar-fill" style={{ width: `${item.progress}%` }} />
                  </div>
                  <span className="media-upload__pct">{item.progress}%</span>
                </div>
              )}

              {item.done && (
                <div className="media-upload__done">✓</div>
              )}

              {item.error && (
                <div className="media-upload__err-badge">{item.error}</div>
              )}

              <button
                className="media-upload__remove"
                onClick={e => { e.stopPropagation(); remove(idx); }}
                disabled={item.uploading}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
