import { describe, expect, it } from 'vitest';
import {
  deriveTimelockStatusFromTimestamp,
  isDisplayableScheduledStatus,
} from './timelock-status';

describe('deriveTimelockStatusFromTimestamp', () => {
  const NOW = 1_700_000_000n;

  it('treats 0 as unscheduled/cancelled', () => {
    const status = deriveTimelockStatusFromTimestamp(0n, NOW);
    expect(status).toEqual({
      isOperation: false,
      isPending: false,
      isReady: false,
      isDone: false,
      timestamp: 0n,
    });
  });

  it('treats 1 as executed/done sentinel', () => {
    const status = deriveTimelockStatusFromTimestamp(1n, NOW);
    expect(status).toEqual({
      isOperation: true,
      isPending: false,
      isReady: false,
      isDone: true,
      timestamp: 1n,
    });
  });

  it('marks future timestamp as pending', () => {
    const status = deriveTimelockStatusFromTimestamp(NOW + 60n, NOW);
    expect(status.isPending).toBe(true);
    expect(status.isReady).toBe(false);
    expect(status.isDone).toBe(false);
  });

  it('marks past/current timestamp as ready', () => {
    const status = deriveTimelockStatusFromTimestamp(NOW, NOW);
    expect(status.isPending).toBe(false);
    expect(status.isReady).toBe(true);
    expect(status.isDone).toBe(false);
  });
});

describe('isDisplayableScheduledStatus', () => {
  const NOW = 1_700_000_000n;

  it('fails closed when status is missing', () => {
    expect(isDisplayableScheduledStatus(undefined)).toBe(false);
  });

  it('filters out done operations', () => {
    const doneStatus = deriveTimelockStatusFromTimestamp(1n, NOW);
    expect(isDisplayableScheduledStatus(doneStatus)).toBe(false);
  });

  it('keeps pending operations', () => {
    const pendingStatus = deriveTimelockStatusFromTimestamp(NOW + 60n, NOW);
    expect(isDisplayableScheduledStatus(pendingStatus)).toBe(true);
  });

  it('keeps ready operations', () => {
    const readyStatus = deriveTimelockStatusFromTimestamp(NOW, NOW);
    expect(isDisplayableScheduledStatus(readyStatus)).toBe(true);
  });
});
