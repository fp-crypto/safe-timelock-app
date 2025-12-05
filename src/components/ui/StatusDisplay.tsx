import type { Hex, Address } from 'viem';
import { useOperationStatus } from '../../hooks/useTimelockStatus';

export interface StatusDisplayProps {
  timelockAddress: Address | undefined;
  operationId: Hex | undefined;
}

export function StatusDisplay({ timelockAddress, operationId }: StatusDisplayProps) {
  const { status, isLoading, error, refetch } = useOperationStatus(timelockAddress, operationId);

  if (!timelockAddress || !operationId) return null;

  const getStatusText = () => {
    if (isLoading) return 'Loading...';
    if (error) return 'RPC Error';
    if (!status?.isOperation) return 'Not Found';
    if (status.isDone) return 'Executed';
    if (status.isReady) return 'Ready';
    if (status.isPending) return 'Pending';
    return 'Unknown';
  };

  const getStatusClass = () => {
    if (error) return 'status-error';
    if (!status?.isOperation) return 'status-unknown';
    if (status.isDone) return 'status-done';
    if (status.isReady) return 'status-ready';
    if (status.isPending) return 'status-pending';
    return 'status-unknown';
  };

  const getErrorMessage = () => {
    if (!error) return null;
    const msg = error.message || 'Unknown error';
    if (msg.includes('could not coalesce')) return 'Invalid timelock address';
    if (msg.includes('execution reverted')) return 'Contract call failed';
    return msg.length > 60 ? msg.slice(0, 60) + '...' : msg;
  };

  return (
    <div className="status-display">
      <div className="status-row">
        <span className={`status-badge ${getStatusClass()}`}>{getStatusText()}</span>
        <button onClick={() => refetch()} className="refresh-btn">
          ↻
        </button>
      </div>
      {error && (
        <div className="status-error-message">
          {getErrorMessage()}
        </div>
      )}
      {status?.timestamp !== undefined && status.timestamp > 0n && (
        <div className="status-timestamp">
          Ready at: {new Date(Number(status.timestamp) * 1000).toLocaleString()}
        </div>
      )}
    </div>
  );
}
