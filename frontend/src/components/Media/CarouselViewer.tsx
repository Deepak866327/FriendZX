import React, { useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PostMediaItem } from '@/services/postService';

interface Props {
  items:     PostMediaItem[];
  maxWidth?: number;
}

export const CarouselViewer: React.FC<Props> = ({ items, maxWidth = 600 }) => {
  const [idx, setIdx]  = useState(0);
  const startX         = useRef(0);
  const isDragging     = useRef(false);
  const sorted = [...items].sort((a, b) => a.order - b.order);

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(sorted.length - 1, i + 1)), [sorted.length]);

  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - startX.current;
    if (delta < -50) next(); else if (delta > 50) prev();
  };
  const onMouseDown = (e: React.MouseEvent) => { startX.current = e.clientX; isDragging.current = true; };
  const onMouseUp   = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = e.clientX - startX.current;
    if (delta < -50) next(); else if (delta > 50) prev();
  };

  if (!sorted.length) return null;
  const current = sorted[idx];
  const media   = current.media;
  const ar  = media.aspectRatio ?? 1;
  const w   = Math.min(maxWidth, typeof window !== 'undefined' ? window.innerWidth : maxWidth);
  const h   = Math.round(w / ar);

  return (
    <div style={{ width: '100%', maxWidth }}>
      <div
        className="relative overflow-hidden rounded-2xl bg-slate-950 cursor-grab active:cursor-grabbing select-none"
        style={{ height: h }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}   onMouseUp={onMouseUp}
      >
        {/* Media */}
        {media.mediaType === 'VIDEO' ? (
          <video
            key={media.id}
            src={media.url}
            poster={media.thumbnailUrl ?? undefined}
            controls playsInline
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : (
          <img
            key={media.id}
            src={media.url}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {/* Prev arrow */}
        {idx > 0 && (
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass-dark flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
            onClick={e => { e.stopPropagation(); prev(); }}
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {/* Next arrow */}
        {idx < sorted.length - 1 && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass-dark flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
            onClick={e => { e.stopPropagation(); next(); }}
            aria-label="Next"
          >
            <ChevronRight size={18} />
          </button>
        )}

        {/* Dot indicators */}
        {sorted.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            {sorted.map((_, i) => (
              <span
                key={i}
                className={`rounded-full transition-all ${i === idx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        )}

        {/* Index badge */}
        {sorted.length > 1 && (
          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full glass-dark text-white text-[10px] font-semibold z-10">
            {idx + 1} / {sorted.length}
          </span>
        )}
      </div>
    </div>
  );
};
