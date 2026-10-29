import { describe, expect, it } from 'vitest';
import { formatRequestKey, parseRequestKey } from '../src/services/request/numbering';

describe('request key numbering', () => {
  it('formats REQ-<year>-<6 digits>', () => {
    expect(formatRequestKey(2026, 1)).toBe('REQ-2026-000001');
    expect(formatRequestKey(2026, 123)).toBe('REQ-2026-000123');
    expect(formatRequestKey(2030, 999999)).toBe('REQ-2030-999999');
  });

  it('does not truncate sequences above six digits', () => {
    expect(formatRequestKey(2026, 1000000)).toBe('REQ-2026-1000000');
  });

  it('parses a valid key', () => {
    expect(parseRequestKey('REQ-2026-000123')).toEqual({ year: 2026, seq: 123 });
    expect(parseRequestKey('REQ-2026-1000000')).toEqual({ year: 2026, seq: 1000000 });
  });

  it('rejects malformed keys', () => {
    expect(parseRequestKey('2026-000123')).toBeNull();
    expect(parseRequestKey('REQ-26-000123')).toBeNull();
    expect(parseRequestKey('REQ-2026-123')).toBeNull();
    expect(parseRequestKey('')).toBeNull();
    expect(parseRequestKey(undefined as unknown as string)).toBeNull();
  });

  it('round-trips every formatted key', () => {
    for (const year of [2024, 2025, 2026]) {
      for (const seq of [1, 42, 999999]) {
        const key = formatRequestKey(year, seq);
        expect(parseRequestKey(key)).toEqual({ year, seq });
      }
    }
  });
});
