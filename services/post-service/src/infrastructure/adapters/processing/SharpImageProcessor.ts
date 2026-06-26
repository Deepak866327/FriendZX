import sharp from 'sharp';

export interface ImageMeta {
  width:       number;
  height:      number;
  aspectRatio: number;
  format:      string;
}

export interface ProcessedImages {
  thumbnail: Buffer;
  medium:    Buffer;
  full:      Buffer;
  meta:      ImageMeta;
}

const SUPPORTED = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif', 'avif', 'tiff']);

// Instagram-style supported aspect ratios
const SUPPORTED_RATIOS = [
  { ratio: 1.0,    label: '1:1' },
  { ratio: 0.8,    label: '4:5' },
  { ratio: 1.91,   label: '1.91:1' },
  { ratio: 0.5625, label: '9:16' },
];
const MIN_RATIO = 0.5625; // 9:16
const MAX_RATIO = 1.91;   // 1.91:1

export async function processImage(input: Buffer): Promise<ProcessedImages> {
  const img  = sharp(input).rotate(); // auto-rotate from EXIF
  const meta = await img.metadata();

  const rawW = meta.width  || 1;
  const rawH = meta.height || 1;
  const rawRatio = rawW / rawH;

  // Clamp to supported ratio bounds
  const [cropW, cropH] = cropToRatio(rawW, rawH, rawRatio);
  const aspectRatio = parseFloat((cropW / cropH).toFixed(4));

  const base = sharp(input).rotate().extract(cropRegion(rawW, rawH, cropW, cropH)).toFormat('jpeg');

  const [thumbnail, medium, full] = await Promise.all([
    base.clone().resize(300, null, { withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality: 75, mozjpeg: true }).toBuffer(),
    base.clone().resize(720, null, { withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
    base.clone().resize(1080, null, { withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality: 88, mozjpeg: true }).toBuffer(),
  ]);

  return {
    thumbnail,
    medium,
    full,
    meta: { width: cropW, height: cropH, aspectRatio, format: 'jpeg' },
  };
}

export async function getImageMeta(input: Buffer): Promise<ImageMeta> {
  const meta  = await sharp(input).metadata();
  const w     = meta.width  || 1;
  const h     = meta.height || 1;
  return { width: w, height: h, aspectRatio: parseFloat((w / h).toFixed(4)), format: meta.format || 'jpeg' };
}

export function isSupportedImage(mimeType: string): boolean {
  const sub = mimeType.split('/')[1]?.toLowerCase();
  return SUPPORTED.has(sub);
}

// Crop dimensions to the nearest supported Instagram ratio
function cropToRatio(w: number, h: number, ratio: number): [number, number] {
  if (ratio < MIN_RATIO) {
    // Too tall — crop height to 9:16
    return [w, Math.round(w / MIN_RATIO)];
  }
  if (ratio > MAX_RATIO) {
    // Too wide — crop width to 1.91:1
    return [Math.round(h * MAX_RATIO), h];
  }
  return [w, h];
}

function cropRegion(origW: number, origH: number, cropW: number, cropH: number) {
  const left = Math.floor((origW - cropW) / 2);
  const top  = Math.floor((origH - cropH) / 2);
  return { left, top, width: cropW, height: cropH };
}
