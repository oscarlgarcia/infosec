import type { Severity } from '../../types/request';

/**
 * Pure mapping helpers shared by the NVD/KEV clients, the sync service and
 * the tests. Nothing in this module touches Mongo or the network.
 */

const SEVERITY_MAP: Record<string, Severity> = {
  NONE: 'info',
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  MODERATE: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const MAX_PRODUCTS = 50;
const MAX_VENDORS = 20;
const MAX_REFERENCES = 20;

export function normalizeSeverity(value?: string | null, fallback: Severity = 'medium'): Severity {
  if (!value) return fallback;
  return SEVERITY_MAP[String(value).trim().toUpperCase()] || fallback;
}

export interface CvssResult {
  score?: number;
  severity: Severity;
  version?: string;
  vector?: string;
}

interface NvdMetricEntry {
  cvssData?: {
    version?: string;
    vectorString?: string;
    baseScore?: number;
    baseSeverity?: string;
  };
  baseSeverity?: string;
}

const CVSS_KEYS = ['cvssMetricV40', 'cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2'] as const;

/**
 * Picks the highest-fidelity CVSS metric available (v4 > v3.1 > v3.0 > v2).
 */
export function pickCvss(metrics: Record<string, any> | undefined | null): CvssResult {
  if (!metrics) return { severity: 'medium' };
  for (const key of CVSS_KEYS) {
    const list = metrics[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    const primary = list.find((entry: NvdMetricEntry) => entry?.cvssData) || list[0];
    const data = (primary as NvdMetricEntry)?.cvssData;
    if (!data) continue;
    const score = typeof data.baseScore === 'number' ? data.baseScore : undefined;
    const rawSeverity = data.baseSeverity || (primary as NvdMetricEntry)?.baseSeverity;
    return {
      score,
      severity: normalizeSeverity(rawSeverity, score === undefined ? 'medium' : scoreToSeverity(score)),
      version: data.version,
      vector: data.vectorString,
    };
  }
  return { severity: 'medium' };
}

export function scoreToSeverity(score: number): Severity {
  if (!Number.isFinite(score)) return 'medium';
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0) return 'low';
  return 'info';
}

export interface CpeParts {
  criteria: string;
  part?: string;
  vendor?: string;
  product?: string;
  version?: string;
}

/**
 * Parses both CPE 2.3 (`cpe:2.3:a:vendor:product:...`) and CPE 2.2
 * (`cpe:/a:vendor:product:...`) strings.
 */
export function parseCpe(criteria: string): CpeParts | null {
  if (!criteria) return null;
  const parts = criteria.split(':');
  if (parts[0] !== 'cpe') return null;
  if (parts[1] === '2.3' && parts.length >= 5) {
    return {
      criteria,
      part: parts[2] || undefined,
      vendor: decodeCpe(parts[3]),
      product: decodeCpe(parts[4]),
      version: parts[5] && parts[5] !== '*' ? decodeCpe(parts[5]) : undefined,
    };
  }
  if (parts[1]?.startsWith('/') && parts.length >= 4) {
    return {
      criteria,
      part: parts[1].slice(1) || undefined,
      vendor: decodeCpe(parts[2]),
      product: decodeCpe(parts[3]),
      version: parts[4] && parts[4] !== '*' ? decodeCpe(parts[4]) : undefined,
    };
  }
  return null;
}

function decodeCpe(value: string): string {
  return value
    .replace(/\\/g, '')
    .replace(/_/g, ' ')
    .trim();
}

export interface CveCpeInput {
  criteria: string;
  vendor?: string;
  product?: string;
  version?: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}

export interface CveCpe extends CveCpeInput {
  vendor: string;
  product: string;
}

interface NvdConfigurationNode {
  nodes?: NvdConfigurationNode[];
  cpeMatch?: Array<{
    vulnerable?: boolean;
    criteria?: string;
    versionStartIncluding?: string;
    versionStartExcluding?: string;
    versionEndIncluding?: string;
    versionEndExcluding?: string;
  }>;
}

export function extractCpes(configurations: NvdConfigurationNode[] | undefined | null): CveCpe[] {
  if (!Array.isArray(configurations)) return [];
  const seen = new Set<string>();
  const result: CveCpe[] = [];
  for (const configuration of configurations) {
    const nodes = Array.isArray(configuration?.nodes) ? configuration.nodes : [];
    for (const node of nodes) {
      const cpeMatch = Array.isArray(node?.cpeMatch) ? node.cpeMatch : [];
      for (const match of cpeMatch) {
        if (match?.vulnerable === false || !match?.criteria) continue;
        const parsed = parseCpe(match.criteria);
        if (!parsed?.vendor || !parsed?.product) continue;
        const key = [
          parsed.criteria,
          match.versionStartIncluding,
          match.versionStartExcluding,
          match.versionEndIncluding,
          match.versionEndExcluding,
        ].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          criteria: parsed.criteria,
          vendor: parsed.vendor,
          product: parsed.product,
          version: parsed.version,
          versionStartIncluding: match.versionStartIncluding,
          versionStartExcluding: match.versionStartExcluding,
          versionEndIncluding: match.versionEndIncluding,
          versionEndExcluding: match.versionEndExcluding,
        });
      }
    }
  }
  return result;
}

export function productLabels(cpes: CveCpe[]): { vendors: string[]; products: string[] } {
  const vendors = new Set<string>();
  const products = new Set<string>();
  for (const cpe of cpes) {
    const vendor = titleCase(cpe.vendor);
    const product = titleCase(cpe.product);
    if (vendor) vendors.add(vendor);
    if (product) products.add(product);
    // Only add the combined label when the product does not already name the vendor.
    if (vendor && product && !product.toLowerCase().includes(vendor.toLowerCase())) {
      products.add(`${vendor} ${product}`);
    }
    if (vendors.size >= MAX_VENDORS && products.size >= MAX_PRODUCTS) break;
  }
  return {
    vendors: [...vendors].slice(0, MAX_VENDORS),
    products: [...products].slice(0, MAX_PRODUCTS),
  };
}

export function titleCase(value: string): string {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

export interface KevData {
  listed: boolean;
  dateAdded?: Date;
  dueDate?: Date;
  requiredAction?: string;
  vulnerabilityName?: string;
  vendorProject?: string;
  product?: string;
  knownRansomwareCampaignUse?: string;
  notes?: string;
}

export interface CveRecordInput {
  cveId: string;
  title: string;
  severity: Severity;
  cvssScore?: number;
  cvssVersion?: string;
  cvssVector?: string;
  summary?: string;
  summaryEs?: string;
  vendors: string[];
  products: string[];
  cpes: CveCpe[];
  cwe: string[];
  references: string[];
  publishedAt?: Date;
  lastModified?: Date;
  nvdStatus?: string;
  sourceUrl: string;
  source: 'nvd' | 'kev';
  kev?: KevData;
}

interface NvdCveItem {
  /** NVD API 2.0 wraps each entry as `{ cve: { ... } }`. */
  cve?: NvdCveItem;
  id?: string;
  published?: string;
  lastModified?: string;
  vulnStatus?: string;
  descriptions?: Array<{ lang?: string; value?: string }>;
  metrics?: Record<string, any>;
  weaknesses?: Array<{ description?: Array<{ lang?: string; value?: string }> }>;
  configurations?: NvdConfigurationNode[];
  references?: Array<{ url?: string }>;
  cisaExploitAdd?: string;
  cisaActionDue?: string;
  cisaRequiredAction?: string;
  cisaVulnerabilityName?: string;
}

export interface MapNvdOptions {
  ingestRejected?: boolean;
}

/**
 * Maps a single NVD API 2.0 vulnerability item to our normalized record.
 * Returns null for rejected CVEs (unless explicitly requested).
 */
export function mapNvdCve(item: NvdCveItem, options: MapNvdOptions = {}): CveRecordInput | null {
  const cve: NvdCveItem = item?.cve && typeof item.cve === 'object' ? item.cve : item;
  const cveId = String(cve?.id || '').trim().toUpperCase();
  if (!/^CVE-\d{4}-\d{4,}$/.test(cveId)) return null;
  if (!options.ingestRejected && String(cve?.vulnStatus || '').toLowerCase() === 'rejected') return null;

  const descriptions = Array.isArray(cve.descriptions) ? cve.descriptions : [];
  const summary = descriptions.find((entry) => entry?.lang === 'en')?.value || descriptions[0]?.value;
  const summaryEs = descriptions.find((entry) => entry?.lang === 'es')?.value;
  const cvss = pickCvss(cve.metrics);
  const cpes = extractCpes(cve.configurations);
  const { vendors, products } = productLabels(cpes);
  const cwe = extractCwe(cve.weaknesses);
  const references = unique(
    (cve.references || []).map((reference) => reference?.url).filter((url): url is string => Boolean(url))
  ).slice(0, MAX_REFERENCES);

  const kevName = cve.cisaVulnerabilityName?.trim();
  const firstCpe = cpes.length
    ? (() => {
        const vendor = titleCase(cpes[0].vendor);
        const product = titleCase(cpes[0].product);
        return product.toLowerCase().includes(vendor.toLowerCase()) ? product : `${vendor} ${product}`;
      })()
    : '';
  const title = kevName || firstCpe || truncate(summary || cveId, 180);

  const kev = cve.cisaExploitAdd
    ? {
        listed: true,
        dateAdded: toDate(cve.cisaExploitAdd),
        dueDate: toDate(cve.cisaActionDue),
        requiredAction: cve.cisaRequiredAction,
        vulnerabilityName: kevName,
      }
    : undefined;

  return {
    cveId,
    title,
    severity: cvss.severity,
    cvssScore: cvss.score,
    cvssVersion: cvss.version,
    cvssVector: cvss.vector,
    summary,
    summaryEs,
    vendors,
    products,
    cpes,
    cwe,
    references,
    publishedAt: toDate(cve.published),
    lastModified: toDate(cve.lastModified),
    nvdStatus: cve.vulnStatus,
    sourceUrl: `https://nvd.nist.gov/vuln/detail/${cveId}`,
    source: 'nvd',
    kev,
  };
}

function extractCwe(weaknesses: NvdCveItem['weaknesses']): string[] {
  if (!Array.isArray(weaknesses)) return [];
  const values = new Set<string>();
  for (const weakness of weaknesses) {
    for (const description of weakness?.description || []) {
      const value = String(description?.value || '').trim();
      if (/^CWE-\d+$/i.test(value)) values.add(value.toUpperCase());
    }
  }
  return [...values];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

export function toDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  let text = String(value).trim();
  // NVD timestamps omit the timezone but are UTC; make that explicit.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)) text = `${text}Z`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function truncate(value: string, max: number): string {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export interface KevEntry {
  cveID?: string;
  vendorProject?: string;
  product?: string;
  name?: string;
  dateAdded?: string;
  shortDescription?: string;
  requiredAction?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string;
  notes?: string;
}

export interface KevMappedRecord {
  cveId: string;
  title: string;
  summary?: string;
  vendors: string[];
  products: string[];
  publishedAt?: Date;
  sourceUrl: string;
  kev: KevData;
}

/**
 * Maps a CISA KEV entry. KEV-only records get a conservative `high` severity
 * until NVD enriches them (KEV means active exploitation).
 */
export function mapKevEntry(entry: KevEntry): KevMappedRecord | null {
  const cveId = String(entry?.cveID || '').trim().toUpperCase();
  if (!/^CVE-\d{4}-\d{4,}$/.test(cveId)) return null;
  const vendor = String(entry.vendorProject || '').trim();
  const product = String(entry.product || '').trim();
  const name = String(entry.name || '').trim();
  const description = String(entry.shortDescription || '').trim();
  return {
    cveId,
    title: name || `${vendor} ${product}`.trim() || cveId,
    summary: description || undefined,
    vendors: vendor ? [vendor] : [],
    products: product ? [product, vendor ? `${vendor} ${product}` : ''].filter(Boolean) : [],
    publishedAt: toDate(entry.dateAdded),
    sourceUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    kev: {
      listed: true,
      dateAdded: toDate(entry.dateAdded),
      dueDate: toDate(entry.dueDate),
      requiredAction: entry.requiredAction,
      vulnerabilityName: name || undefined,
      vendorProject: vendor || undefined,
      product: product || undefined,
      knownRansomwareCampaignUse: entry.knownRansomwareCampaignUse,
      notes: entry.notes,
    },
  };
}

export interface KevCatalog {
  catalogVersion?: string;
  dateReleased?: string;
  count?: number;
  vulnerabilities?: KevEntry[];
}

/**
 * Splits a date range into windows NVD accepts (max 120 consecutive days).
 */
export function splitDateWindows(start: Date, end: Date, maxDays = 120): Array<{ start: Date; end: Date }> {
  if (end.getTime() <= start.getTime()) return [];
  const windows: Array<{ start: Date; end: Date }> = [];
  let cursor = start.getTime();
  const step = maxDays * 24 * 60 * 60 * 1000;
  while (cursor < end.getTime()) {
    const next = Math.min(cursor + step, end.getTime());
    windows.push({ start: new Date(cursor), end: new Date(next) });
    cursor = next;
  }
  return windows;
}

export function buildNvdQuery(params: {
  from?: Date;
  to?: Date;
  cveId?: string;
  startIndex?: number;
  resultsPerPage?: number;
  usePublishedDates?: boolean;
}): string {
  const query = new URLSearchParams();
  if (params.cveId) {
    query.set('cveId', params.cveId);
  } else if (params.from && params.to) {
    const prefix = params.usePublishedDates ? 'pub' : 'lastMod';
    query.set(`${prefix}StartDate`, toNvdDate(params.from));
    query.set(`${prefix}EndDate`, toNvdDate(params.to));
  }
  query.set('startIndex', String(params.startIndex ?? 0));
  query.set('resultsPerPage', String(params.resultsPerPage ?? 2000));
  return query.toString();
}

/** NVD expects ISO-8601 with an explicit UTC offset. */
export function toNvdDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

/** NVD rate limit: 50 req/30s with key, 5 req/30s without. */
export function nvdDelayMs(hasKey: boolean): number {
  return hasKey ? 700 : 6500;
}

export function isRetryableStatus(status: number): boolean {
  return status === 403 || status === 429 || status >= 500;
}

export function backoffMs(attempt: number, baseMs = 1000): number {
  return Math.min(baseMs * 2 ** Math.max(0, attempt), 30000);
}
