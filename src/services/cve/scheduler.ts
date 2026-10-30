import { env } from '../../config';
import { syncKev, syncNvd } from './sync.service';

/**
 * Per-source timers, mirroring the SLA scheduler convention: guarded by env
 * flags, started from the application bootstrap and never blocking startup.
 */

let nvdTimer: ReturnType<typeof setInterval> | null = null;
let kevTimer: ReturnType<typeof setInterval> | null = null;
let bootTimer: ReturnType<typeof setTimeout> | null = null;

function logError(source: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('already running')) {
    console.warn(`[CVE] ${source} sync skipped: ${message}`);
    return;
  }
  console.error(`[CVE] ${source} sync failed:`, message);
}

async function runNvd() {
  try {
    const result = await syncNvd({});
    console.log(`[CVE] NVD sync ${result.mode}: ${result.processed} CVEs (${result.matched} with client matches)`);
  } catch (error) {
    logError('NVD', error);
  }
}

async function runKev() {
  try {
    const result: any = await syncKev({});
    if (result.skipped) {
      console.log(`[CVE] KEV sync skipped (catalog ${result.catalogVersion || 'unchanged'})`);
    } else {
      console.log(`[CVE] KEV sync: ${result.processed} entries (${result.unlisted} unlisted)`);
    }
  } catch (error) {
    logError('KEV', error);
  }
}

export function startCveScheduler() {
  if (bootTimer || nvdTimer || kevTimer) return;

  const delay = Math.max(5000, env.CVE_SYNC_START_DELAY_MS);
  bootTimer = setTimeout(async () => {
    bootTimer = null;
    if (env.NVD_SYNC_ENABLED) await runNvd();
    if (env.KEV_SYNC_ENABLED) await runKev();
  }, delay);
  (bootTimer as any).unref?.();

  if (env.NVD_SYNC_ENABLED) {
    nvdTimer = setInterval(runNvd, Math.max(60_000, env.NVD_SYNC_INTERVAL_MS));
    (nvdTimer as any).unref?.();
  }
  if (env.KEV_SYNC_ENABLED) {
    kevTimer = setInterval(runKev, Math.max(60_000, env.KEV_SYNC_INTERVAL_MS));
    (kevTimer as any).unref?.();
  }

  console.log(
    `[CVE] Sync scheduler started (NVD ${env.NVD_SYNC_ENABLED ? 'on' : 'off'}, KEV ${env.KEV_SYNC_ENABLED ? 'on' : 'off'})`
  );
}

export function stopCveScheduler() {
  if (bootTimer) clearTimeout(bootTimer);
  if (nvdTimer) clearInterval(nvdTimer);
  if (kevTimer) clearInterval(kevTimer);
  bootTimer = null;
  nvdTimer = null;
  kevTimer = null;
}
