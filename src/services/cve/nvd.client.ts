import { env } from '../../config';
import {
  backoffMs,
  buildNvdQuery,
  isRetryableStatus,
  nvdDelayMs,
} from './mappers';

/**
 * Thin NVD API 2.0 client. Only responsibilities: build URLs, respect the
 * documented rate limits, retry transient failures and paginate.
 */

export interface NvdPage {
  resultsPerPage: number;
  startIndex: number;
  totalResults: number;
  format?: string;
  version?: string;
  vulnerabilities: any[];
}

export class NvdError extends Error {
  statusCode: number;
  retryable: boolean;

  constructor(message: string, statusCode: number, retryable = false) {
    super(message);
    this.name = 'NvdError';
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function hasNvdApiKey(): boolean {
  return Boolean(env.NVD_API_KEY && env.NVD_API_KEY.trim());
}

function headers(): Record<string, string> {
  const result: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'InfoSec-CVE-Sync/1.0',
  };
  if (hasNvdApiKey()) result.apiKey = String(env.NVD_API_KEY).trim();
  return result;
}

export interface NvdPageParams {
  from?: Date;
  to?: Date;
  cveId?: string;
  startIndex?: number;
  resultsPerPage?: number;
  usePublishedDates?: boolean;
}

export function buildNvdUrl(params: NvdPageParams): string {
  const base = env.NVD_API_BASE_URL.replace(/\/$/, '');
  return `${base}?${buildNvdQuery(params)}`;
}

export async function fetchNvdPage(params: NvdPageParams, attempts = 4): Promise<NvdPage> {
  const url = buildNvdUrl(params);
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: headers(),
        signal: AbortSignal.timeout(env.NVD_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const retryable = isRetryableStatus(response.status);
        if (retryable && attempt < attempts - 1) {
          const retryAfter = Number(response.headers.get('retry-after'));
          await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt));
          continue;
        }
        throw new NvdError(
          `NVD request failed (${response.status}): ${body.slice(0, 200)}`,
          response.status,
          retryable
        );
      }
      return (await response.json()) as NvdPage;
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof NvdError) || error.retryable;
      if (attempt >= attempts - 1 || !retryable) throw error;
      await delay(backoffMs(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new NvdError('NVD request failed', 500, true);
}

export interface IterateNvdOptions {
  from: Date;
  to: Date;
  usePublishedDates?: boolean;
  onItems: (items: any[]) => Promise<void> | void;
  onProgress?: (progress: { page: number; processed: number; total: number }) => Promise<void> | void;
  resultsPerPage?: number;
  maxPages?: number;
}

export interface IterateNvdResult {
  processed: number;
  total: number;
  pages: number;
}

/**
 * Iterates every page of a single NVD window. The caller persists the cursor
 * only after the whole window succeeds.
 */
export async function iterateNvdWindow(options: IterateNvdOptions): Promise<IterateNvdResult> {
  const resultsPerPage = Math.min(2000, Math.max(1, options.resultsPerPage || 2000));
  const maxPages = options.maxPages || 500;
  let startIndex = 0;
  let processed = 0;
  let total = 0;
  let page = 0;

  while (page < maxPages) {
    const response = await fetchNvdPage({
      from: options.from,
      to: options.to,
      usePublishedDates: options.usePublishedDates,
      startIndex,
      resultsPerPage,
    });
    const items = Array.isArray(response.vulnerabilities) ? response.vulnerabilities : [];
    total = Number(response.totalResults) || items.length;
    page += 1;

    if (items.length) {
      await options.onItems(items);
      processed += items.length;
    }
    await options.onProgress?.({ page, processed, total });

    startIndex += resultsPerPage;
    if (startIndex >= total || items.length === 0) break;
    await delay(nvdDelayMs(hasNvdApiKey()));
  }

  return { processed, total, pages: page };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
