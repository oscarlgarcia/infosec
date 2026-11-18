import mongoose from 'mongoose';
import { EvidenceItem, EvidenceMapping } from '../../db/mongo/models';
import {
  EvidenceMappingCreateInput,
  EvidenceMappingUpdateInput,
} from '../../schemas/evidence';
import type { EvidenceActor } from './evidence.service';
import { serializeEvidence } from './evidence.service';

/**
 * Lexical requirement matcher.
 *
 * The first phase intentionally avoids embeddings/LLM calls: request lines
 * arrive in Spanish, English or Italian and are matched against the criteria
 * stored on each evidence. Saved requirement → evidence mappings add a strong
 * boost so confirmed answers are suggested again.
 */

const STOPWORDS = new Set([
  // Spanish
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'o', 'u',
  'en', 'al', 'a', 'que', 'con', 'por', 'para', 'se', 'su', 'sus', 'es', 'son', 'como',
  'mas', 'menos', 'sin', 'sobre', 'entre', 'este', 'esta', 'estos', 'estas', 'lo', 'le',
  'les', 'ni', 'segun', 'durante', 'mediante', 'ser', 'esta', 'estan', 'hay', 'fue', 'han',
  'debe', 'deben', 'puede', 'pueden', 'cada', 'todo', 'toda', 'todos', 'todas', 'otro',
  // English
  'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'is', 'are', 'be', 'as',
  'at', 'from', 'that', 'this', 'these', 'those', 'an', 'it', 'its', 'their', 'has', 'have',
  'been', 'will', 'shall', 'must', 'should', 'can', 'may', 'include', 'including', 'such',
  'any', 'all', 'not', 'into', 'within', 'per', 'which', 'when', 'where', 'who', 'how',
  // Italian
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'del', 'della', 'dei',
  'degli', 'delle', 'ed', 'od', 'nel', 'nella', 'nei', 'nelle', 'per', 'con', 'su', 'sulla',
  'che', 'chi', 'cui', 'sono', 'come', 'piu', 'meno', 'senza', 'tra', 'fra', 'al', 'alla',
  'ai', 'alle', 'da', 'dal', 'dalla', 'dai', 'dalle', 'non', 'si', 'se', 'anche', 'durante',
  'secondo', 'mediante', 'dell', 'dello', 'della', 'sul', 'sullo', 'sui', 'sugli', 'sulle',
]);

const FIELD_WEIGHTS: Array<{ field: string; weight: number }> = [
  { field: 'covers', weight: 6 },
  { field: 'tags', weight: 5 },
  { field: 'title', weight: 4 },
  { field: 'controls', weight: 4 },
  { field: 'frameworks', weight: 3 },
  { field: 'area', weight: 3 },
  { field: 'process', weight: 3 },
  { field: 'domain', weight: 2 },
  { field: 'description', weight: 1.5 },
];

const MAX_WEIGHT = Math.max(...FIELD_WEIGHTS.map((entry) => entry.weight));
const MIN_SCORE = 0.15;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function actorName(actor?: EvidenceActor) {
  return actor?.username || actor?.email || actor?.id || 'system';
}

export function normalizeForMatch(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeForMatch(value: unknown): string[] {
  const tokens = normalizeForMatch(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
  return Array.from(new Set(tokens));
}

/**
 * Light stemming for Romance languages: compare a shared prefix so
 * "processo"/"processi", "testing"/"test" or "controllo"/"controlli" match
 * without pulling in a full stemmer.
 */
function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  const shortest = Math.min(a.length, b.length);
  if (shortest < 4) return false;
  const prefix = shortest >= 6 ? 5 : 4;
  return a.slice(0, prefix) === b.slice(0, prefix);
}

function itemFields(item: any) {
  const raw: Record<string, unknown> = {
    covers: item.covers,
    tags: (item.tags || []).join(' '),
    title: item.title,
    controls: (item.controls || []).join(' '),
    frameworks: (item.frameworks || []).join(' '),
    area: item.area,
    process: item.process,
    domain: item.domain,
    description: item.description,
  };
  return FIELD_WEIGHTS.map(({ field, weight }) => ({
    field,
    weight,
    tokens: tokenizeForMatch(raw[field]),
    text: normalizeForMatch(raw[field]),
  }));
}

function mappingTokens(normalized: string) {
  return new Set(
    normalized
      .split(' ')
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export interface EvidenceMatchReason {
  field: string;
  tokens: string[];
}

export interface EvidenceMatchResult {
  evidence: ReturnType<typeof serializeEvidence>;
  score: number;
  reasons: EvidenceMatchReason[];
  savedMapping?: { id: string; requirement: string };
}

export async function matchEvidence(rawQuery: string, limit = 5) {
  const query = String(rawQuery || '').trim();
  const normalizedQuery = normalizeForMatch(query);
  const queryTokens = tokenizeForMatch(query);
  const queryTokenSet = new Set(queryTokens);

  if (!queryTokens.length) {
    return { query, tokens: [], matches: [] as EvidenceMatchResult[] };
  }

  const [items, mappings] = await Promise.all([
    EvidenceItem.find({ archived: { $ne: true } }).limit(2000).lean(),
    EvidenceMapping.find({}).populate('evidenceId', 'title').lean(),
  ]);

  // Requirement → evidence mappings confirmed by an admin. Exact or very
  // similar requirement texts boost their evidence.
  const boosts = new Map<string, { similarity: number; mapping: any }>();
  for (const mapping of mappings) {
    if (!mapping.evidenceId) continue;
    const evidenceId = String((mapping as any).evidenceId?._id || mapping.evidenceId);
    const similarity = mapping.normalized === normalizedQuery
      ? 1
      : jaccard(mappingTokens(mapping.normalized || ''), queryTokenSet);
    if (similarity < 0.7) continue;
    const current = boosts.get(evidenceId);
    if (!current || similarity > current.similarity) {
      boosts.set(evidenceId, { similarity, mapping });
    }
  }

  const results: EvidenceMatchResult[] = [];

  for (const item of items) {
    const fields = itemFields(item);
    const matchedByField = new Map<string, string[]>();
    let weightSum = 0;
    let matchedTokens = 0;

    for (const token of queryTokens) {
      let bestField: string | null = null;
      let bestWeight = 0;
      for (const field of fields) {
        if (field.tokens.some((candidate) => sameStem(candidate, token))) {
          if (field.weight > bestWeight) {
            bestWeight = field.weight;
            bestField = field.field;
          }
        }
      }
      if (bestField) {
        weightSum += bestWeight;
        matchedTokens += 1;
        const bucket = matchedByField.get(bestField) || [];
        bucket.push(token);
        matchedByField.set(bestField, bucket);
      }
    }

    let score = weightSum / (MAX_WEIGHT * queryTokens.length);
    if (matchedTokens === queryTokens.length) score += 0.08;
    const coversText = fields.find((field) => field.field === 'covers')?.text || '';
    if (normalizedQuery.length >= 12 && coversText.includes(normalizedQuery)) score += 0.12;

    const boost = boosts.get(String(item._id));
    if (boost) {
      score = Math.max(score, 0.35 + 0.25 * boost.similarity);
      score += 0.25 * boost.similarity;
    }

    score = Math.min(1, Math.round(score * 1000) / 1000);
    if (score < MIN_SCORE) continue;

    const reasons: EvidenceMatchReason[] = FIELD_WEIGHTS
      .filter(({ field }) => matchedByField.has(field))
      .map(({ field }) => ({ field, tokens: matchedByField.get(field)! }));
    if (boost) reasons.unshift({ field: 'saved_mapping', tokens: [] });

    results.push({
      evidence: serializeEvidence(item) as any,
      score,
      reasons,
      ...(boost
        ? {
            savedMapping: {
              id: String(boost.mapping._id),
              requirement: boost.mapping.requirement,
            },
          }
        : {}),
    });
  }

  results.sort((a, b) => b.score - a.score || String(a.evidence?.title).localeCompare(String(b.evidence?.title)));

  return {
    query,
    tokens: queryTokens,
    matches: results.slice(0, Math.max(1, Math.min(20, Number(limit) || 5))),
  };
}

export function serializeMapping(doc: any) {
  const evidence = doc?.evidenceId && typeof doc.evidenceId === 'object' ? doc.evidenceId : null;
  return {
    id: String(doc._id),
    requirement: doc.requirement,
    normalized: doc.normalized,
    evidenceId: evidence ? String(evidence._id) : String(doc.evidenceId),
    evidenceTitle: evidence?.title || '',
    language: doc.language || 'other',
    notes: doc.notes || '',
    hits: doc.hits || 0,
    createdBy: doc.createdBy || '',
    updatedBy: doc.updatedBy || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listMappings(q?: string) {
  const query: Record<string, any> = {};
  const term = String(q || '').trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    query.$or = [{ requirement: rx }, { normalized: rx }];
  }
  const docs = await EvidenceMapping.find(query)
    .sort({ updatedAt: -1 })
    .limit(500)
    .populate('evidenceId', 'title')
    .lean();
  return docs.map(serializeMapping);
}

export async function createMapping(input: EvidenceMappingCreateInput, actor?: EvidenceActor) {
  if (!mongoose.Types.ObjectId.isValid(input.evidenceId)) {
    throw Object.assign(new Error('Evidence not found'), { statusCode: 404 });
  }
  const evidence = await EvidenceItem.findById(input.evidenceId).lean();
  if (!evidence) throw Object.assign(new Error('Evidence not found'), { statusCode: 404 });

  const normalized = normalizeForMatch(input.requirement);
  if (!normalized) {
    throw Object.assign(new Error('Requirement text is empty after normalization'), { statusCode: 400 });
  }

  const doc = await EvidenceMapping.findOneAndUpdate(
    { normalized, evidenceId: evidence._id },
    {
      $set: {
        requirement: input.requirement.trim(),
        language: input.language || 'other',
        notes: input.notes || undefined,
        updatedBy: actorName(actor),
      },
      $setOnInsert: { createdBy: actorName(actor) },
    },
    { upsert: true, new: true }
  )
    .populate('evidenceId', 'title')
    .lean();

  return serializeMapping(doc);
}

export async function updateMapping(
  id: string,
  input: EvidenceMappingUpdateInput,
  actor?: EvidenceActor
) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error('Mapping not found'), { statusCode: 404 });
  }
  const payload: Record<string, any> = { updatedBy: actorName(actor) };
  if (input.language !== undefined) payload.language = input.language;
  if (input.notes !== undefined) payload.notes = input.notes || undefined;

  const doc = await EvidenceMapping.findByIdAndUpdate(id, { $set: payload }, { new: true })
    .populate('evidenceId', 'title')
    .lean();
  if (!doc) throw Object.assign(new Error('Mapping not found'), { statusCode: 404 });
  return serializeMapping(doc);
}

export async function deleteMapping(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error('Mapping not found'), { statusCode: 404 });
  }
  const doc = await EvidenceMapping.findByIdAndDelete(id);
  if (!doc) throw Object.assign(new Error('Mapping not found'), { statusCode: 404 });
  return { deleted: true };
}

export async function exportMappings() {
  const docs = await EvidenceMapping.find({})
    .sort({ updatedAt: -1 })
    .populate('evidenceId', 'title')
    .lean();
  return docs.map(serializeMapping);
}
