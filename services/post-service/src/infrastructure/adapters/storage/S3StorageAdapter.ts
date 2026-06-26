import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';

export type StorageType = 'images' | 'videos' | 'thumbnails';

export interface PresignedConfig {
  mediaId:       string;
  key:           string;
  uploadUrl:     string;
  uploadMethod:  'PUT' | 'POST';
  uploadHeaders: Record<string, string>;
  isLocal:       boolean;
  expiresAt:     string;
}

export class S3StorageAdapter {
  private readonly useLocal: boolean;
  private readonly bucket:   string;
  private readonly region:   string;
  private readonly localDir: string;
  private readonly cdnBase:  string;
  private s3?: S3Client;

  constructor() {
    this.useLocal = !process.env.AWS_ACCESS_KEY_ID;
    this.bucket   = process.env.AWS_S3_BUCKET  || 'freindz-media';
    this.region   = process.env.AWS_REGION     || 'ap-south-1';
    this.localDir = process.env.UPLOADS_DIR    || path.join(process.cwd(), 'uploads');
    this.cdnBase  = process.env.CDN_BASE_URL   || '';

    if (!this.useLocal) {
      this.s3 = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
    }
  }

  buildKey(userId: string, type: StorageType, mimeType: string): string {
    const sub = mimeType.split('/')[1]?.toLowerCase() || 'bin';
    // Normalise all JPEG variants to .jpg; pjpeg is progressive JPEG
    const ext = (sub === 'jpeg' || sub === 'pjpeg') ? 'jpg' : sub;
    return `users/${userId}/${type}/${randomUUID()}.${ext}`;
  }

  async generatePresignedPutUrl(
    mediaId: string,
    key: string,
    mimeType: string,
  ): Promise<PresignedConfig> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    if (this.useLocal) {
      return {
        mediaId,
        key,
        uploadUrl:     `/media/local-upload/${encodeURIComponent(key)}`,
        uploadMethod:  'PUT',
        uploadHeaders: { 'Content-Type': mimeType },
        isLocal:       true,
        expiresAt,
      };
    }

    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType });
    const url  = await getSignedUrl(this.s3!, cmd, { expiresIn: 900 });

    return {
      mediaId,
      key,
      uploadUrl:     url,
      uploadMethod:  'PUT',
      uploadHeaders: { 'Content-Type': mimeType },
      isLocal:       false,
      expiresAt,
    };
  }

  async getBuffer(key: string): Promise<Buffer> {
    if (this.useLocal) {
      const filePath = path.join(this.localDir, ...key.split('/'));
      return fs.promises.readFile(filePath);
    }
    const cmd      = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.s3!.send(cmd);
    return streamToBuffer(response.Body as Readable);
  }

  async uploadBuffer(buffer: Buffer, key: string, mimeType: string): Promise<void> {
    if (this.useLocal) {
      const filePath = path.join(this.localDir, ...key.split('/'));
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, buffer);
      return;
    }
    await this.s3!.send(new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
    }));
  }

  async saveLocalUpload(key: string, data: Buffer): Promise<void> {
    const filePath = path.join(this.localDir, ...key.split('/'));
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, data);
  }

  async exists(key: string): Promise<boolean> {
    if (this.useLocal) {
      const filePath = path.join(this.localDir, ...key.split('/'));
      return fs.existsSync(filePath);
    }
    try {
      await this.s3!.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    if (this.useLocal) {
      const filePath = path.join(this.localDir, ...key.split('/'));
      await fs.promises.unlink(filePath).catch(() => {});
      return;
    }
    await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => {});
  }

  getPublicUrl(key: string): string {
    if (this.useLocal) return `/media/file/${encodeURIComponent(key)}`;
    if (this.cdnBase)   return `${this.cdnBase}/${key}`;
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  isLocalMode(): boolean { return this.useLocal; }
  getLocalDir():  string  { return this.localDir; }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
