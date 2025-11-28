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
  const opCount = getOperationCount(op.decoded);
  const date = new Date(op.submissionDate);
  const dateStr = date.toLocaleDateString();

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
  } else if (op.timelockStatus?.isPending && op.timelockStatus.timestamp) {
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

  return (
    <div
      className={`scheduled-op-row ${statusClass}`}
      onClick={() => onSelect(op.decoded)}
    >
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
      {statusBadge}
    </div>
  );
}

export function ScheduledOperations({
  timelockAddress,
  onSelect,
}: ScheduledOperationsProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { operations, isLoading, error } = useScheduledOperations(
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
    return (
      <div className="scheduled-ops-section">
        <div className="scheduled-ops-header">
          <span className="scheduled-ops-title">Scheduled Operations</span>
        </div>
        <div className="scheduled-ops-error">
          Failed to load operations. Are you connected to a Safe?
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
