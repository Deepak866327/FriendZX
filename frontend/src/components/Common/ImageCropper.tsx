import React, { useState, useRef, useEffect, useCallback } from 'react';

export type AspectRatioKey = '1:1' | '4:5' | '16:9' | 'original';

export const ASPECT_RATIOS: { key: AspectRatioKey; label: string; icon: string; w: number; h: number }[] = [
  { key: 'original', label: 'Original', icon: '⬜', w: 0, h: 0 },
  { key: '1:1',      label: 'Square',   icon: '⬛', w: 1, h: 1 },
  { key: '4:5',      label: 'Portrait', icon: '📱', w: 4, h: 5 },
  { key: '16:9',     label: 'Wide',     icon: '🖥️',  w: 16, h: 9 },
];

interface Props {
  file: File;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

export const ImageCropper: React.FC<Props> = ({ file, onCrop, onCancel }) => {
  // Fit inside the modal (90vw, max 520px) and leave room for header + controls + ratios + actions (~240px)
  const CW = Math.min(480, typeof window !== 'undefined' ? window.innerWidth * 0.9 - 32 : 448);
  const MAX_CH = typeof window !== 'undefined' ? Math.max(150, window.innerHeight * 0.9 - 240) : 400;

  const [imgSrc, setImgSrc]   = useState('');
  const [natW, setNatW]       = useState(0);
  const [natH, setNatH]       = useState(0);
  const [ar, setAr]           = useState<AspectRatioKey>('original');
  const [scale, setScale]     = useState(1);   // user zoom multiplier (1 = baseScale)
  const [offset, setOffset]   = useState({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);

  const viewRef    = useRef<HTMLDivElement>(null);
  const dragRef    = useRef({ active: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  const pinchRef   = useRef({ active: false, dist: 0, scaleStart: 1 });

  // Load image blob
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Container height from aspect ratio
  const arDef = ASPECT_RATIOS.find(a => a.key === ar)!;
  const CH = Math.min(
    arDef.w > 0
      ? CW * arDef.h / arDef.w
      : (natW > 0 ? Math.min(CW * natH / natW, CW * 1.5) : CW),
    MAX_CH,
  );

  // baseScale = minimum scale so image covers container (like object-fit: cover)
  const baseScale = natW > 0 ? Math.max(CW / natW, CH / natH) : 1;
  const totalScale = baseScale * scale;

  // Image display size
  const dispW = natW * totalScale;
  const dispH = natH * totalScale;

  // Clamp offset so image always covers container
  const maxX = Math.max(0, (dispW - CW) / 2);
  const maxY = Math.max(0, (dispH - CH) / 2);
  const cx   = Math.max(-maxX, Math.min(maxX, offset.x));
  const cy   = Math.max(-maxY, Math.min(maxY, offset.y));

  // Image top-left in container
  const imgLeft = CW / 2 + cx - dispW / 2;
  const imgTop  = CH / 2 + cy - dispH / 2;

  // Attach non-passive touch events for preventDefault
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        dragRef.current = { active: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY, ox: offset.x, oy: offset.y };
      } else if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        pinchRef.current = { active: true, dist: Math.hypot(dx, dy), scaleStart: scale };
        dragRef.current.active = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragRef.current.active) {
        setOffset({
          x: dragRef.current.ox + (e.touches[0].clientX - dragRef.current.startX),
          y: dragRef.current.oy + (e.touches[0].clientY - dragRef.current.startY),
        });
      } else if (e.touches.length === 2 && pinchRef.current.active) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / pinchRef.current.dist;
        setScale(s => Math.max(1, Math.min(4, pinchRef.current.scaleStart * ratio)));
      }
    };

    const onTouchEnd = () => {
      dragRef.current.active = false;
      pinchRef.current.active = false;
      // Snap offset to clamped value
      setOffset(prev => {
        const maxX2 = Math.max(0, (natW * baseScale * scale - CW) / 2);
        const maxY2 = Math.max(0, (natH * baseScale * scale - CH) / 2);
        return {
          x: Math.max(-maxX2, Math.min(maxX2, prev.x)),
          y: Math.max(-maxY2, Math.min(maxY2, prev.y)),
        };
      });
    };

    el.addEventListener('touchstart',  onTouchStart, { passive: false });
    el.addEventListener('touchmove',   onTouchMove,  { passive: false });
    el.addEventListener('touchend',    onTouchEnd,   { passive: true  });
    return () => {
      el.removeEventListener('touchstart',  onTouchStart);
      el.removeEventListener('touchmove',   onTouchMove);
      el.removeEventListener('touchend',    onTouchEnd);
    };
  }, [offset, scale, natW, natH, baseScale, CW, CH]);

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current.active) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
      y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current.active = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    setOffset(prev => {
      const mx = Math.max(0, (natW * baseScale * scale - CW) / 2);
      const my = Math.max(0, (natH * baseScale * scale - CH) / 2);
      return { x: Math.max(-mx, Math.min(mx, prev.x)), y: Math.max(-my, Math.min(my, prev.y)) };
    });
  }, [onMouseMove, natW, natH, baseScale, scale, CW, CH]);

  // Scroll to zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.max(1, Math.min(4, s + (e.deltaY > 0 ? -0.08 : 0.08))));
  };

  // Change AR: reset zoom + offset
  const changeAr = (key: AspectRatioKey) => {
    setAr(key);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Canvas crop and export
  const handleApply = async () => {
    if (!natW || applying) return;
    setApplying(true);

    // Source rectangle in natural image pixels
    const srcX = Math.max(0, (-imgLeft) / totalScale);
    const srcY = Math.max(0, (-imgTop) / totalScale);
    const srcW = Math.min(natW - srcX, CW / totalScale);
    const srcH = Math.min(natH - srcY, CH / totalScale);

    // Output canvas size (up to 1080 wide)
    const outW = Math.round(Math.min(1080, srcW));
    const outH = Math.round(outW * (srcH / srcW));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;

    const img = new Image();
    img.src = imgSrc;
    await new Promise<void>(res => { img.onload = () => res(); });
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

    canvas.toBlob(blob => {
      setApplying(false);
      if (!blob) { onCrop(file); return; }
      const cropped = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
      onCrop(cropped);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="img-cropper">
      {/* Viewport */}
      <div
        ref={viewRef}
        className="img-cropper__viewport"
        style={{ width: CW, height: CH }}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
      >
        {imgSrc && (
          <img
            src={imgSrc}
            onLoad={e => { setNatW(e.currentTarget.naturalWidth); setNatH(e.currentTarget.naturalHeight); }}
            draggable={false}
            style={{ position: 'absolute', left: imgLeft, top: imgTop, width: dispW, height: dispH, userSelect: 'none', pointerEvents: 'none' }}
          />
        )}
        {/* Rule-of-thirds grid */}
        <div className="img-cropper__grid">
          <div className="img-cropper__grid-h" style={{ top: '33.33%' }} />
          <div className="img-cropper__grid-h" style={{ top: '66.66%' }} />
          <div className="img-cropper__grid-v" style={{ left: '33.33%' }} />
          <div className="img-cropper__grid-v" style={{ left: '66.66%' }} />
        </div>
      </div>

      {/* Zoom slider */}
      <div className="img-cropper__controls">
        <span className="img-cropper__zoom-icon" style={{ fontSize: '12px' }}>🔍−</span>
        <input
          type="range" className="img-cropper__zoom-slider"
          min={1} max={4} step={0.01}
          value={scale}
          onChange={e => setScale(Number(e.target.value))}
        />
        <span className="img-cropper__zoom-icon" style={{ fontSize: '16px' }}>🔍+</span>
      </div>

      {/* Aspect ratio buttons */}
      <div className="img-cropper__ratios">
        {ASPECT_RATIOS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            className={`img-cropper__ratio-btn${ar === key ? ' active' : ''}`}
            onClick={() => changeAr(key)}
          >
            <span className="img-cropper__ratio-icon">{icon}</span>
            <span className="img-cropper__ratio-label">{label}</span>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="img-cropper__actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Skip</button>
        <button type="button" className="btn btn-primary" onClick={handleApply} disabled={applying}>
          {applying ? 'Processing…' : 'Next →'}
        </button>
      </div>
    </div>
  );
};
