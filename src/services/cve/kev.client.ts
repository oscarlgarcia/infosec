import { env } from '../../config';
import type { KevCatalog } from './mappers';
import { backoffMs, isRetryableStatus } from './mappers';

/**
 * Downloads the full CISA KEV catalog. The feed is a single public JSON
 * document, so there is no pagination or API key.
 */
export async function fetchKevCatalog(attempts = 3): Promise<KevCatalog> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(env.KEV_FEED_URL, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'InfoSec-CVE-Sync/1.0',
        },
        signal: AbortSignal.timeout(env.NVD_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
          continue;
        }
        throw Object.assign(new Error(`CISA KEV request failed (${response.status})`), {
          statusCode: response.status,
        });
      }
      const catalog = (await response.json()) as KevCatalog;
      if (!Array.isArray(catalog?.vulnerabilities)) {
        throw new Error('CISA KEV feed did not contain a vulnerabilities array');
      }
      return catalog;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('CISA KEV request failed');
}
