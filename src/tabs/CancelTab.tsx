import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { type Hex, type Address } from 'viem';
import { InputField, OutputDisplay } from '../components/ui';
import { ScheduledOperations } from '../components/ScheduledOperations';
import { encodeCancel } from '../lib/timelock';
import type { DecodedTimelock } from '../lib/timelock';
import { parseUrlState } from '../hooks/useUrlState';

interface CancelTabProps {
  timelockAddress: Address | undefined;
  initialOpId: string;
  onUpdate: (opId: string) => void;
  onClear: () => void;
}

export function CancelTab({
  timelockAddress,
  initialOpId,
  onUpdate,
  onClear,
}: CancelTabProps) {
  const [operationId, setOperationId] = useState(() => {
    const current = parseUrlState();
    return current.opId || initialOpId;
  });
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    onUpdate(operationId);
  }, [operationId, onUpdate]);

  const { isConnected } = useAccount();
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const encode = useCallback(() => {
    try {
      setError('');
      const calldata = encodeCancel(operationId as Hex);
      setOutput(calldata);
    } catch (err: any) {
      setError(err.message);
      setOutput('');
    }
  }, [operationId]);

  const handleSelectScheduled = useCallback((decoded: DecodedTimelock) => {
    setError('');
    if (decoded.operationId) {
      setOperationId(decoded.operationId);
    }
  }, []);

  const handleClear = useCallback(() => {
    setOperationId('');
    setOutput('');
    setError('');
    onClear();
  }, [onClear]);

  const submit = () => {
    if (!timelockAddress || !output) return;
    sendTransaction({ to: timelockAddress, data: output as Hex });
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div className="tab-header-row">
          <h3>Cancel Operation</h3>
          <button onClick={handleClear} className="clear-btn" title="Clear all fields">
            Clear
          </button>
        </div>
        <p>
          Encode a <code>cancel()</code> to abort a pending operation.
        </p>
      </div>

      <ScheduledOperations
        timelockAddress={timelockAddress || ''}
        onSelect={handleSelectScheduled}
      />

      <InputField
        label="Operation ID (bytes32)"
        value={operationId}
        onChange={setOperationId}
        placeholder="0x..."
        mono
      />

      <div className="actions">
        <button onClick={encode} className="btn btn-danger">
          Encode Cancel
        </button>
        {output && isConnected && timelockAddress && (
          <button onClick={submit} disabled={isPending || isConfirming} className="btn btn-success">
            {isPending ? 'Confirming...' : isConfirming ? 'Waiting...' : 'Submit to Safe'}
          </button>
        )}
      </div>

      {isSuccess && <div className="success-message">Transaction submitted!</div>}
      {error && <div className="error-message">{error}</div>}
      <OutputDisplay label="Cancel Calldata" value={output} />
    </div>
  );
}
