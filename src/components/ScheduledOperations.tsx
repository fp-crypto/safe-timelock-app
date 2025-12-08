import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import type { Address } from 'viem';
import {
  useScheduledOperations,
  type ScheduledOperation,
} from '../hooks/useScheduledOperations';
import { formatDelay, type DecodedTimelock } from '../lib/timelock';

interface ScheduledOperationsProps {
  timelockAddress: string;
  onSelect: (decoded: DecodedTimelock) => void;
}

function formatTimeUntilReady(timestamp: bigint): string {
  const readyAt = Number(timestamp) * 1000;
  const now = Date.now();
  const diff = readyAt - now;

  if (diff <= 0) return 'Ready';

  const seconds = Math.floor(diff / 1000);
  return formatDelay(BigInt(seconds));
}

function formatReadyTime(timestamp: bigint): string {
  const readyAt = new Date(Number(timestamp) * 1000);
  return readyAt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatReadyTimeUTC(timestamp: bigint): string {
  const readyAt = new Date(Number(timestamp) * 1000);
  return readyAt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

function generateICS(operationId: string, timestamp: bigint, functionName: string): string {
  const readyAt = new Date(Number(timestamp) * 1000);
  const endTime = new Date(readyAt.getTime() + 30 * 60 * 1000); // 30 min duration

  const formatICSDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const shortId = operationId.slice(0, 10);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Safe Timelock App//EN',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(readyAt)}`,
    `DTEND:${formatICSDate(endTime)}`,
    `SUMMARY:Timelock ${functionName}() ready`,
    `DESCRIPTION:Operation ${shortId}... is ready to execute`,
    `UID:${operationId}@safe-timelock-app`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadICS(operationId: string, timestamp: bigint, functionName: string) {
  const ics = generateICS(operationId, timestamp, functionName);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `timelock-${operationId.slice(0, 10)}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getOperationCount(decoded: DecodedTimelock): number {
  if (decoded.functionName === 'scheduleBatch' && decoded.operations) {
    return decoded.operations.length;
  }
  return 1;
}

function OperationRow({
  op,
  onSelect,
}: {
  op: ScheduledOperation;
  onSelect: (decoded: DecodedTimelock) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const opCount = getOperationCount(op.decoded);
  const date = new Date(op.submissionDate);
  const dateStr = date.toLocaleDateString();

  const hasTimestamp = !!(op.timelockStatus?.timestamp && op.timelockStatus.timestamp > 0n);
  const isPendingTimelock = op.safeStatus === 'executed' && op.timelockStatus?.isPending && !op.timelockStatus?.isReady;

  let statusBadge: React.ReactNode;
  let statusClass = '';

  if (op.safeStatus === 'pending') {
    // Awaiting Safe signatures
    statusClass = 'status-pending-sig';
    statusBadge = (
      <span className="scheduled-op-status pending-sig">
        {op.confirmations}/{op.confirmationsRequired} sigs
      </span>
    );
  } else if (op.timelockStatus?.isReady) {
    // Ready to execute
    statusClass = 'status-ready';
    statusBadge = (
      <span className="scheduled-op-status ready">Ready</span>
    );
  } else if (op.timelockStatus?.isPending && hasTimestamp) {
    // In timelock delay
    statusClass = 'status-pending-tl';
    const timeLeft = formatTimeUntilReady(op.timelockStatus.timestamp);
    statusBadge = (
      <span className="scheduled-op-status pending-tl">
        {timeLeft === 'Ready' ? 'Ready' : `in ${timeLeft}`}
      </span>
    );
  } else {
    // Unknown or not found
    statusClass = 'status-unknown';
    statusBadge = (
      <span className="scheduled-op-status unknown">Unknown</span>
    );
  }

  const handleCopyReminder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasTimestamp) return;

    const readyTime = formatReadyTimeUTC(op.timelockStatus!.timestamp);
    const shortId = op.operationId.slice(0, 10);
    const text = `Timelock ${op.decoded.functionName}() (${shortId}...) ready at ${readyTime}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCalendarExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasTimestamp) return;
    downloadICS(op.operationId, op.timelockStatus!.timestamp, op.decoded.functionName);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div className={`scheduled-op-row ${statusClass}`}>
      <div className="scheduled-op-main" onClick={() => onSelect(op.decoded)}>
        <div className="scheduled-op-info">
          {op.safeStatus === 'pending' && (
            <span className="scheduled-op-nonce">#{op.nonce}</span>
          )}
          <span className="scheduled-op-function">
            {op.decoded.functionName}()
            {opCount > 1 && (
              <span className="scheduled-op-count">{opCount} ops</span>
            )}
          </span>
          <span className="scheduled-op-date">{dateStr}</span>
        </div>
        <div className="scheduled-op-right">
          {statusBadge}
          {isPendingTimelock && hasTimestamp && (
            <button
              className="scheduled-op-expand-btn"
              onClick={handleToggleExpand}
              title={expanded ? 'Hide details' : 'Show details'}
            >
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>
      {expanded && isPendingTimelock && hasTimestamp && (
        <div className="scheduled-op-details">
          <div className="scheduled-op-eta">
            Ready at: <strong>{formatReadyTime(op.timelockStatus!.timestamp)}</strong>
          </div>
          <div className="scheduled-op-actions">
            <button
              className="scheduled-op-action-btn"
              onClick={handleCopyReminder}
              title="Copy reminder text"
            >
              {copied ? '✓ Copied' : 'Copy reminder'}
            </button>
            <button
              className="scheduled-op-action-btn"
              onClick={handleCalendarExport}
              title="Add to calendar"
            >
              📅 Calendar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScheduledOperations({
  timelockAddress,
  onSelect,
}: ScheduledOperationsProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { operations, isLoading, error, refetch } = useScheduledOperations(
    address as Address | undefined,
    chainId,
    timelockAddress as Address | undefined
  );

  if (!isConnected) {
    return (
      <div className="scheduled-ops-section">
        <div className="scheduled-ops-header">
          <span className="scheduled-ops-title">Scheduled Operations</span>
        </div>
        <div className="scheduled-ops-empty">
          Connect to a Safe to load scheduled operations
        </div>
      </div>
    );
  }

  if (!timelockAddress) {
    return (
      <div className="scheduled-ops-section">
        <div className="scheduled-ops-header">
          <span className="scheduled-ops-title">Scheduled Operations</span>
        </div>
        <div className="scheduled-ops-empty">
          Enter a timelock address above to load scheduled operations
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="scheduled-ops-section">
        <div className="scheduled-ops-header">
          <span className="scheduled-ops-title">Scheduled Operations</span>
        </div>
        <div className="scheduled-ops-empty">Loading scheduled operations...</div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isRateLimit = errorMessage.includes('429');
    const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');

    let displayMessage = 'Failed to load operations.';
    if (isRateLimit) {
      displayMessage = 'Rate limited by Safe Transaction Service. Please wait a moment.';
    } else if (isNetworkError) {
      displayMessage = 'Network error. Check your connection.';
    } else if (!address) {
      displayMessage = 'Are you connected to a Safe?';
    }

    return (
      <div className="scheduled-ops-section">
        <div className="scheduled-ops-header">
          <span className="scheduled-ops-title">Scheduled Operations</span>
          <button className="refresh-btn" onClick={() => refetch()}>↻</button>
        </div>
        <div className="scheduled-ops-error">
          {displayMessage}
        </div>
      </div>
    );
  }

  const readyCount = operations.filter(
    (op) => op.timelockStatus?.isReady
  ).length;

  return (
    <div className="scheduled-ops-section">
      <div className="scheduled-ops-header">
        <span className="scheduled-ops-title">
          Scheduled Operations
          {operations.length > 0 && (
            <span className="scheduled-ops-count">
              ({operations.length})
              {readyCount > 0 && (
                <span className="ready-indicator"> - {readyCount} ready</span>
              )}
            </span>
          )}
        </span>
        <button className="refresh-btn" onClick={() => refetch()}>↻</button>
      </div>
      {operations.length === 0 ? (
        <div className="scheduled-ops-empty">
          No pending schedule operations found
        </div>
      ) : (
        <div className="scheduled-ops-list">
          {operations.map((op) => (
            <OperationRow key={op.safeTxHash} op={op} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
