import mongoose from 'mongoose';
import { Counter } from '../../db/mongo/models';

const PREFIX = 'REQ';
const PAD = 6;

export function formatRequestKey(year: number, seq: number): string {
  return `${PREFIX}-${year}-${String(seq).padStart(PAD, '0')}`;
}

export function parseRequestKey(value: string): { year: number; seq: number } | null {
  const match = /^REQ-(\d{4})-(\d{6,})$/.exec(String(value || '').trim());
  if (!match) return null;
  return { year: Number(match[1]), seq: Number(match[2]) };
}

/**
 * Atomic per-year sequence. Uses findOneAndUpdate with upsert so concurrent
 * callers always get a different sequence number.
 */
export async function nextRequestKey(now: Date = new Date()): Promise<{ requestKey: string; year: number; seq: number }> {
  const year = now.getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { key: `request:${year}` },
    { $inc: { seq: 1 }, $setOnInsert: { key: `request:${year}` } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const seq = Number(counter?.seq || 1);
  return { requestKey: formatRequestKey(year, seq), year, seq };
}

/**
 * Reserve a key and fall back to the next one if an existing request already
 * owns it (e.g. after a manual data import).
 */
export async function reserveRequestKey(
  exists: (key: string) => Promise<boolean> = async (key) => {
    const { ClientRequest } = await import('../../db/mongo/models');
    return Boolean(await ClientRequest.exists({ requestKey: key }));
  }
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { requestKey } = await nextRequestKey();
    if (!(await exists(requestKey))) return requestKey;
  }
  throw new Error('Could not reserve a unique request key');
}

export function normalizeObjectId(value: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid identifier');
  }
  return new mongoose.Types.ObjectId(value);
}
