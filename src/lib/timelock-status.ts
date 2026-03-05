export interface TimelockOperationStatus {
  isOperation: boolean;
  isPending: boolean;
  isReady: boolean;
  isDone: boolean;
  timestamp: bigint;
}

export function deriveTimelockStatusFromTimestamp(
  timestamp: bigint,
  now: bigint
): TimelockOperationStatus {
  const isOperation = timestamp > 0n;
  const isDone = timestamp === 1n;
  const isPending = timestamp > 1n && timestamp > now;
  const isReady = timestamp > 1n && timestamp <= now;

  return {
    isOperation,
    isPending,
    isReady,
    isDone,
    timestamp,
  };
}

export function isDisplayableScheduledStatus(
  status: TimelockOperationStatus | undefined
): boolean {
  if (!status) return false;
  if (!status.isOperation || status.isDone) return false;
  return status.isPending || status.isReady;
}
