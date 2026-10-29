import { describe, expect, it } from 'vitest';
import {
  addBusinessMinutes,
  addSlaTime,
  computeSlaState,
} from '../src/services/request/sla.service';

const MADRID = { timezone: 'Europe/Madrid' };

// 2026-01-05 is a Monday. Madrid is UTC+1 in January.
const utc = (iso: string) => new Date(iso);
const iso = (date: Date) => date.toISOString();

describe('business minutes', () => {
  it('adds minutes inside the working window', () => {
    const result = addBusinessMinutes(utc('2026-01-05T08:00:00Z'), 60, MADRID);
    // 09:00 local + 60 min = 10:00 local = 09:00 UTC
    expect(iso(result)).toBe('2026-01-05T09:00:00.000Z');
  });

  it('clamps a start before the working day to the start time', () => {
    const result = addBusinessMinutes(utc('2026-01-05T05:00:00Z'), 30, MADRID);
    // 06:00 local -> clamped to 09:00 local + 30 min = 09:30 local = 08:30 UTC
    expect(iso(result)).toBe('2026-01-05T08:30:00.000Z');
  });

  it('rolls over to the next working day', () => {
    const result = addBusinessMinutes(utc('2026-01-05T16:30:00Z'), 60, MADRID);
    // 17:30 local + 30 min to 18:00, remaining 30 min on Tuesday 09:30 local = 08:30 UTC
    expect(iso(result)).toBe('2026-01-06T08:30:00.000Z');
  });

  it('skips weekends', () => {
    // Friday 2026-01-09 17:30 local + 60 min -> Monday 2026-01-12 09:30 local
    const result = addBusinessMinutes(utc('2026-01-09T16:30:00Z'), 60, MADRID);
    expect(iso(result)).toBe('2026-01-12T08:30:00.000Z');
  });

  it('skips configured holidays', () => {
    const calendar = { ...MADRID, holidays: ['2026-01-06'] };
    // Monday 17:30 local + 60 min: 30 min Monday, 30 min Wednesday (Tuesday is a holiday)
    const result = addBusinessMinutes(utc('2026-01-05T16:30:00Z'), 60, calendar);
    expect(iso(result)).toBe('2026-01-07T08:30:00.000Z');
  });

  it('honours custom working hours', () => {
    const calendar = { ...MADRID, startTime: '08:00', endTime: '12:00' };
    const result = addBusinessMinutes(utc('2026-01-05T11:30:00Z'), 60, calendar);
    // 12:30 local is past the 12:00 close, so the clock restarts next day at
    // 08:00 local + 60 min = 09:00 local = 08:00 UTC
    expect(iso(result)).toBe('2026-01-06T08:00:00.000Z');
  });

  it('returns the start date for zero or negative minutes', () => {
    const start = utc('2026-01-05T08:00:00Z');
    expect(addBusinessMinutes(start, 0, MADRID).getTime()).toBe(start.getTime());
    expect(addBusinessMinutes(start, -10, MADRID).getTime()).toBe(start.getTime());
  });

  it('addSlaTime uses calendar hours when businessHoursOnly', () => {
    const result = addSlaTime(utc('2026-01-05T08:00:00Z'), 8, { businessHoursOnly: true }, MADRID);
    // 09:00 local + 8 working hours = 17:00 local = 16:00 UTC
    expect(iso(result)).toBe('2026-01-05T16:00:00.000Z');
  });

  it('addSlaTime uses wall-clock hours when businessHoursOnly is false', () => {
    const result = addSlaTime(utc('2026-01-05T08:00:00Z'), 8, { businessHoursOnly: false }, MADRID);
    expect(iso(result)).toBe('2026-01-05T16:00:00.000Z');
  });
});

describe('SLA state', () => {
  const base = {
    status: 'working',
    createdAt: '2026-01-01T00:00:00.000Z',
    slaResolutionDueAt: '2026-01-05T00:00:00.000Z',
  };

  it('is on_track far from the due date', () => {
    expect(computeSlaState(base, { atRiskThresholdPct: 25 }, utc('2026-01-02T00:00:00Z'))).toBe('on_track');
  });

  it('is at_risk inside the threshold window', () => {
    expect(computeSlaState(base, { atRiskThresholdPct: 25 }, utc('2026-01-04T12:00:00Z'))).toBe('at_risk');
  });

  it('is breached after the due date', () => {
    expect(computeSlaState(base, { atRiskThresholdPct: 25 }, utc('2026-01-06T00:00:00Z'))).toBe('breached');
  });

  it('is paused while waiting on the client', () => {
    expect(
      computeSlaState({ ...base, status: 'waiting_client' }, { pauseOnWaitingClient: true }, utc('2026-01-06T00:00:00Z'))
    ).toBe('paused');
  });

  it('does not pause when the policy disables it', () => {
    expect(
      computeSlaState({ ...base, status: 'waiting_client' }, { pauseOnWaitingClient: false }, utc('2026-01-06T00:00:00Z'))
    ).toBe('breached');
  });

  it('keeps the stored state for terminal requests', () => {
    expect(
      computeSlaState({ ...base, status: 'closed', slaState: 'breached' }, {}, utc('2026-02-01T00:00:00Z'))
    ).toBe('breached');
  });
});
