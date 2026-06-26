import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export interface VideoMeta {
  width:       number;
  height:      number;
  aspectRatio: number;
  duration:    number;
  codec:       string;
}

export interface ProcessedVideo {
  p480:      Buffer;
  p720:      Buffer;
  p1080:     Buffer | null;
  thumbnail: Buffer;
  meta:      VideoMeta;
}

export function isSupportedVideo(mimeType: string): boolean {
  return ['video/mp4', 'video/mov', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(mimeType);
}

export async function getVideoMeta(inputPath: string): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(err);
      const stream = data.streams.find(s => s.codec_type === 'video');
      if (!stream) return reject(new Error('No video stream found'));
      const w = stream.width  || 1280;
      const h = stream.height || 720;
      resolve({
        width:       w,
        height:      h,
        aspectRatio: parseFloat((w / h).toFixed(4)),
        duration:    parseFloat(String(data.format.duration || 0)),
        codec:       stream.codec_name || 'h264',
      });
    });
  });
}

export async function processVideo(inputBuffer: Buffer, mimeType: string): Promise<ProcessedVideo> {
  const tmpDir = os.tmpdir();
  const ext    = mimeType === 'video/webm' ? 'webm' : 'mp4';
  const inFile = path.join(tmpDir, `${randomUUID()}.${ext}`);

  await fs.promises.writeFile(inFile, inputBuffer);

  try {
    const meta = await getVideoMeta(inFile);

    const [p480, p720, p1080, thumbnail] = await Promise.all([
      transcodeVideo(inFile, 480, meta),
      transcodeVideo(inFile, 720, meta),
      meta.height >= 1080 ? transcodeVideo(inFile, 1080, meta) : Promise.resolve(null),
      extractThumbnail(inFile),
    ]);

    return { p480, p720, p1080, thumbnail, meta };
  } finally {
    await fs.promises.unlink(inFile).catch(() => {});
  }
}

async function transcodeVideo(
  inputPath: string,
  targetHeight: number,
  meta: VideoMeta,
): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const outFile = path.join(tmpDir, `${randomUUID()}.mp4`);

  // Scale maintaining aspect ratio, ensure dimensions divisible by 2
  const scale = targetHeight / meta.height;
  const outW   = Math.round(meta.width * scale / 2) * 2;
  const outH   = Math.round(targetHeight / 2) * 2;

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .size(`${outW}x${outH}`)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        `-crf ${targetHeight >= 1080 ? 22 : 26}`,
        '-preset fast',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .output(outFile)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  const buf = await fs.promises.readFile(outFile);
  await fs.promises.unlink(outFile).catch(() => {});
  return buf;
}

async function extractThumbnail(inputPath: string): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const thumbFile = path.join(tmpDir, `${randomUUID()}.jpg`);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['00:00:01'],
        filename:   path.basename(thumbFile),
        folder:     path.dirname(thumbFile),
        size:       '300x?',
      })
      .on('end',   resolve)
      .on('error', reject);
  });

  const buf = await fs.promises.readFile(thumbFile);
  await fs.promises.unlink(thumbFile).catch(() => {});
  return buf;
}
