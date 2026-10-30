import { Client, CveAdvisory, CveImpact, CveRecord, CveSyncState } from '../../db/mongo/models';
import { env } from '../../config';
import type { RequestActor } from '../request/request.service';
import { createAdvisory } from '../request/cve.service';
import {
  mapKevEntry,
  mapNvdCve,
  splitDateWindows,
  type KevData,
  type KevEntry,
} from './mappers';
import { fetchKevCatalog } from './kev.client';
import { iterateNvdWindow } from './nvd.client';
import { matchClient, matchRecord, type MatchableClient, type MatchResult } from './matcher';

const OVERLAP_MS = 5 * 60 * 1000;
const LOCK_TTL_MS = 30 * 60 * 1000;
const BATCH_SIZE = 500;

type SyncKey = 'nvd' | 'kev';
type SyncMode = 'incremental' | 'backfill' | 'full';

const running = new Set<SyncKey>();

export interface SyncNvdOptions {
  mode?: SyncMode;
  from?: string | Date;
  to?: string | Date;
}

function syncError(message: string, statusCode = 500) {
  return Object.assign(new Error(message), { statusCode });
}

function defaultBackfillStart(): Date {
  const parsed = new Date(env.NVD_BACKFILL_START);
  return Number.isNaN(parsed.getTime()) ? new Date('2026-01-01T00:00:00Z') : parsed;
}

async function getOrCreateState(key: SyncKey) {
  return CveSyncState.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, status: 'idle', mode: 'incremental' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function acquireLock(key: SyncKey, reserved = false) {
  if (!reserved && running.has(key)) throw syncError(`A ${key.toUpperCase()} sync is already running`, 409);
  const stale = new Date(Date.now() - LOCK_TTL_MS);
  const state = await CveSyncState.findOneAndUpdate(
    {
      key,
      $or: [{ lockedAt: { $exists: false } }, { lockedAt: null }, { lockedAt: { $lt: stale } }],
    },
    { $set: { lockedAt: new Date() } },
    { new: true }
  );
  if (!state) throw syncError(`A ${key.toUpperCase()} sync is already running`, 409);
  running.add(key);
  return state;
}

async function releaseLock(key: SyncKey) {
  running.delete(key);
  await CveSyncState.updateOne({ key }, { $unset: { lockedAt: 1 } }).catch(() => undefined);
}

async function updateState(key: SyncKey, patch: Record<string, any>) {
  await CveSyncState.updateOne({ key }, { $set: patch });
}

export function isSyncRunning(key?: SyncKey): boolean {
  return key ? running.has(key) : running.size > 0;
}

async function loadMatchableClients(): Promise<MatchableClient[]> {
  const clients = await Client.find({ customerStatus: { $ne: 'inactive' } })
    .select('name tags technologyInventory')
    .lean();
  return clients as unknown as MatchableClient[];
}

function normalizeKev(kev: KevData | undefined): KevData | undefined {
  if (!kev) return undefined;
  return {
    ...kev,
    listed: kev.listed !== false,
  };
}

/** Drops undefined values so Mongo does not persist them as null. */
function compact<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

async function upsertNvdBatch(items: any[], clients: MatchableClient[]) {
  const now = new Date();
  const operations: any[] = [];
  let skipped = 0;

  for (const item of items) {
    const mapped = mapNvdCve(item, { ingestRejected: env.NVD_INGEST_REJECTED });
    if (!mapped) {
      skipped += 1;
      continue;
    }
    const kev = normalizeKev(mapped.kev);
    const matches = env.CVE_MATCHER_ENABLED ? matchRecord(mapped, clients) : [];
    const set: Record<string, any> = {
      severity: mapped.severity,
      cvssScore: mapped.cvssScore,
      cvssVersion: mapped.cvssVersion,
      cvssVector: mapped.cvssVector,
      summary: mapped.summary,
      summaryEs: mapped.summaryEs,
      vendors: mapped.vendors,
      products: mapped.products,
      cpes: mapped.cpes,
      cwe: mapped.cwe,
      references: mapped.references,
      publishedAt: mapped.publishedAt,
      lastModified: mapped.lastModified,
      nvdStatus: mapped.nvdStatus,
      matches,
      lastSyncedAt: now,
    };
    if (kev) set.kev = kev;
    // Do not overwrite an analyst-edited record title on every sync.
    operations.push({
      updateOne: {
        filter: { cveId: mapped.cveId },
        update: {
          $set: compact(set),
          $setOnInsert: {
            cveId: mapped.cveId,
            title: mapped.title,
            sourceUrl: mapped.sourceUrl,
            firstSeenAt: now,
          },
          $addToSet: { source: 'nvd' },
        },
        upsert: true,
      },
    });
  }

  if (operations.length) {
    await CveRecord.bulkWrite(operations, { ordered: false });
  }
  return { processed: items.length, upserted: operations.length, skipped, matched: operations.filter((op) => op.updateOne.update.$set.matches.length > 0).length };
}

async function syncNvdInternal(options: SyncNvdOptions, reserved = false) {
  const key: SyncKey = 'nvd';
  await getOrCreateState(key);
  let state: any;
  try {
    state = await acquireLock(key, reserved);
  } catch (error) {
    if (reserved) running.delete(key);
    throw error;
  }
  const now = new Date();

  try {
    const cursorTo = state.cursorTo ? new Date(state.cursorTo) : null;
    const backfillFinished = cursorTo ? now.getTime() - cursorTo.getTime() < 60_000 : false;
    const mode: SyncMode =
      options.mode ||
      (state.mode === 'backfill' && !backfillFinished ? 'backfill' : cursorTo ? 'incremental' : 'backfill');

    let from: Date;
    if (mode === 'backfill') {
      from = options.from
        ? new Date(options.from)
        : state.mode === 'backfill' && cursorTo
          ? cursorTo
          : defaultBackfillStart();
    } else {
      from = options.from
        ? new Date(options.from)
        : cursorTo
          ? new Date(cursorTo.getTime() - OVERLAP_MS)
          : defaultBackfillStart();
    }
    const to = options.to ? new Date(options.to) : now;
    const usePublishedDates = mode === 'backfill';
    const windows = splitDateWindows(from, to);

    await updateState(key, {
      status: 'running',
      mode,
      lastRunAt: now,
      lastError: undefined,
      cursorFrom: from,
      progress: { page: 0, processed: 0, total: 0, startedAt: now },
      stats: { windowsTotal: windows.length, windowsDone: 0, processed: 0, upserted: 0, matched: 0, skipped: 0 },
    });

    if (!windows.length) {
      await updateState(key, { status: 'idle', lastSuccessAt: now, cursorTo: to, mode: 'incremental' });
      return { mode, processed: 0, upserted: 0, matched: 0, skipped: 0, windows: 0 };
    }

    const clients = await loadMatchableClients();
    const totals = { processed: 0, upserted: 0, matched: 0, skipped: 0 };
    let done = 0;

    for (const window of windows) {
      await iterateNvdWindow({
        from: window.start,
        to: window.end,
        usePublishedDates,
        onItems: async (items) => {
          const result = await upsertNvdBatch(items, clients);
          totals.processed += result.processed;
          totals.upserted += result.upserted;
          totals.matched += result.matched;
          totals.skipped += result.skipped;
        },
        onProgress: async (progress) => {
          await updateState(key, {
            progress: {
              page: progress.page,
              processed: totals.processed,
              total: progress.total,
              startedAt: now,
            },
          });
        },
      });
      done += 1;
      await updateState(key, {
        cursorFrom: from,
        cursorTo: window.end,
        stats: { windowsTotal: windows.length, windowsDone: done, ...totals },
      });
    }

    await updateState(key, {
      status: 'idle',
      mode: 'incremental',
      cursorTo: to,
      lastSuccessAt: new Date(),
      lastError: undefined,
      progress: { page: 0, processed: totals.processed, total: totals.processed, startedAt: now },
      stats: { windowsTotal: windows.length, windowsDone: done, ...totals },
    });

    return { mode, ...totals, windows: windows.length };
  } catch (error) {
    const message = (error as Error).message || 'NVD sync failed';
    await updateState(key, {
      status: 'error',
      lastError: message,
      progress: { page: 0, processed: 0, total: 0, startedAt: now },
    });
    throw error;
  } finally {
    await releaseLock(key);
  }
}

export async function syncNvd(options: SyncNvdOptions = {}) {
  return syncNvdInternal(options);
}

/**
 * Reserves the in-process lock synchronously (so concurrent HTTP requests get
 * a deterministic 409) and runs the sync in the background.
 */
export function startNvdSync(options: SyncNvdOptions = {}) {
  if (running.has('nvd')) throw syncError('A NVD sync is already running', 409);
  running.add('nvd');
  syncNvdInternal(options, true).catch((error) =>
    console.error('[CVE] Manual NVD sync failed:', error)
  );
}

export interface SyncKevOptions {
  force?: boolean;
}

async function upsertKevEntries(entries: KevEntry[], clients: MatchableClient[]) {
  const now = new Date();
  const operations: any[] = [];
  const ids: string[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const mapped = mapKevEntry(entry);
    if (!mapped) {
      skipped += 1;
      continue;
    }
    ids.push(mapped.cveId);
    const set: Record<string, any> = {
      kev: mapped.kev,
      lastSyncedAt: now,
    };
    const addToSet: Record<string, any> = {
      source: 'kev',
      vendors: { $each: mapped.vendors },
      products: { $each: mapped.products },
    };
    operations.push({
      updateOne: {
        filter: { cveId: mapped.cveId },
        update: {
          $set: set,
          $setOnInsert: {
            cveId: mapped.cveId,
            title: mapped.title,
            summary: mapped.summary,
            severity: 'high',
            publishedAt: mapped.publishedAt,
            sourceUrl: mapped.sourceUrl,
            firstSeenAt: now,
          },
          $addToSet: addToSet,
        },
        upsert: true,
      },
    });
  }

  if (operations.length) {
    await CveRecord.bulkWrite(operations, { ordered: false });
  }

  // Compute matches for KEV-only records that NVD has not enriched yet.
  if (env.CVE_MATCHER_ENABLED && ids.length) {
    const unmatched = await CveRecord.find({
      cveId: { $in: ids },
      $or: [{ matches: { $size: 0 } }, { matches: { $exists: false } }],
    }).lean();
    const matchOps: any[] = [];
    for (const record of unmatched as any[]) {
      const matches = matchRecord(record, clients);
      if (matches.length) matchOps.push({ updateOne: { filter: { _id: record._id }, update: { $set: { matches } } } });
    }
    if (matchOps.length) await CveRecord.bulkWrite(matchOps, { ordered: false });
  }

  const stillListed = ids.length
    ? await CveRecord.updateMany(
        { 'kev.listed': true, cveId: { $nin: ids } },
        { $set: { 'kev.listed': false } }
      )
    : { modifiedCount: 0 };

  return {
    processed: entries.length,
    upserted: operations.length,
    skipped,
    unlisted: stillListed.modifiedCount || 0,
  };
}

async function syncKevInternal(options: SyncKevOptions, reserved = false) {
  const key: SyncKey = 'kev';
  await getOrCreateState(key);
  let state: any;
  try {
    state = await acquireLock(key, reserved);
  } catch (error) {
    if (reserved) running.delete(key);
    throw error;
  }
  const now = new Date();

  try {
    await updateState(key, {
      status: 'running',
      mode: 'full',
      lastRunAt: now,
      lastError: undefined,
      progress: { page: 0, processed: 0, total: 0, startedAt: now },
    });

    const catalog = await fetchKevCatalog();
    if (!options.force && state.catalogVersion && catalog.catalogVersion && state.catalogVersion === catalog.catalogVersion) {
      await updateState(key, {
        status: 'idle',
        lastSuccessAt: new Date(),
        catalogVersion: catalog.catalogVersion,
        lastError: undefined,
        stats: { skipped: true, reason: 'catalog version unchanged', count: catalog.count || 0 },
      });
      return { skipped: true, catalogVersion: catalog.catalogVersion, processed: 0, upserted: 0, unlisted: 0 };
    }

    const clients = await loadMatchableClients();
    const entries = catalog.vulnerabilities || [];
    await updateState(key, {
      catalogVersion: catalog.catalogVersion,
      progress: { page: 1, processed: 0, total: entries.length, startedAt: now },
    });
    const result = await upsertKevEntries(entries, clients);

    await updateState(key, {
      status: 'idle',
      lastSuccessAt: new Date(),
      catalogVersion: catalog.catalogVersion,
      lastError: undefined,
      stats: result,
      progress: { page: 1, processed: result.processed, total: entries.length, startedAt: now },
    });

    return { ...result, catalogVersion: catalog.catalogVersion, skipped: false };
  } catch (error) {
    const message = (error as Error).message || 'KEV sync failed';
    await updateState(key, { status: 'error', lastError: message });
    throw error;
  } finally {
    await releaseLock(key);
  }
}

export async function syncKev(options: SyncKevOptions = {}) {
  return syncKevInternal(options);
}

/** See {@link startNvdSync}: reserves the lock synchronously, runs async. */
export function startKevSync(options: SyncKevOptions = {}) {
  if (running.has('kev')) throw syncError('A KEV sync is already running', 409);
  running.add('kev');
  syncKevInternal(options, true).catch((error) =>
    console.error('[CVE] Manual KEV sync failed:', error)
  );
}

export async function syncAll() {
  const nvd = await syncNvdInternal({});
  const kev = await syncKevInternal({});
  return { nvd, kev };
}

export async function getSyncStatus() {
  const states = await CveSyncState.find({ key: { $in: ['nvd', 'kev'] } }).lean();
  const [records, kevListed, advisories, matched] = await Promise.all([
    CveRecord.countDocuments({}),
    CveRecord.countDocuments({ 'kev.listed': true }),
    CveAdvisory.countDocuments({}),
    CveRecord.countDocuments({ 'matches.0': { $exists: true } }),
  ]);
  return {
    states,
    running: [...running],
    catalog: { records, kevListed, advisories, matched },
    config: {
      nvdIntervalMs: env.NVD_SYNC_INTERVAL_MS,
      kevIntervalMs: env.KEV_SYNC_INTERVAL_MS,
      backfillStart: env.NVD_BACKFILL_START,
      matcherEnabled: env.CVE_MATCHER_ENABLED,
    },
  };
}

export async function recomputeRecordMatches(cveId: string) {
  const record = await CveRecord.findOne({ cveId: String(cveId).toUpperCase() }).lean();
  if (!record) throw syncError('CVE record not found', 404);
  const clients = await loadMatchableClients();
  const matches = matchRecord(record as any, clients);
  await CveRecord.updateOne({ _id: (record as any)._id }, { $set: { matches } });
  return matches;
}

export async function recomputeClientMatches(clientId: string) {
  const client = await Client.findById(clientId).select('name tags technologyInventory').lean();
  if (!client) throw syncError('Client not found', 404);

  const cursor = CveRecord.find({}).select('matches vendors products cpes').cursor();
  let scanned = 0;
  let changed = 0;
  let operations: any[] = [];

  const flush = async () => {
    if (!operations.length) return;
    await CveRecord.bulkWrite(operations, { ordered: false });
    operations = [];
  };

  for await (const record of cursor as any) {
    scanned += 1;
    const match = matchClient(record, client as unknown as MatchableClient);
    const current: MatchResult[] = Array.isArray(record.matches) ? record.matches : [];
    const hadEntry = current.some((entry) => String(entry.clientId) === String(clientId));
    if (match || hadEntry) {
      const others = current.filter((entry) => String(entry.clientId) !== String(clientId));
      const next = match ? [...others, match] : others;
      operations.push({ updateOne: { filter: { _id: record._id }, update: { $set: { matches: next } } } });
      changed += 1;
    }
    if (operations.length >= BATCH_SIZE) await flush();
  }
  await flush();

  return { clientId, scanned, changed };
}

export interface PromoteResult {
  advisory: any;
  created: boolean;
  impacts: number;
}

/**
 * Promotes one catalog record into a curated advisory. Idempotent: if an
 * advisory already exists for the CVE it is linked and returned unchanged.
 */
export async function promoteToAdvisory(cveId: string, actor?: RequestActor): Promise<PromoteResult> {
  const normalized = String(cveId || '').trim().toUpperCase();
  const record: any = await CveRecord.findOne({ cveId: normalized }).lean();
  if (!record) throw syncError('CVE record not found', 404);

  if (record.advisoryId) {
    const existing = await CveAdvisory.findById(record.advisoryId).lean();
    if (existing) return { advisory: existing, created: false, impacts: 0 };
  }

  const existing = await CveAdvisory.findOne({ cveId: normalized }).lean();
  if (existing) {
    await CveRecord.updateOne({ _id: record._id }, { $set: { advisoryId: (existing as any)._id } });
    return { advisory: existing, created: false, impacts: 0 };
  }

  const advisory = await createAdvisory(
    {
      cveId: normalized,
      title: record.title,
      severity: record.severity,
      cvssScore: record.cvssScore,
      products: (record.products || []).slice(0, 50),
      publishedAt: record.publishedAt ? new Date(record.publishedAt).toISOString() : undefined,
      summary: record.summaryEs || record.summary,
      posture: 'unknown',
      status: 'draft',
      sourceUrl: record.sourceUrl,
      cveRecordId: String(record._id),
    },
    actor
  );

  await CveRecord.updateOne({ _id: record._id }, { $set: { advisoryId: (advisory as any)._id } });

  let impacts = 0;
  for (const match of record.matches || []) {
    if (!match?.clientId) continue;
    const result = await CveImpact.updateOne(
      { cveId: normalized, clientId: match.clientId },
      {
        $setOnInsert: {
          cveId: normalized,
          advisoryId: (advisory as any)._id,
          clientId: match.clientId,
          affected: false,
          posture: 'under_review',
          rationale: `Auto-matched (${Math.round((match.confidence || 0) * 100)}%): ${(match.reasons || []).join('; ')}`,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount) impacts += 1;
  }

  return { advisory, created: true, impacts };
}
