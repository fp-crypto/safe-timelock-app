import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { type Hex, type Address, isAddress, zeroHash } from 'viem';
import { InputField, OutputDisplay, StatusDisplay, CopyLinkButton } from '../components/ui';
import { CalldataBuilder } from '../components/CalldataBuilder';
import { useMinDelay } from '../hooks/useTimelockStatus';
import {
  encodeSchedule,
  encodeScheduleBatch,
  generateRandomSalt,
  generateDeterministicSalt,
  formatDelay,
} from '../lib/timelock';
import { parseUrlState, type Operation as UrlOperation } from '../hooks/useUrlState';

interface ScheduleTabProps {
  timelockAddress: Address | undefined;
  initialOps: UrlOperation[];
  initialDelay: string;
  onUpdate: (ops: UrlOperation[], delay: string) => void;
  onClear: () => void;
  getShareableUrl: () => string;
}

export function ScheduleTab({
  timelockAddress,
  initialOps,
  initialDelay,
  onUpdate,
  onClear,
  getShareableUrl,
}: ScheduleTabProps) {
  const [operations, setOperations] = useState(() => {
    const current = parseUrlState();
    return current.ops?.length ? current.ops : initialOps;
  });
  const [predecessor, setPredecessor] = useState<string>(zeroHash);
  const [salt, setSalt] = useState<string>(zeroHash);
  const [delay, setDelay] = useState(() => {
    const current = parseUrlState();
    return current.delay || initialDelay;
  });
  const [output, setOutput] = useState({ calldata: '', operationId: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    onUpdate(operations, delay);
  }, [operations, delay, onUpdate]);

  const { isConnected } = useAccount();
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { minDelay } = useMinDelay(timelockAddress);

  const handleClear = useCallback(() => {
    setOperations([{ target: '', value: '0', data: '0x' }]);
    setPredecessor(zeroHash);
    setSalt(zeroHash);
    setDelay('86400');
    setOutput({ calldata: '', operationId: '' });
    setError('');
    onClear();
  }, [onClear]);

  const addOperation = () => setOperations([...operations, { target: '', value: '0', data: '0x' }]);
  const removeOperation = (i: number) => setOperations(operations.filter((_, idx) => idx !== i));
  const updateOp = (i: number, field: string, val: string) => {
    const updated = [...operations];
    (updated[i] as any)[field] = val;
    setOperations(updated);
  };

  const encode = useCallback(() => {
    try {
      setError('');

      const targets = operations.map((op) => {
        if (!isAddress(op.target)) throw new Error(`Invalid address: ${op.target || '(empty)'}`);
        return op.target as Address;
      });
      const values = operations.map((op) => BigInt(op.value));
      const payloads = operations.map((op) => op.data as Hex);

      let result;
      if (operations.length === 1) {
        result = encodeSchedule(
          targets[0],
          values[0],
          payloads[0],
          predecessor as Hex,
          salt as Hex,
          BigInt(delay)
        );
      } else {
        result = encodeScheduleBatch(
          targets,
          values,
          payloads,
          predecessor as Hex,
          salt as Hex,
          BigInt(delay)
        );
      }
      setOutput({ calldata: result.calldata, operationId: result.operationId });
    } catch (err: any) {
      setError(err.message);
      setOutput({ calldata: '', operationId: '' });
    }
  }, [operations, predecessor, salt, delay]);

  const submit = () => {
    if (!timelockAddress || !output.calldata) return;
    sendTransaction({
      to: timelockAddress,
      data: output.calldata as Hex,
    });
  };

  const isBatch = operations.length > 1;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div className="tab-header-row">
          <h3>Schedule Operation{isBatch ? 's' : ''}</h3>
          <button onClick={handleClear} className="clear-btn" title="Clear all fields">
            Clear
          </button>
        </div>
        <p>
          Encode a <code>{isBatch ? 'scheduleBatch()' : 'schedule()'}</code> call for the TimelockController.
        </p>
      </div>

      {operations.map((op, i) => (
        <div key={i} className="operation-card">
          {isBatch && (
            <div className="operation-header">
              <span>Operation {i + 1}</span>
              <button onClick={() => removeOperation(i)} className="remove-btn">
                ✕
              </button>
            </div>
          )}
          <InputField
            label="Target Address"
            value={op.target}
            onChange={(v) => updateOp(i, 'target', v)}
            placeholder="0x..."
            mono
          />
          <InputField
            label="Value (wei)"
            value={op.value}
            onChange={(v) => updateOp(i, 'value', v)}
            placeholder="0"
            helper={!isBatch ? "Amount of ETH to send with the call" : undefined}
          />
          <InputField
            label="Calldata"
            value={op.data}
            onChange={(v) => updateOp(i, 'data', v)}
            placeholder="0x..."
            multiline
            mono
            helper={!isBatch ? "The encoded function call to execute" : undefined}
          />
          <CalldataBuilder
            targetAddress={op.target}
            onCalldataGenerated={(calldata) => updateOp(i, 'data', calldata)}
          />
        </div>
      ))}

      <button onClick={addOperation} className="btn btn-secondary add-op-btn">
        + Add Operation
      </button>

      <InputField
        label="Predecessor"
        value={predecessor}
        onChange={setPredecessor}
        placeholder={zeroHash}
        mono
        helper="Operation that must execute first (0x00... for none)"
      />
      <div className="input-row">
        <InputField label="Salt" value={salt} onChange={setSalt} placeholder={zeroHash} mono />
        <button onClick={() => setSalt(generateRandomSalt())} className="btn btn-secondary">
          Random
        </button>
        <button
          onClick={() => {
            const payloads = operations.map((op) => op.data as Hex);
            setSalt(generateDeterministicSalt(payloads));
          }}
          className="btn btn-secondary"
        >
          From Data
        </button>
      </div>
      <InputField
        label="Delay (seconds)"
        value={delay}
        onChange={setDelay}
        placeholder="86400"
        helper={
          minDelay
            ? `Min delay: ${minDelay.toString()}s (${formatDelay(minDelay)})`
            : `${formatDelay(delay)}`
        }
      />

      <div className="actions">
        <button onClick={encode} className="btn btn-primary">
          Encode {isBatch ? 'Batch' : 'Schedule'}
        </button>
        {output.calldata && isConnected && timelockAddress && (
          <button onClick={submit} disabled={isPending || isConfirming} className="btn btn-success">
            {isPending ? 'Confirming...' : isConfirming ? 'Waiting...' : 'Submit to Safe'}
          </button>
        )}
      </div>

      {isSuccess && <div className="success-message">Transaction submitted!</div>}
      {error && <div className="error-message">{error}</div>}

      <OutputDisplay label="Operation ID" value={output.operationId} />
      <OutputDisplay label={isBatch ? 'Batch Calldata' : 'Schedule Calldata'} value={output.calldata} />
      {output.calldata && <CopyLinkButton getUrl={getShareableUrl} />}

      {output.operationId && (
        <StatusDisplay
          timelockAddress={timelockAddress}
          operationId={output.operationId as Hex}
        />
      )}
    </div>
  );
}
