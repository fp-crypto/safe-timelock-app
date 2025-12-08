import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { type Hex, type Address, isAddress, zeroHash } from 'viem';
import { InputField, OutputDisplay, StatusDisplay, CopyLinkButton } from '../components/ui';
import { CalldataBuilder } from '../components/CalldataBuilder';
import { DecodedCalldata } from '../components/DecodedCalldata';
import { ScheduledOperations } from '../components/ScheduledOperations';
import {
  encodeExecute,
  encodeExecuteBatch,
  decodeTimelockCalldata,
} from '../lib/timelock';
import type { DecodedTimelock } from '../lib/timelock';
import { parseUrlState, type Operation as UrlOperation } from '../hooks/useUrlState';

interface ExecuteTabProps {
  timelockAddress: Address | undefined;
  initialOps: UrlOperation[];
  onUpdate: (ops: UrlOperation[]) => void;
  onClear: () => void;
  getShareableUrl: () => string;
}

export function ExecuteTab({
  timelockAddress,
  initialOps,
  onUpdate,
  onClear,
  getShareableUrl,
}: ExecuteTabProps) {
  const [importCalldata, setImportCalldata] = useState('');
  const [operations, setOperations] = useState(() => {
    const current = parseUrlState();
    return current.ops?.length ? current.ops : initialOps;
  });
  const [predecessor, setPredecessor] = useState<string>(zeroHash);
  const [salt, setSalt] = useState<string>(zeroHash);
  const [output, setOutput] = useState({ calldata: '', operationId: '' });
  const [error, setError] = useState('');
  const [expandedBuilderIndex, setExpandedBuilderIndex] = useState<number | null>(null);
  const [useBatch, setUseBatch] = useState(false);

  useEffect(() => {
    onUpdate(operations);
  }, [operations, onUpdate]);

  const { isConnected } = useAccount();
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleClear = useCallback(() => {
    setOperations([{ target: '', value: '0', data: '0x' }]);
    setPredecessor(zeroHash);
    setSalt(zeroHash);
    setImportCalldata('');
    setOutput({ calldata: '', operationId: '' });
    setError('');
    setUseBatch(false);
    setExpandedBuilderIndex(null);
    onClear();
  }, [onClear]);

  const addOperation = () => setOperations([...operations, { target: '', value: '0', data: '0x' }]);
  const removeOperation = (i: number) => setOperations(operations.filter((_, idx) => idx !== i));
  const updateOp = (i: number, field: string, val: string) => {
    const updated = [...operations];
    (updated[i] as any)[field] = val;
    setOperations(updated);
  };

  const handleImport = useCallback(() => {
    try {
      setError('');
      const decoded = decodeTimelockCalldata(importCalldata as Hex);
      if (!decoded) throw new Error('Could not decode calldata');

      if (decoded.functionName === 'schedule') {
        setUseBatch(false);
        setOperations([{
          target: decoded.target || '',
          value: decoded.value || '0',
          data: decoded.data || '0x',
        }]);
      } else if (decoded.functionName === 'scheduleBatch') {
        setUseBatch(true);
        if (!decoded.operations || decoded.operations.length === 0) {
          throw new Error('No operations found in calldata');
        }
        setOperations(decoded.operations.map(op => ({
          target: op.target,
          value: op.value,
          data: op.data,
        })));
      } else {
        throw new Error(`Expected schedule() or scheduleBatch() calldata, got ${decoded.functionName}()`);
      }

      setPredecessor(decoded.predecessor || zeroHash);
      setSalt(decoded.salt || zeroHash);
      setImportCalldata('');
    } catch (err: any) {
      setError(err.message);
    }
  }, [importCalldata]);

  const handleSelectScheduled = useCallback((decoded: DecodedTimelock) => {
    setError('');
    if (decoded.functionName === 'schedule') {
      setUseBatch(false);
      setOperations([{
        target: decoded.target || '',
        value: decoded.value || '0',
        data: decoded.data || '0x',
      }]);
    } else if (decoded.functionName === 'scheduleBatch' && decoded.operations) {
      setUseBatch(true);
      setOperations(decoded.operations.map(op => ({
        target: op.target,
        value: op.value,
        data: op.data,
      })));
    }
    setPredecessor(decoded.predecessor || zeroHash);
    setSalt(decoded.salt || zeroHash);
  }, []);

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
      const shouldUseBatch = operations.length > 1 || useBatch;

      if (shouldUseBatch) {
        result = encodeExecuteBatch(
          targets,
          values,
          payloads,
          predecessor as Hex,
          salt as Hex
        );
      } else {
        result = encodeExecute(
          targets[0],
          values[0],
          payloads[0],
          predecessor as Hex,
          salt as Hex
        );
      }
      setOutput({ calldata: result.calldata, operationId: result.operationId });
    } catch (err: any) {
      setError(err.message);
      setOutput({ calldata: '', operationId: '' });
    }
  }, [operations, predecessor, salt, useBatch]);

  const submit = () => {
    if (!timelockAddress || !output.calldata) return;
    const totalValue = operations.reduce((sum, op) => sum + BigInt(op.value), 0n);
    sendTransaction({ to: timelockAddress, data: output.calldata as Hex, value: totalValue });
  };

  const isBatch = operations.length > 1 || useBatch;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div className="tab-header-row">
          <h3>Execute Operation{isBatch ? 's' : ''}</h3>
          <button onClick={handleClear} className="clear-btn" title="Clear all fields">
            Clear
          </button>
        </div>
        <p>
          Encode an <code>{isBatch ? 'executeBatch()' : 'execute()'}</code> call. Use the same params from scheduling.
        </p>
      </div>

      <ScheduledOperations
        timelockAddress={timelockAddress || ''}
        onSelect={handleSelectScheduled}
      />

      <div className="import-section">
        <InputField
          label="Import from Schedule Calldata"
          value={importCalldata}
          onChange={setImportCalldata}
          placeholder="Paste schedule() or scheduleBatch() calldata to auto-fill fields..."
          multiline
          mono
        />
        <button onClick={handleImport} disabled={!importCalldata} className="btn btn-secondary">
          Import
        </button>
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
          />
          <InputField
            label="Calldata"
            value={op.data}
            onChange={(v) => updateOp(i, 'data', v)}
            placeholder="0x..."
            multiline
            mono
          />
          <CalldataBuilder
            targetAddress={op.target}
            onCalldataGenerated={(calldata) => updateOp(i, 'data', calldata)}
            onExpandedChange={(expanded) => setExpandedBuilderIndex(expanded ? i : null)}
          />
          {op.data && op.data !== '0x' && expandedBuilderIndex !== i && (
            <div className="decoded-calldata-section">
              <DecodedCalldata
                calldata={op.data as Hex}
                target={isAddress(op.target) ? op.target : undefined}
              />
            </div>
          )}
        </div>
      ))}

      <button onClick={addOperation} className="btn btn-secondary add-op-btn">
        + Add Operation
      </button>

      {operations.length === 1 && (
        <div className="batch-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={useBatch}
              onChange={(e) => setUseBatch(e.target.checked)}
            />
            <span>Use executeBatch()</span>
          </label>
          <span className="toggle-hint">
            Enable if the operation was scheduled with scheduleBatch()
          </span>
        </div>
      )}

      <InputField label="Predecessor" value={predecessor} onChange={setPredecessor} mono />
      <InputField label="Salt" value={salt} onChange={setSalt} mono />

      <div className="actions">
        <button onClick={encode} className="btn btn-warning">
          Encode {isBatch ? 'Execute Batch' : 'Execute'}
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
      <OutputDisplay label={isBatch ? 'Execute Batch Calldata' : 'Execute Calldata'} value={output.calldata} />
      {output.calldata && <CopyLinkButton getUrl={getShareableUrl} />}

      {output.operationId && (
        <StatusDisplay timelockAddress={timelockAddress} operationId={output.operationId as Hex} />
      )}
    </div>
  );
}
