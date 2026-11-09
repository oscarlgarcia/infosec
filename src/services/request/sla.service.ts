import mongoose from 'mongoose';
import {
  BusinessCalendar,
  ClientRequest,
  ClientSlaOverride,
  RequestEvent,
  SlaPolicy,
  ScheduledFollowUp,
} from '../../db/mongo/models';
import { env } from '../../config';
import { isSlaPausedStatus, isTerminalStatus, normalizeStatus } from '../../types/request';
import { logEvent } from './event.service';
import { createNotification } from '../notifications/notification.service';

export interface BusinessCalendarLike {
  timezone?: string;
  workdays?: number[];
  startTime?: string;
  endTime?: string;
  holidays?: Array<Date | string>;
}

export interface SlaPolicyLike {
  _id?: any;
  name?: string;
  requestType?: string;
  priority?: string;
  clientType?: string;
  businessHoursOnly?: boolean;
  responseHours?: number;
  resolutionHours?: number;
  atRiskThresholdPct?: number;
  pauseOnWaitingClient?: boolean;
  calendarId?: any;
}

const DEFAULT_POLICY = {
  name: 'Default',
  businessHoursOnly: true,
  responseHours: 8,
  resolutionHours: 72,
  atRiskThresholdPct: 25,
  pauseOnWaitingClient: true,
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function parseTime(value: string, fallback: number) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function dateKeyInTimezone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function weekdayInTimezone(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return asUtc - date.getTime();
}

function zonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = timezoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}

function isWorkingDay(date: Date, calendar: BusinessCalendarLike): boolean {
  const timeZone = calendar.timezone || 'Europe/Madrid';
  if (!(calendar.workdays || [1, 2, 3, 4, 5]).includes(weekdayInTimezone(date, timeZone))) return false;
  const holidays = (calendar.holidays || []).map((holiday) => dateKeyInTimezone(new Date(holiday), timeZone));
  return !holidays.includes(dateKeyInTimezone(date, timeZone));
}

/**
 * Add working minutes to a start date, skipping weekends and holidays.
 */
export function addBusinessMinutes(start: Date, minutes: number, calendar: BusinessCalendarLike = {}): Date {
  if (!Number.isFinite(minutes) || minutes <= 0) return new Date(start);
  const timeZone = calendar.timezone || 'Europe/Madrid';
  const startMinutes = parseTime(calendar.startTime || '09:00', 9 * 60);
  const endMinutes = parseTime(calendar.endTime || '18:00', 18 * 60);
  let remaining = minutes;
  let cursor = new Date(start);

  for (let guard = 0; guard < 3660 && remaining > 0; guard++) {
    const parts = zonedDateParts(cursor, timeZone);
    const windowStart = zonedTimeToUtc(parts.year, parts.month, parts.day, Math.floor(startMinutes / 60), startMinutes % 60, timeZone);
    const windowEnd = zonedTimeToUtc(parts.year, parts.month, parts.day, Math.floor(endMinutes / 60), endMinutes % 60, timeZone);

    if (!isWorkingDay(cursor, calendar) || cursor >= windowEnd) {
      const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 12, 0, 0));
      const nextParts = zonedDateParts(nextDay, timeZone);
      cursor = zonedTimeToUtc(nextParts.year, nextParts.month, nextParts.day, Math.floor(startMinutes / 60), startMinutes % 60, timeZone);
      continue;
    }

    if (cursor < windowStart) cursor = windowStart;
    const available = Math.round((windowEnd.getTime() - cursor.getTime()) / 60000);
    if (available <= 0) {
      const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 12, 0, 0));
      const nextParts = zonedDateParts(nextDay, timeZone);
      cursor = zonedTimeToUtc(nextParts.year, nextParts.month, nextParts.day, Math.floor(startMinutes / 60), startMinutes % 60, timeZone);
      continue;
    }
    const used = Math.min(available, remaining);
    remaining -= used;
    cursor = new Date(cursor.getTime() + used * 60000);
  }

  return cursor;
}

export function addSlaTime(start: Date, hours: number, policy: SlaPolicyLike, calendar: BusinessCalendarLike = {}): Date {
  if (policy.businessHoursOnly === false) {
    return new Date(start.getTime() + hours * 3600000);
  }
  return addBusinessMinutes(start, Math.round(hours * 60), calendar);
}

export async function ensureDefaultSlaConfiguration() {
  let calendar = await BusinessCalendar.findOne({ name: 'Default (Europe/Madrid)' });
  if (!calendar) {
    calendar = await BusinessCalendar.create({
      name: 'Default (Europe/Madrid)',
      timezone: 'Europe/Madrid',
      workdays: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '18:00',
      holidays: [],
    });
  }
  const count = await SlaPolicy.countDocuments({});
  if (count === 0) {
    await SlaPolicy.create({
      name: 'Default',
      businessHoursOnly: true,
      responseHours: 8,
      resolutionHours: 72,
      atRiskThresholdPct: 25,
      pauseOnWaitingClient: true,
      calendarId: calendar._id,
      active: true,
    });
  }
  return calendar;
}

export async function resolveSlaPolicy(request: any): Promise<{ policy: SlaPolicyLike; calendar: BusinessCalendarLike }> {
  const policies = await SlaPolicy.find({ active: true }).lean();
  const candidates = policies
    .filter((policy: any) => {
      if (policy.requestType && policy.requestType !== request.requestType) return false;
      if (policy.priority && policy.priority !== request.priority) return false;
      if (policy.clientType && policy.clientType !== request.clientType) return false;
      return true;
    })
    .map((policy: any) => ({
      policy,
      score: (policy.requestType ? 4 : 0) + (policy.priority ? 2 : 0) + (policy.clientType ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const policy = candidates[0]?.policy || (await SlaPolicy.findOne({ active: true }).lean()) || DEFAULT_POLICY;

  // Client-level exception: the most specific active override wins and only
  // the fields it defines are merged over the global policy.
  let override: any = null;
  const clientId = (request as any).clientId?._id || (request as any).clientId;
  if (clientId && mongoose.Types.ObjectId.isValid(String(clientId))) {
    const overrides = await ClientSlaOverride.find({ clientId, active: true }).lean();
    const now = Date.now();
    override =
      overrides
        .filter((item: any) => {
          if (item.effectiveFrom && new Date(item.effectiveFrom).getTime() > now) return false;
          if (item.effectiveTo && new Date(item.effectiveTo).getTime() < now) return false;
          if (item.requestType && item.requestType !== (request as any).requestType) return false;
          if (item.priority && item.priority !== (request as any).priority) return false;
          return true;
        })
        .sort((a: any, b: any) => {
          const score = (item: any) => (item.requestType ? 2 : 0) + (item.priority ? 1 : 0);
          return score(b) - score(a);
        })[0] || null;
  }

  const effectivePolicy: any = { ...policy };
  if (override) {
    for (const key of [
      'businessHoursOnly',
      'responseHours',
      'resolutionHours',
      'atRiskThresholdPct',
      'pauseOnWaitingClient',
      'calendarId',
    ]) {
      if (override[key] !== undefined && override[key] !== null) effectivePolicy[key] = override[key];
    }
  }

  const calendar = effectivePolicy.calendarId
    ? await BusinessCalendar.findById(effectivePolicy.calendarId).lean()
    : await BusinessCalendar.findOne({ active: true }).lean();
  return { policy: effectivePolicy, calendar: (calendar || {}) as BusinessCalendarLike };
}

export function computeSlaState(request: any, policy: SlaPolicyLike, now: Date = new Date()): 'on_track' | 'at_risk' | 'breached' | 'paused' {
  const status = normalizeStatus(request.status);
  if (isTerminalStatus(status)) return request.slaState || 'on_track';
  if (policy.pauseOnWaitingClient !== false && isSlaPausedStatus(status)) return 'paused';

  const due = request.slaResolutionDueAt ? new Date(request.slaResolutionDueAt) : null;
  if (!due) return 'on_track';
  if (now.getTime() > due.getTime()) return 'breached';

  const start = new Date(request.createdAt || now);
  const total = Math.max(1, due.getTime() - start.getTime());
  const remaining = due.getTime() - now.getTime();
  const threshold = Number(policy.atRiskThresholdPct ?? 25) / 100;
  return remaining <= total * threshold ? 'at_risk' : 'on_track';
}

export async function refreshRequestSla(requestId: string, now: Date = new Date()) {
  const request = await ClientRequest.findById(requestId);
  if (!request) return null;

  const { policy, calendar } = await resolveSlaPolicy(request);
  if (!request.slaResponseDueAt || !request.slaResolutionDueAt) {
    const start = request.createdAt || now;
    request.slaResponseDueAt = addSlaTime(start, policy.responseHours ?? 8, policy, calendar);
    request.slaResolutionDueAt = addSlaTime(start, policy.resolutionHours ?? 72, policy, calendar);
    request.slaPolicyId = policy._id;
  }

  request.slaState = computeSlaState(request, policy, now) as any;
  await request.save();
  return { request, policy, calendar };
}

export async function applySlaStatusTransition(request: any, toStatus: string, now: Date = new Date()) {
  const { policy, calendar } = await resolveSlaPolicy(request);
  const target = normalizeStatus(toStatus);
  const shouldPause = policy.pauseOnWaitingClient !== false && isSlaPausedStatus(target);

  if (shouldPause && !request.slaPausedAt) {
    request.slaPausedAt = now;
  } else if (!shouldPause && request.slaPausedAt) {
    const pausedMs = now.getTime() - new Date(request.slaPausedAt).getTime();
    request.pausedMsTotal = Number(request.pausedMsTotal || 0) + pausedMs;
    if (request.slaResponseDueAt) request.slaResponseDueAt = new Date(new Date(request.slaResponseDueAt).getTime() + pausedMs);
    if (request.slaResolutionDueAt) request.slaResolutionDueAt = new Date(new Date(request.slaResolutionDueAt).getTime() + pausedMs);
    request.slaPausedAt = undefined;
  }

  request.slaState = computeSlaState(request, policy, now);
  return { policy, calendar };
}

async function logOnce(requestId: string, type: 'sla_at_risk' | 'sla_breached', dedupeKey: string, body: string) {
  const exists = await RequestEvent.exists({ requestId, type, 'metadata.dedupeKey': dedupeKey });
  if (exists) return false;
  await logEvent({
    requestId,
    type,
    visibility: 'internal',
    authorName: 'SLA Scheduler',
    body,
    metadata: { dedupeKey },
  });
  return true;
}

async function notifyOwners(request: any, title: string, body: string, dedupeKey: string, type: 'sla_at_risk' | 'sla_breached' | 'followup_due') {
  const owners = [request.infosecOwnerId, request.salesOwnerId, request.clientOwnerId].filter(Boolean);
  await Promise.allSettled(
    owners.map((userId: string) =>
      createNotification({
        userId,
        type,
        title,
        body,
        link: `/requests/${request._id}`,
        requestId: String(request._id),
        dedupeKey: `${dedupeKey}:${userId}`,
      })
    )
  );
}

async function processSlaState(request: any, now: Date) {
  const refreshed = await refreshRequestSla(String(request._id), now);
  if (!refreshed) return;
  const current = refreshed.request;
  if (!current.slaResolutionDueAt) return;
  const dueIso = new Date(current.slaResolutionDueAt).toISOString();
  const state = current.slaState;

  if (state === 'breached') {
    const key = `sla:breached:${current._id}:${dueIso}`;
    if (await logOnce(String(current._id), 'sla_breached', key, 'SLA de resolución incumplido')) {
      await notifyOwners(current, `SLA incumplido · ${current.requestKey}`, current.title || current.requestType, key, 'sla_breached');
    }
  } else if (state === 'at_risk') {
    const key = `sla:at_risk:${current._id}:${dueIso}`;
    if (await logOnce(String(current._id), 'sla_at_risk', key, 'SLA de resolución en riesgo')) {
      await notifyOwners(current, `SLA en riesgo · ${current.requestKey}`, current.title || current.requestType, key, 'sla_at_risk');
    }
  }
}

async function processDeadlineReminders(request: any, now: Date) {
  if (!request.deadline) return;
  const hours = (new Date(request.deadline).getTime() - now.getTime()) / 3600000;
  const deadlineIso = new Date(request.deadline).toISOString();
  for (const window of [48, 24]) {
    if (hours <= window && hours > 0) {
      const key = `deadline:${window}h:${request._id}:${deadlineIso}`;
      const exists = await RequestEvent.exists({ requestId: request._id, type: 'system', 'metadata.dedupeKey': key });
      if (!exists) {
        await logEvent({
          requestId: request._id,
          type: 'system',
          visibility: 'internal',
          authorName: 'SLA Scheduler',
          body: `Recordatorio: el deadline vence en menos de ${window}h`,
          metadata: { dedupeKey: key },
        });
        await notifyOwners(request, `Deadline en ${window}h · ${request.requestKey}`, request.title || request.requestType, key, 'followup_due');
      }
    }
  }
}

async function processStale(request: any, now: Date, staleDays = 5) {
  const last = new Date(request.lastActivityAt || request.updatedAt || request.createdAt);
  if ((now.getTime() - last.getTime()) / 86400000 < staleDays) return;
  const day = now.toISOString().slice(0, 10);
  const key = `stale:${request._id}:${day}`;
  const exists = await RequestEvent.exists({ requestId: request._id, type: 'system', 'metadata.dedupeKey': key });
  if (exists) return;
  await logEvent({
    requestId: request._id,
    type: 'system',
    visibility: 'internal',
    authorName: 'SLA Scheduler',
    body: `Sin movimiento desde ${last.toISOString().slice(0, 10)}`,
    metadata: { dedupeKey: key },
  });
  await notifyOwners(request, `Sin movimiento · ${request.requestKey}`, request.title || request.requestType, key, 'followup_due');
}

async function processFollowUps(now: Date) {
  const followUps = await ScheduledFollowUp.find({ status: 'pending', dueAt: { $lte: now } }).limit(200);
  for (const followUp of followUps) {
    followUp.status = 'done';
    followUp.processedAt = now;
    await followUp.save();
    await logEvent({
      requestId: followUp.requestId,
      threadId: followUp.threadId,
      type: 'system',
      visibility: 'internal',
      authorName: 'SLA Scheduler',
      body: `Follow-up programado: ${followUp.note || 'recordatorio'}`,
      metadata: { followUpId: String(followUp._id) },
    });
    if (followUp.assigneeId) {
      await createNotification({
        userId: followUp.assigneeId,
        type: 'followup_due',
        title: 'Follow-up programado',
        body: followUp.note || '',
        link: `/requests/${followUp.requestId}`,
        requestId: String(followUp.requestId),
        dedupeKey: `followup:${followUp._id}`,
      });
    }
  }
}

export async function runSlaSweep(now: Date = new Date()) {
  await ensureDefaultSlaConfiguration();
  const requests = await ClientRequest.find({
    status: { $nin: ['closed', 'cancelled', 'completed'] },
  }).limit(1000);

  for (const request of requests) {
    try {
      await processSlaState(request, now);
      if (request.deadline) await processDeadlineReminders(request, now);
      await processStale(request, now);
    } catch (error) {
      console.error(`SLA sweep failed for ${request.requestKey}:`, (error as Error).message);
    }
  }
  await processFollowUps(now);
  return { processed: requests.length, at: now.toISOString() };
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startSlaScheduler() {
  if (!env.SLA_SCHEDULER_ENABLED || schedulerTimer) return;
  const interval = env.SLA_SCHEDULER_INTERVAL_MS || 15 * 60 * 1000;
  schedulerTimer = setInterval(() => {
    runSlaSweep().catch((error) => console.error('SLA scheduler error:', error));
  }, interval);
  setTimeout(() => runSlaSweep().catch((error) => console.error('SLA scheduler initial run error:', error)), 10000);
  console.log('✅ SLA scheduler started');
}

export function stopSlaScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
}
