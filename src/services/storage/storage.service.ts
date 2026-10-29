import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!env.S3_BUCKET) throw new Error('S3_BUCKET is not configured');
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
    });
  }
  return s3Client;
}

export function getStorageProvider(): 'local' | 's3' {
  return env.STORAGE_PROVIDER === 's3' ? 's3' : 'local';
}

export function sanitizeFilename(filename: string): string {
  const base = path.basename(String(filename || 'file'));
  const cleaned = base.replace(/[^a-zA-Z0-9._()\- ]/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned || `file-${Date.now()}`;
}

export function checksumBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function buildStorageKey(requestId: string, filename: string): string {
  const safe = sanitizeFilename(filename);
  return `requests/${requestId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`;
}

function localPath(storageKey: string): string {
  const base = path.resolve(env.STORAGE_LOCAL_DIR);
  const resolved = path.resolve(base, storageKey);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Invalid storage key');
  }
  return resolved;
}

export async function putObject(storageKey: string, buffer: Buffer, mimeType: string): Promise<{ provider: 'local' | 's3' }> {
  if (getStorageProvider() === 's3') {
    await getS3Client().send(new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
    }));
    return { provider: 's3' };
  }

  const filePath = localPath(storageKey);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer);
  return { provider: 'local' };
}

export async function getObjectStream(storageKey: string): Promise<Readable> {
  if (getStorageProvider() === 's3') {
    const response = await getS3Client().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }));
    return response.Body as Readable;
  }
  const filePath = localPath(storageKey);
  if (!fs.existsSync(filePath)) throw new Error('File not found');
  return fs.createReadStream(filePath);
}

export async function deleteObject(storageKey: string): Promise<void> {
  if (getStorageProvider() === 's3') {
    await getS3Client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }));
    return;
  }
  const filePath = localPath(storageKey);
  if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
}

export async function getPresignedDownloadUrl(storageKey: string, expiresIn = 300): Promise<string | null> {
  if (getStorageProvider() !== 's3') return null;
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }),
    { expiresIn }
  );
}
