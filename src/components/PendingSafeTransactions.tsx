import { useAccount, useChainId } from 'wagmi';
import type { Address } from 'viem';
import {
  usePendingSafeTransactions,
  filterTimelockTransactions,
  type FilteredSafeTransaction,
} from '../hooks/usePendingSafeTransactions';
import { decodeTimelockCalldata } from '../lib/timelock';

interface PendingSafeTransactionsProps {
  timelockAddress: string;
  onSelect: (calldata: string) => void;
}

function TransactionRow({
  tx,
  onSelect,
}: {
  tx: FilteredSafeTransaction;
  onSelect: (calldata: string) => void;
}) {
  const confirmCount = tx.confirmations?.length ?? 0;
  const threshold = tx.confirmationsRequired;

  let functionName = 'Unknown';
  try {
    const decoded = decodeTimelockCalldata(tx.timelockCalldata);
    if (decoded) {
      functionName = decoded.functionName;
    }
  } catch {
    // Keep "Unknown"
  }

  const date = new Date(tx.submissionDate);
  const dateStr = date.toLocaleDateString();

  return (
    <div className="pending-tx-row" onClick={() => onSelect(tx.timelockCalldata)}>
      <div className="pending-tx-info">
        <span className="pending-tx-nonce">#{tx.nonce}</span>
        <span className="pending-tx-function">{functionName}()</span>
        <span className="pending-tx-date">{dateStr}</span>
      </div>
      <div className="pending-tx-confirmations">
        <span
          className={`pending-tx-count ${confirmCount >= threshold ? 'ready' : ''}`}
        >
          {confirmCount}/{threshold}
        </span>
      </div>
    </div>
  );
}

export function PendingSafeTransactions({
  timelockAddress,
  onSelect,
}: PendingSafeTransactionsProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { data: allTransactions, isLoading, error, refetch } = usePendingSafeTransactions(
    address as Address | undefined,
    chainId
  );

  const timelockTransactions = filterTimelockTransactions(
    allTransactions ?? [],
    timelockAddress
  );

  if (!isConnected) {
    return (
      <div className="pending-safe-section">
        <div className="pending-safe-header">
          <span className="pending-safe-title">Pending Safe Transactions</span>
        </div>
        <div className="pending-safe-empty">
          Connect to a Safe to load pending transactions
        </div>
      </div>
    );
  }

  if (!timelockAddress) {
    return (
      <div className="pending-safe-section">
        <div className="pending-safe-header">
          <span className="pending-safe-title">Pending Safe Transactions</span>
        </div>
        <div className="pending-safe-empty">
          Enter a timelock address above to filter pending transactions
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="pending-safe-section">
        <div className="pending-safe-header">
          <span className="pending-safe-title">Pending Safe Transactions</span>
        </div>
        <div className="pending-safe-empty">Loading pending transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pending-safe-section">
        <div className="pending-safe-header">
          <span className="pending-safe-title">Pending Safe Transactions</span>
          <button className="refresh-btn" onClick={() => refetch()}>↻</button>
        </div>
        <div className="pending-safe-error">
          Failed to load transactions. Are you connected to a Safe?
        </div>
      </div>
    );
  }

  const totalCount = allTransactions?.length ?? 0;

  return (
    <div className="pending-safe-section">
      <div className="pending-safe-header">
        <span className="pending-safe-title">
          Pending Safe Transactions
          {timelockTransactions.length > 0 ? (
            <span className="pending-safe-count">({timelockTransactions.length})</span>
          ) : totalCount > 0 ? (
            <span className="pending-safe-count">(0 of {totalCount} target timelock)</span>
          ) : null}
        </span>
        <button className="refresh-btn" onClick={() => refetch()}>↻</button>
      </div>
      {timelockTransactions.length === 0 ? (
        <div className="pending-safe-empty">
          No pending transactions targeting the timelock
        </div>
      ) : (
        <div className="pending-tx-list">
          {timelockTransactions.map((tx) => (
            <TransactionRow key={tx.safeTxHash} tx={tx} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
