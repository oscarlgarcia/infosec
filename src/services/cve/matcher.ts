import type { CveCpe, CveRecordInput } from './mappers';

/**
 * Deterministic, pure client-matching rules. The sync service loads clients
 * and persists the result on `CveRecord.matches`; this module has no I/O so it
 * can be unit tested without Mongo or the network.
 */

export interface InventoryItem {
  vendor?: string;
  product?: string;
  version?: string;
  cpe?: string;
  criticality?: string;
  notes?: string;
}

export interface MatchableClient {
  _id?: any;
  name?: string;
  tags?: string[];
  technologyInventory?: InventoryItem[];
}

export interface MatchableRecord {
  vendors?: string[];
  products?: string[];
  cpes?: CveCpe[];
}

export interface MatchResult {
  clientId?: any;
  confidence: number;
  reasons: string[];
  matchedVendor?: string;
  matchedProduct?: string;
  matchedVersion?: string;
}

/** Minimum confidence persisted on the record. */
export const MATCH_THRESHOLD = 0.5;

const GENERIC_TOKENS = new Set([
  'server', 'servers', 'client', 'clients', 'enterprise', 'professional',
  'standard', 'community', 'web', 'application', 'applications', 'software',
  'system', 'systems', 'platform', 'platforms', 'service', 'services',
  'framework', 'library', 'tool', 'tools', 'suite', 'appliance', 'virtual',
  'cloud', 'runtime', 'core', 'update', 'updates', 'manager', 'management',
  'console', 'agent', 'proxy', 'database', 'windows', 'linux',
  'serverless', 'desktop', 'mobile',
]);

export function normalizeToken(value?: string | null): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function significantTokens(value: string): string[] {
  return normalizeToken(value)
    .split(' ')
    .filter((token) => token && !GENERIC_TOKENS.has(token));
}

/** Returns 1 for an exact normalized match, 0 when nothing significant matches. */
export function nameSimilarity(left?: string, right?: string): number {
  const a = normalizeToken(left);
  const b = normalizeToken(right);
  if (!a || !b) return 0;
  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  // Generic-only names (windows, server, …) are too broad to match on their own.
  if (!tokensA.length && !tokensB.length) return a === b ? 0.5 : 0;
  if (a === b) return 1;
  if (!tokensA.length || !tokensB.length) return 0;
  const smaller = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const larger = tokensA.length > tokensB.length ? tokensA : tokensB;
  const shared = smaller.filter((token) => larger.includes(token));
  if (!shared.length) return 0;
  if (smaller.every((token) => larger.includes(token))) return 0.9;
  return 0.6 * (shared.length / Math.min(tokensA.length, tokensB.length));
}

/** Compares dotted/segmented versions, treating numeric chunks numerically. */
export function compareVersions(left: string, right: string): number {
  const partsA = String(left || '').split(/[.\-_+]/);
  const partsB = String(right || '').split(/[.\-_+]/);
  const length = Math.max(partsA.length, partsB.length);
  for (let index = 0; index < length; index += 1) {
    const a = partsA[index] ?? '0';
    const b = partsB[index] ?? '0';
    const numberA = Number(a);
    const numberB = Number(b);
    if (Number.isFinite(numberA) && Number.isFinite(numberB)) {
      if (numberA !== numberB) return numberA < numberB ? -1 : 1;
      continue;
    }
    const comparison = a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
    if (comparison !== 0) return comparison < 0 ? -1 : 1;
  }
  return 0;
}

export interface VersionRange {
  version?: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}

/**
 * Evaluates a concrete version against a CPE applicability range. Returns
 * `undefined` when the range carries no version information at all.
 */
export function versionSatisfies(version: string | undefined, range: VersionRange): boolean | undefined {
  const hasRange = Boolean(
    range.version ||
    range.versionStartIncluding ||
    range.versionStartExcluding ||
    range.versionEndIncluding ||
    range.versionEndExcluding
  );
  if (!hasRange) return undefined;
  if (!version) return undefined;
  const target = String(version);
  if (range.version && normalizeToken(range.version) !== '*' && compareVersions(target, range.version) !== 0) return false;
  if (range.versionStartIncluding && compareVersions(target, range.versionStartIncluding) < 0) return false;
  if (range.versionStartExcluding && compareVersions(target, range.versionStartExcluding) <= 0) return false;
  if (range.versionEndIncluding && compareVersions(target, range.versionEndIncluding) > 0) return false;
  if (range.versionEndExcluding && compareVersions(target, range.versionEndExcluding) >= 0) return false;
  return true;
}

function bestNameMatch(values: string[] | undefined, target: string): { score: number; value?: string } {
  let best = 0;
  let match: string | undefined;
  for (const value of values || []) {
    const score = nameSimilarity(value, target);
    if (score > best) {
      best = score;
      match = value;
    }
  }
  return { score: best, value: match };
}

interface CpeCandidate {
  vendor: string;
  product: string;
  range: VersionRange;
}

function cpeCandidates(record: MatchableRecord): CpeCandidate[] {
  return (record.cpes || []).map((cpe) => ({
    vendor: cpe.vendor,
    product: cpe.product,
    range: {
      version: cpe.version,
      versionStartIncluding: cpe.versionStartIncluding,
      versionStartExcluding: cpe.versionStartExcluding,
      versionEndIncluding: cpe.versionEndIncluding,
      versionEndExcluding: cpe.versionEndExcluding,
    },
  }));
}

function matchCpe(
  item: InventoryItem,
  candidates: CpeCandidate[]
): { result: MatchResult | null; nameMatched: boolean } {
  if (!item.vendor && !item.product) return { result: null, nameMatched: false };
  let best: MatchResult | null = null;
  let nameMatched = false;
  for (const candidate of candidates) {
    const vendorScore = item.vendor ? nameSimilarity(item.vendor, candidate.vendor) : 1;
    const productScore = item.product ? nameSimilarity(item.product, candidate.product) : 1;
    if (vendorScore < 0.9 || productScore < 0.9) continue;
    nameMatched = true;
    const versionOk = versionSatisfies(item.version, candidate.range);
    if (versionOk === false) continue;
    const confidence = versionOk === true ? 0.98 : item.version ? 0.9 : 0.85;
    const reasons = [
      `CPE ${candidate.vendor}:${candidate.product}`,
      versionOk === true
        ? `Version ${item.version} within affected range`
        : item.version
          ? `Version ${item.version} (range not conclusive)`
          : 'Version not provided',
    ];
    const result: MatchResult = {
      confidence,
      reasons,
      matchedVendor: candidate.vendor,
      matchedProduct: candidate.product,
      matchedVersion: item.version,
    };
    if (!best || result.confidence > best.confidence) best = result;
  }
  return { result: best, nameMatched };
}

function matchNames(item: InventoryItem, record: MatchableRecord): MatchResult | null {
  const vendor = bestNameMatch(record.vendors, item.vendor || '');
  const product = bestNameMatch(record.products, item.product || '');
  const productTarget = item.product || item.cpe || item.vendor || '';
  const altProduct = bestNameMatch(record.products, productTarget);

  const productScore = Math.max(product.score, altProduct.score);
  if (productScore < 0.6) return null;
  if (item.vendor && record.vendors?.length && vendor.score < 0.6) return null;

  const confidence = Math.min(0.9, 0.5 + productScore * 0.4);
  return {
    confidence,
    reasons: [
      `Inventory match: ${[item.vendor, item.product].filter(Boolean).join(' ')}`,
      `CVE product: ${altProduct.value || product.value || 'n/d'}`,
    ],
    matchedVendor: vendor.value || item.vendor,
    matchedProduct: altProduct.value || product.value || item.product,
    matchedVersion: item.version,
  };
}

function matchTags(client: MatchableClient, record: MatchableRecord): MatchResult | null {
  let best: MatchResult | null = null;
  for (const tag of client.tags || []) {
    const vendor = bestNameMatch(record.vendors, tag);
    const product = bestNameMatch(record.products, tag);
    const score = Math.max(vendor.score, product.score);
    if (score < 0.9) continue;
    const confidence = 0.5;
    if (!best || confidence > best.confidence) {
      best = {
        confidence,
        reasons: [`Tag match: ${tag}`],
        matchedVendor: vendor.value,
        matchedProduct: product.value,
      };
    }
  }
  return best;
}

/**
 * Matches one CVE record against one client. Returns null when there is no
 * meaningful overlap.
 */
export function matchClient(record: MatchableRecord, client: MatchableClient): MatchResult | null {
  const candidates = cpeCandidates(record);
  const inventory = client.technologyInventory || [];
  let best: MatchResult | null = null;
  for (const item of inventory) {
    const { result, nameMatched } = matchCpe(item, candidates);
    // A product-level CPE whose version is out of range must not fall back to
    // a name match: the version is authoritative.
    const nameMatch = result || (nameMatched ? null : matchNames(item, record));
    if (nameMatch && (!best || nameMatch.confidence > best.confidence)) best = nameMatch;
  }
  if (!best) best = matchTags(client, record);
  if (!best || best.confidence < MATCH_THRESHOLD) return null;
  return { ...best, clientId: client._id };
}

export function matchRecord(record: MatchableRecord, clients: MatchableClient[]): MatchResult[] {
  return clients
    .map((client) => matchClient(record, client))
    .filter((match): match is MatchResult => Boolean(match))
    .sort((left, right) => right.confidence - left.confidence);
}

/** Convenience wrapper used by the sync service after mapping an NVD item. */
export function matchMappedRecord(record: CveRecordInput, clients: MatchableClient[]): MatchResult[] {
  return matchRecord(record, clients);
}
