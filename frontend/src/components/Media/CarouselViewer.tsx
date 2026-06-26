import React, { useState, useRef, useCallback } from 'react';
import { PostMediaItem } from '@/services/postService';

interface CarouselViewerProps {
  items:    PostMediaItem[];
  maxWidth?: number;
}

export const CarouselViewer: React.FC<CarouselViewerProps> = ({ items, maxWidth = 600 }) => {
  const [idx, setIdx]       = useState(0);
  const startX              = useRef(0);
  const isDragging          = useRef(false);
  const sorted = [...items].sort((a, b) => a.order - b.order);

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(sorted.length - 1, i + 1)), [sorted.length]);

  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - startX.current;
    if (delta < -50) next();
    else if (delta > 50) prev();
  };

  const onMouseDown = (e: React.MouseEvent) => { startX.current = e.clientX; isDragging.current = true; };
  const onMouseUp   = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = e.clientX - startX.current;
    if (delta < -50) next();
    else if (delta > 50) prev();
  };

  if (!sorted.length) return null;
  const current = sorted[idx];
  const media   = current.media;

  // Compute container height from aspect ratio
  const ar  = media.aspectRatio ?? 1;
  const w   = Math.min(maxWidth, typeof window !== 'undefined' ? window.innerWidth : maxWidth);
  const h   = Math.round(w / ar);

  return (
    <div className="carousel" style={{ width: '100%', maxWidth }}>
      <div
        className="carousel__stage"
        style={{ height: h, position: 'relative', overflow: 'hidden', borderRadius: 8, background: '#000', cursor: 'grab', userSelect: 'none' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
      >
        {media.mediaType === 'VIDEO' ? (
          <video
            key={media.id}
            src={media.url}
            poster={media.thumbnailUrl ?? undefined}
            controls
            playsInline
            className="carousel__media"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <img
            key={media.id}
            src={media.url}
            alt=""
            className="carousel__media"
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        )}

        {/* Prev / Next */}
        {idx > 0 && (
          <button className="carousel__arrow carousel__arrow--left" onClick={e => { e.stopPropagation(); prev(); }}>‹</button>
        )}
        {idx < sorted.length - 1 && (
          <button className="carousel__arrow carousel__arrow--right" onClick={e => { e.stopPropagation(); next(); }}>›</button>
        )}

        {/* Dot counter */}
        {sorted.length > 1 && (
          <div className="carousel__dots">
            {sorted.map((_, i) => (
              <span key={i} className={`carousel__dot${i === idx ? ' carousel__dot--active' : ''}`} />
            ))}
          </div>
        )}

        {/* Index badge */}
        {sorted.length > 1 && (
          <span className="carousel__badge">{idx + 1} / {sorted.length}</span>
        )}
      </div>
    </div>
  );
};
