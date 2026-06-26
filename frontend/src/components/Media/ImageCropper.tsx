import React, { useEffect, useRef, useState, useCallback } from 'react';

// Supported Instagram aspect ratios
const RATIOS = [
  { label: '1:1',    value: 1.0     },
  { label: '4:5',    value: 0.8     },
  { label: '1.91:1', value: 1.91    },
  { label: '9:16',   value: 0.5625  },
];

interface ImageCropperProps {
  src:      string;
  onCrop:   (blob: Blob, ratio: number) => void;
  onCancel: () => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ src, onCrop, onCancel }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const imgRef       = useRef<HTMLImageElement | null>(null);
  const [ratio, setRatio] = useState(1.0);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart  = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx    = canvas.getContext('2d')!;
    const cw     = canvas.width;
    const ch     = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, cropX * scale, cropY * scale, img.naturalWidth * scale, img.naturalHeight * scale);
  }, [cropX, cropY, scale]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Canvas size: fixed 400px container preserving ratio
      const canvas = canvasRef.current!;
      const viewW  = 400;
      const viewH  = Math.round(viewW / ratio);
      canvas.width  = viewW;
      canvas.height = viewH;
      // Fit image to canvas
      const s = Math.max(viewW / img.naturalWidth, viewH / img.naturalHeight);
      setScale(s);
      setCropX((viewW - img.naturalWidth * s) / 2 / s);
      setCropY((viewH - img.naturalHeight * s) / 2 / s);
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const viewW = 400;
    const viewH = Math.round(viewW / ratio);
    canvas.width  = viewW;
    canvas.height = viewH;
    const s = Math.max(viewW / img.naturalWidth, viewH / img.naturalHeight);
    setScale(s);
    setCropX((viewW - img.naturalWidth * s) / 2 / s);
    setCropY((viewH - img.naturalHeight * s) / 2 / s);
  }, [ratio]);

  useEffect(() => { draw(); }, [draw, cropX, cropY, scale]);

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: cropX, cy: cropY };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragStart.current.x) / scale;
    const dy = (e.clientY - dragStart.current.y) / scale;
    setCropX(dragStart.current.cx + dx);
    setCropY(dragStart.current.cy + dy);
  };

  const onMouseUp = () => setDragging(false);

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => { if (blob) onCrop(blob, ratio); }, 'image/jpeg', 0.92);
  };

  return (
    <div className="img-cropper">
      <div className="img-cropper__ratio-bar">
        {RATIOS.map(r => (
          <button
            key={r.label}
            className={`img-cropper__ratio-btn${ratio === r.value ? ' active' : ''}`}
            onClick={() => setRatio(r.value)}
          >{r.label}</button>
        ))}
      </div>

      <div
        className="img-cropper__canvas-wrap"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <canvas ref={canvasRef} className="img-cropper__canvas" />
      </div>

      <p className="img-cropper__hint">Drag to reposition</p>

      <div className="img-cropper__actions">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary"   onClick={handleCrop}>Apply Crop</button>
      </div>
    </div>
  );
};
