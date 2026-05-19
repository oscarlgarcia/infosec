import { TermReportSchedule, TermReportSnapshot } from '../../db/mongo/models';
import { generateTermReport } from '../analysis/termReport.service';

function calculateNextRun(frequency: string, hour: number = 0, minute: number = 0, dayOfWeek?: number, dayOfMonth?: number): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily': {
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next;
    }
    case 'weekly': {
      const targetDay = dayOfWeek ?? 1;
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      while (next <= now || next.getDay() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    case 'monthly': {
      const targetDay = Math.min(dayOfMonth ?? 1, 28);
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      next.setDate(targetDay);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      return next;
    }
  }
  return new Date(now);
}

export async function listSchedules(filters: { enabled?: boolean }) {
  const query: any = {};
  if (filters.enabled !== undefined) query.enabled = filters.enabled;
  return TermReportSchedule.find(query).sort({ createdAt: -1 }).lean();
}

export async function createSchedule(data: { term: string; frequency: string; createdBy: string; notifyOnChanges?: boolean; scheduleHour?: number; scheduleMinute?: number; dayOfWeek?: number; dayOfMonth?: number }) {
  const scheduleHour = data.scheduleHour ?? 0;
  const scheduleMinute = data.scheduleMinute ?? 0;
  const nextRun = calculateNextRun(data.frequency, scheduleHour, scheduleMinute, data.dayOfWeek, data.dayOfMonth);
  return TermReportSchedule.create({
    term: data.term,
    frequency: data.frequency,
    enabled: true,
    nextRunAt: nextRun,
    createdBy: data.createdBy,
    notifyOnChanges: data.notifyOnChanges !== false,
    scheduleHour,
    scheduleMinute,
    dayOfWeek: data.dayOfWeek,
    dayOfMonth: data.dayOfMonth,
  });
}

export async function updateSchedule(id: string, data: { term?: string; frequency?: string; enabled?: boolean; notifyOnChanges?: boolean; scheduleHour?: number; scheduleMinute?: number; dayOfWeek?: number; dayOfMonth?: number }) {
  const update: any = {};
  if (data.term !== undefined) update.term = data.term;
  if (data.scheduleHour !== undefined) update.scheduleHour = data.scheduleHour;
  if (data.scheduleMinute !== undefined) update.scheduleMinute = data.scheduleMinute;
  if (data.dayOfWeek !== undefined) update.dayOfWeek = data.dayOfWeek;
  if (data.dayOfMonth !== undefined) update.dayOfMonth = data.dayOfMonth;
  if (data.notifyOnChanges !== undefined) update.notifyOnChanges = data.notifyOnChanges;
  if (data.enabled !== undefined) update.enabled = data.enabled;

  const needsRecalc = data.frequency !== undefined || data.scheduleHour !== undefined || data.scheduleMinute !== undefined || data.dayOfWeek !== undefined || data.dayOfMonth !== undefined;

  if (needsRecalc) {
    const existing = await TermReportSchedule.findById(id).lean();
    if (existing) {
      const freq = data.frequency ?? existing.frequency;
      const hour = data.scheduleHour ?? existing.scheduleHour ?? 0;
      const min = data.scheduleMinute ?? existing.scheduleMinute ?? 0;
      const dow = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek;
      const dom = data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth;
      update.nextRunAt = calculateNextRun(freq, hour, min, dow, dom);
    }
  }
  if (data.frequency !== undefined) update.frequency = data.frequency;

  return TermReportSchedule.findByIdAndUpdate(id, update, { new: true }).lean();
}

export async function deleteSchedule(id: string) {
  await TermReportSnapshot.deleteMany({ scheduleId: id });
  return TermReportSchedule.findByIdAndDelete(id);
}

export async function runScheduleNow(id: string) {
  const schedule = await TermReportSchedule.findById(id).lean();
  if (!schedule) return null;
  const report = await generateTermReport({ term: schedule.term, generatedBy: 'scheduler' });
  const snapshot = await TermReportSnapshot.create({
    term: schedule.term,
    scheduleId: schedule._id,
    report,
    metrics: report.metrics,
  });
  const now = new Date();
  const nextRun = calculateNextRun(schedule.frequency, schedule.scheduleHour ?? 0, schedule.scheduleMinute ?? 0, schedule.dayOfWeek, schedule.dayOfMonth);
  await TermReportSchedule.findByIdAndUpdate(id, { lastRunAt: now, nextRunAt: nextRun });
  return { snapshot, report };
}
