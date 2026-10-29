import { describe, expect, it } from 'vitest';
import {
  AllowedTransitions,
  RequestStatuses,
  canTransition,
  isActiveStatus,
  isSlaPausedStatus,
  isTerminalStatus,
  normalizeStatus,
  toLegacyStatus,
} from '../src/types/request';

describe('request status pipeline', () => {
  it('exposes the confirmed pipeline in the expected order', () => {
    expect(RequestStatuses).toEqual([
      'new',
      'in_analysis',
      'waiting_client',
      'working',
      'on_hold',
      'cancelled',
      'delivered',
      'closed',
    ]);
  });

  it('maps legacy statuses to the new pipeline', () => {
    expect(normalizeStatus('open')).toBe('new');
    expect(normalizeStatus('in_progress')).toBe('in_analysis');
    expect(normalizeStatus('completed')).toBe('closed');
  });

  it('maps new statuses back to the legacy contract', () => {
    expect(toLegacyStatus('new')).toBe('open');
    expect(toLegacyStatus('working')).toBe('in_progress');
    expect(toLegacyStatus('waiting_client')).toBe('in_progress');
    expect(toLegacyStatus('delivered')).toBe('completed');
    expect(toLegacyStatus('closed')).toBe('completed');
    expect(toLegacyStatus('cancelled')).toBe('completed');
  });

  it('falls back to new for unknown or empty values', () => {
    expect(normalizeStatus(undefined)).toBe('new');
    expect(normalizeStatus('')).toBe('new');
    expect(normalizeStatus('not-a-status')).toBe('new');
  });

  it('allows the documented transitions', () => {
    expect(canTransition('new', 'in_analysis')).toBe(true);
    expect(canTransition('in_analysis', 'working')).toBe(true);
    expect(canTransition('working', 'delivered')).toBe(true);
    expect(canTransition('delivered', 'closed')).toBe(true);
    expect(canTransition('closed', 'in_analysis')).toBe(true);
    expect(canTransition('cancelled', 'in_analysis')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('new', 'delivered')).toBe(false);
    expect(canTransition('closed', 'working')).toBe(false);
    expect(canTransition('cancelled', 'delivered')).toBe(false);
  });

  it('has no transition to itself', () => {
    for (const status of RequestStatuses) {
      expect(AllowedTransitions[status]).not.toContain(status);
    }
  });

  it('classifies terminal, active and SLA-paused statuses', () => {
    expect(isTerminalStatus('closed')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
    expect(isTerminalStatus('working')).toBe(false);

    expect(isActiveStatus('new')).toBe(true);
    expect(isActiveStatus('on_hold')).toBe(true);
    expect(isActiveStatus('delivered')).toBe(false);

    expect(isSlaPausedStatus('waiting_client')).toBe(true);
    expect(isSlaPausedStatus('on_hold')).toBe(true);
    expect(isSlaPausedStatus('working')).toBe(false);
  });
});
