import { describe, expect, it } from 'vitest';
import { normalizeText, similarityScore } from '../src/services/request/request.service';
import { serializeRequest, serializeDocument } from '../src/services/request/serializer';

describe('duplicate detection helpers', () => {
  it('normalizes accents, punctuation and stopwords', () => {
    expect(normalizeText('¿Cuál es la POLÍTICA de acceso?')).toBe('cual politica acceso');
    expect(normalizeText('The and for with')).toBe('');
  });

  it('scores identical text as 1', () => {
    expect(similarityScore('SOC 2 report review', 'SOC 2 report review')).toBe(1);
  });

  it('scores disjoint text as 0', () => {
    expect(similarityScore('penetration test', 'iso certificate')).toBe(0);
  });

  it('scores partial overlap between 0 and 1', () => {
    const score = similarityScore('soc report review', 'soc report evidence review');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns 0 for empty input', () => {
    expect(similarityScore('', 'something')).toBe(0);
    expect(similarityScore('', '')).toBe(0);
  });
});

describe('request serializer compatibility', () => {
  it('exposes both the new and legacy status', () => {
    const serialized = serializeRequest({
      _id: 'req-1',
      clientId: 'client-1',
      requestKey: 'REQ-2026-000001',
      requestType: 'InfoSec Support',
      status: 'waiting_client',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(serialized.statusNew).toBe('waiting_client');
    expect(serialized.status).toBe('in_progress');
  });

  it('maps legacy stored statuses on read', () => {
    const serialized = serializeRequest({
      _id: 'req-2',
      clientId: 'client-1',
      requestKey: 'REQ-2026-000002',
      requestType: 'InfoSec Support',
      status: 'completed',
    });
    expect(serialized.statusNew).toBe('closed');
    expect(serialized.status).toBe('completed');
  });

  it('applies defaults for optional fields', () => {
    const serialized = serializeRequest({
      _id: 'req-3',
      clientId: 'client-1',
      requestKey: 'REQ-2026-000003',
      requestType: 'InfoSec Support',
    });
    expect(serialized.requestKind).toBe('standard');
    expect(serialized.priority).toBe('P3');
    expect(serialized.severity).toBe('medium');
    expect(serialized.slaState).toBe('on_track');
    expect(serialized.tags).toEqual([]);
  });

  it('returns null for missing input', () => {
    expect(serializeRequest(null)).toBeNull();
  });

  it('serializes document storage metadata without leaking the key', () => {
    const document = serializeDocument({
      _id: 'doc-1',
      requestId: 'req-1',
      filename: 'evidence.pdf',
      originalName: 'Evidence.pdf',
      mimeType: 'application/pdf',
      size: 10,
      checksum: 'abc',
      storageProvider: 'local',
      storageKey: '2026/req-1/evidence.pdf',
      visibility: 'internal',
      classification: 'internal',
      documentType: 'evidence',
    });
    expect(document.id).toBe('doc-1');
    expect(document.filename).toBe('evidence.pdf');
    expect(document.storageProvider).toBe('local');
    expect(document).not.toHaveProperty('storageKey');
  });
});
