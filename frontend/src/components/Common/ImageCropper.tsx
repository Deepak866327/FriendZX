import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Square, Smartphone, Monitor, Check } from 'lucide-react';

export type AspectRatioKey = '1:1' | '4:5' | '16:9' | 'original';

export const ASPECT_RATIOS: { key: AspectRatioKey; label: string; icon: string; w: number; h: number }[] = [
  { key: 'original', label: 'Original', icon: 'original', w: 0,  h: 0 },
  { key: '1:1',      label: 'Square',   icon: 'square',   w: 1,  h: 1 },
  { key: '4:5',      label: 'Portrait', icon: 'portrait', w: 4,  h: 5 },
  { key: '16:9',     label: 'Wide',     icon: 'wide',     w: 16, h: 9 },
];

const AR_ICONS: Record<AspectRatioKey, React.ReactNode> = {
  'original': <Maximize2  size={15} />,
  '1:1':      <Square     size={15} />,
  '4:5':      <Smartphone size={15} />,
  '16:9':     <Monitor    size={15} />,
};

interface Props {
  file: File;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

export const ImageCropper: React.FC<Props> = ({ file, onCrop, onCancel }) => {
  const CW     = Math.min(480, typeof window !== 'undefined' ? window.innerWidth * 0.9 - 32 : 448);
  const MAX_CH = typeof window !== 'undefined' ? Math.max(150, window.innerHeight * 0.9 - 240) : 400;

  const [imgSrc, setImgSrc]     = useState('');
  const [natW, setNatW]         = useState(0);
  const [natH, setNatH]         = useState(0);
  const [ar, setAr]             = useState<AspectRatioKey>('original');
  const [scale, setScale]       = useState(1);
  const [offset, setOffset]     = useState({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);

  const viewRef  = useRef<HTMLDivElement>(null);
  const dragRef  = useRef({ active: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  const pinchRef = useRef({ active: false, dist: 0, scaleStart: 1 });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const arDef = ASPECT_RATIOS.find(a => a.key === ar)!;
  const CH = Math.min(
    arDef.w > 0
      ? CW * arDef.h / arDef.w
      : (natW > 0 ? Math.min(CW * natH / natW, CW * 1.5) : CW),
    MAX_CH,
  );

  const baseScale  = natW > 0 ? Math.max(CW / natW, CH / natH) : 1;
  const totalScale = baseScale * scale;
  const dispW      = natW * totalScale;
  const dispH      = natH * totalScale;
  const maxX       = Math.max(0, (dispW - CW) / 2);
  const maxY       = Math.max(0, (dispH - CH) / 2);
  const cx         = Math.max(-maxX, Math.min(maxX, offset.x));
  const cy         = Math.max(-maxY, Math.min(maxY, offset.y));
  const imgLeft    = CW / 2 + cx - dispW / 2;
  const imgTop     = CH / 2 + cy - dispH / 2;

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
        const dx   = e.touches[1].clientX - e.touches[0].clientX;
        const dy   = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        setScale(s => Math.max(1, Math.min(4, pinchRef.current.scaleStart * (dist / pinchRef.current.dist))));
      }
    };

    const onTouchEnd = () => {
      dragRef.current.active  = false;
      pinchRef.current.active = false;
      setOffset(prev => {
        const mx = Math.max(0, (natW * baseScale * scale - CW) / 2);
        const my = Math.max(0, (natH * baseScale * scale - CH) / 2);
        return { x: Math.max(-mx, Math.min(mx, prev.x)), y: Math.max(-my, Math.min(my, prev.y)) };
      });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true  });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [offset, scale, natW, natH, baseScale, CW, CH]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
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
    window.removeEventListener('mouseup',   onMouseUp);
    setOffset(prev => {
      const mx = Math.max(0, (natW * baseScale * scale - CW) / 2);
      const my = Math.max(0, (natH * baseScale * scale - CH) / 2);
      return { x: Math.max(-mx, Math.min(mx, prev.x)), y: Math.max(-my, Math.min(my, prev.y)) };
    });
  }, [onMouseMove, natW, natH, baseScale, scale, CW, CH]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.max(1, Math.min(4, s + (e.deltaY > 0 ? -0.08 : 0.08))));
  };

  const changeAr = (key: AspectRatioKey) => {
    setAr(key);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleApply = async () => {
    if (!natW || applying) return;
    setApplying(true);

    const srcX = Math.max(0, (-imgLeft) / totalScale);
    const srcY = Math.max(0, (-imgTop)  / totalScale);
    const srcW = Math.min(natW - srcX, CW / totalScale);
    const srcH = Math.min(natH - srcY, CH / totalScale);
    const outW = Math.round(Math.min(1080, srcW));
    const outH = Math.round(outW * (srcH / srcW));

    const canvas = document.createElement('canvas');
    canvas.width  = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.src = imgSrc;
    await new Promise<void>(res => { img.onload = () => res(); });
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

    canvas.toBlob(blob => {
      setApplying(false);
      if (!blob) { onCrop(file); return; }
      onCrop(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Viewport */}
      <div
        ref={viewRef}
        className="relative overflow-hidden rounded-2xl bg-slate-950 select-none"
        style={{ width: CW, height: CH, cursor: 'grab', touchAction: 'none', flexShrink: 0 }}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
      >
        {imgSrc && (
          <img
            src={imgSrc}
            onLoad={e => { setNatW(e.currentTarget.naturalWidth); setNatH(e.currentTarget.naturalHeight); }}
            draggable={false}
            style={{ position: 'absolute', left: imgLeft, top: imgTop, width: dispW, height: dispH, userSelect: 'none', pointerEvents: 'none' }}
            alt=""
          />
        )}

        {/* Rule-of-thirds grid */}
        <div className="absolute inset-0 pointer-events-none">
          {/* horizontal lines */}
          <div className="absolute w-full h-px bg-white/25" style={{ top: '33.33%' }} />
          <div className="absolute w-full h-px bg-white/25" style={{ top: '66.66%' }} />
          {/* vertical lines */}
          <div className="absolute h-full w-px bg-white/25" style={{ left: '33.33%' }} />
          <div className="absolute h-full w-px bg-white/25" style={{ left: '66.66%' }} />
          {/* corner brackets */}
          <div className="absolute inset-0 ring-1 ring-white/20 rounded-2xl" />
        </div>
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3 px-1">
        <ZoomOut size={16} className="text-slate-400 flex-shrink-0" />
        <input
          type="range"
          className="fx-slider flex-1"
          min={1} max={4} step={0.01}
          value={scale}
          onChange={e => setScale(Number(e.target.value))}
        />
        <ZoomIn size={16} className="text-slate-400 flex-shrink-0" />
      </div>

      {/* Aspect ratio pills */}
      <div className="flex items-center gap-2 justify-center flex-wrap">
        {ASPECT_RATIOS.map(({ key, label }) => {
          const active = ar === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => changeAr(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                active
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200/60'
                  : 'glass text-slate-600 hover:bg-white/70'
              }`}
            >
              {active ? <Check size={12} /> : AR_ICONS[key]}
              {label}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel}>
          Skip
        </button>
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={handleApply}
          disabled={applying}
        >
          {applying
            ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            : 'Next →'
          }
        </button>
      </div>
    </div>
  );
};
