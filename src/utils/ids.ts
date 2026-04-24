import crypto from 'crypto';

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function hashQuestion(input: string): string {
  return crypto.createHash('sha256').update(input.trim().toLowerCase()).digest('hex');
}

