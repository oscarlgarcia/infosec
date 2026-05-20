import { TermReportSchedule, TermReportSnapshot } from '../../db/mongo/models';
import { generateTermReport } from '../analysis/termReport.service';

const POLL_INTERVAL_MS = 60000;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

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

async function processDueSchedules() {
  try {
    const now = new Date();
    console.log(`[Report Scheduler] Poll at ${now.toISOString()}, checking for due schedules...`);
    const schedules = await TermReportSchedule.find({
      enabled: true,
      nextRunAt: { $lte: now },
    }).lean();

    console.log(`[Report Scheduler] Found ${schedules.length} due schedules`);
    for (const schedule of schedules) {
      console.log(`[Report Scheduler] Processing schedule "${schedule.term}" (id=${schedule._id}), nextRunAt=${schedule.nextRunAt}, hour=${schedule.scheduleHour}, min=${schedule.scheduleMinute}, freq=${schedule.frequency}`);
      try {
        const report = await generateTermReport({
          term: schedule.term,
          generatedBy: 'scheduler',
        });

        const snapshot = await TermReportSnapshot.create({
          term: schedule.term,
          scheduleId: schedule._id,
          report,
          metrics: report.metrics,
        });

        const nextRun = calculateNextRun(schedule.frequency, schedule.scheduleHour ?? 0, schedule.scheduleMinute ?? 0, schedule.dayOfWeek, schedule.dayOfMonth);

        await TermReportSchedule.findByIdAndUpdate(schedule._id, {
          lastRunAt: new Date(),
          nextRunAt: nextRun,
        });

        if (schedule.notifyOnChanges) {
          const previousSnapshot = await TermReportSnapshot.findOne({
            scheduleId: schedule._id,
            _id: { $ne: snapshot._id },
          }).sort({ generatedAt: -1 }).lean();

          if (previousSnapshot && previousSnapshot.metrics) {
            const prev = previousSnapshot.metrics;
            const curr = report.metrics;
            const changes: string[] = [];
            if (curr.totalSources !== prev.totalSources) changes.push(`Sources: ${prev.totalSources} → ${curr.totalSources}`);
            if (curr.gapCount !== prev.gapCount) changes.push(`Gaps: ${prev.gapCount} → ${curr.gapCount}`);
            if (curr.contradictionCount !== prev.contradictionCount) changes.push(`Contradictions: ${prev.contradictionCount} → ${curr.contradictionCount}`);
            if (changes.length > 0) {
              console.log(`[Report Scheduler] Changes for "${schedule.term}": ${changes.join(', ')}`);
            }
          }
        }
      } catch (error) {
        console.error(`[Report Scheduler] Failed to process schedule "${schedule.term}":`, error);
      }
    }
  } catch (error) {
    console.error('[Report Scheduler] Error processing due schedules:', error);
  }
}

export function startReportScheduler(): void {
  if (schedulerInterval) return;
  console.log('[Report Scheduler] Starting scheduler...');
  processDueSchedules();
  schedulerInterval = setInterval(processDueSchedules, POLL_INTERVAL_MS);
}

export function stopReportScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Report Scheduler] Stopped');
  }
}
