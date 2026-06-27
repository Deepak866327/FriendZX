import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Check } from 'lucide-react';

const RATIOS = [
  { label: '1:1',    value: 1.0    },
  { label: '4:5',    value: 0.8    },
  { label: '1.91:1', value: 1.91   },
  { label: '9:16',   value: 0.5625 },
];

interface ImageCropperProps {
  src:      string;
  onCrop:   (blob: Blob, ratio: number) => void;
  onCancel: () => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ src, onCrop, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const [ratio, setRatio]     = useState(1.0);
  const [cropX, setCropX]     = useState(0);
  const [cropY, setCropY]     = useState(0);
  const [scale, setScale]     = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, cropX * scale, cropY * scale, img.naturalWidth * scale, img.naturalHeight * scale);
  }, [cropX, cropY, scale]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas  = canvasRef.current!;
      const viewW   = 400;
      const viewH   = Math.round(viewW / ratio);
      canvas.width  = viewW;
      canvas.height = viewH;
      const s       = Math.max(viewW / img.naturalWidth, viewH / img.naturalHeight);
      setScale(s);
      setCropX((viewW - img.naturalWidth  * s) / 2 / s);
      setCropY((viewH - img.naturalHeight * s) / 2 / s);
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const viewW   = 400;
    const viewH   = Math.round(viewW / ratio);
    canvas.width  = viewW;
    canvas.height = viewH;
    const s       = Math.max(viewW / img.naturalWidth, viewH / img.naturalHeight);
    setScale(s);
    setCropX((viewW - img.naturalWidth  * s) / 2 / s);
    setCropY((viewH - img.naturalHeight * s) / 2 / s);
  }, [ratio]);

  useEffect(() => { draw(); }, [draw, cropX, cropY, scale]);

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: cropX, cy: cropY };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setCropX(dragStart.current.cx + (e.clientX - dragStart.current.x) / scale);
    setCropY(dragStart.current.cy + (e.clientY - dragStart.current.y) / scale);
  };

  const onMouseUp = () => setDragging(false);

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => { if (blob) onCrop(blob, ratio); }, 'image/jpeg', 0.92);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Ratio pills */}
      <div className="flex items-center gap-2 justify-center flex-wrap">
        {RATIOS.map(r => {
          const active = ratio === r.value;
          return (
            <button
              key={r.label}
              onClick={() => setRatio(r.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                active
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200/60'
                  : 'glass text-slate-600 hover:bg-white/70'
              }`}
            >
              {active && <Check size={12} />}
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Canvas viewport */}
      <div
        className="relative overflow-hidden rounded-2xl bg-slate-950 mx-auto"
        style={{ cursor: dragging ? 'grabbing' : 'grab', maxWidth: '100%' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <canvas ref={canvasRef} className="block max-w-full" />
      </div>

      <p className="text-center text-xs text-slate-400">Drag to reposition</p>

      {/* Actions */}
      <div className="flex gap-3">
        <button className="btn-secondary flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn-primary flex-1"   onClick={handleCrop}>Apply Crop</button>
      </div>
    </div>
  );
};
