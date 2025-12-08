import { useState, useCallback, useEffect } from 'react';
import { type Hex, type Address, isAddress, zeroHash } from 'viem';
import { InputField, OutputDisplay, StatusDisplay, CopyLinkButton } from '../components/ui';
import { ScheduledOperations } from '../components/ScheduledOperations';
import {
  decodeTimelockCalldata,
  hashOperation,
  hashOperationBatch,
} from '../lib/timelock';
import type { DecodedTimelock } from '../lib/timelock';
import { parseUrlState, type Operation as UrlOperation } from '../hooks/useUrlState';

interface HashTabProps {
  timelockAddress: Address | undefined;
  initialTarget: string;
  initialValue: string;
  initialData: string;
  onUpdate: (target: string, value: string, data: string) => void;
  onClear: () => void;
  getShareableUrl: () => string;
}

export function HashTab({
  timelockAddress,
  initialTarget,
  initialValue,
  initialData,
  onUpdate,
  onClear,
  getShareableUrl,
}: HashTabProps) {
  const [operations, setOperations] = useState<UrlOperation[]>(() => {
    const current = parseUrlState();
    return [{
      target: current.target || initialTarget,
      value: current.value || initialValue,
      data: current.data || initialData,
    }];
  });
  const [predecessor, setPredecessor] = useState<string>(zeroHash);
  const [salt, setSalt] = useState<string>(zeroHash);
  const [operationId, setOperationId] = useState('');
  const [error, setError] = useState('');
  const [useBatch, setUseBatch] = useState(false);
  const [importCalldata, setImportCalldata] = useState('');

  useEffect(() => {
    if (operations.length > 0) {
      onUpdate(operations[0].target, operations[0].value, operations[0].data);
    }
  }, [operations, onUpdate]);

  const handleClear = useCallback(() => {
    setOperations([{ target: '', value: '0', data: '0x' }]);
    setPredecessor(zeroHash);
    setSalt(zeroHash);
    setOperationId('');
    setError('');
    setUseBatch(false);
    setImportCalldata('');
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
      setOperationId('');
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
    setOperationId('');
  }, []);

  const calculate = useCallback(() => {
    try {
      setError('');

      const targets = operations.map((op) => {
        if (!isAddress(op.target)) throw new Error(`Invalid address: ${op.target || '(empty)'}`);
        return op.target as Address;
      });
      const values = operations.map((op) => BigInt(op.value));
      const payloads = operations.map((op) => op.data as Hex);

      const shouldUseBatch = operations.length > 1 || useBatch;

      let hash: Hex;
      if (shouldUseBatch) {
        hash = hashOperationBatch(targets, values, payloads, predecessor as Hex, salt as Hex);
      } else {
        hash = hashOperation(targets[0], values[0], payloads[0], predecessor as Hex, salt as Hex);
      }

      setOperationId(hash);
    } catch (err: any) {
      setError(err.message);
      setOperationId('');
    }
  }, [operations, predecessor, salt, useBatch]);

  const isBatch = operations.length > 1 || useBatch;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div className="tab-header-row">
          <h3>Calculate Operation ID{isBatch ? ' (Batch)' : ''}</h3>
          <button onClick={handleClear} className="clear-btn" title="Clear all fields">
            Clear
          </button>
        </div>
        <p>Calculate the hash to check an operation's status on-chain.</p>
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
          placeholder="Paste schedule() or scheduleBatch() calldata..."
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
              <button onClick={() => removeOperation(i)} className="remove-btn">✕</button>
            </div>
          )}
          <InputField label="Target" value={op.target} onChange={(v) => updateOp(i, 'target', v)} placeholder="0x..." mono />
          <InputField label="Value (wei)" value={op.value} onChange={(v) => updateOp(i, 'value', v)} placeholder="0" />
          <InputField label="Calldata" value={op.data} onChange={(v) => updateOp(i, 'data', v)} placeholder="0x..." multiline mono />
        </div>
      ))}

      <button onClick={addOperation} className="btn btn-secondary add-op-btn">
        + Add Operation
      </button>

      {operations.length === 1 && (
        <div className="batch-toggle">
          <label className="toggle-label">
            <input type="checkbox" checked={useBatch} onChange={(e) => setUseBatch(e.target.checked)} />
            <span>Use hashOperationBatch()</span>
          </label>
          <span className="toggle-hint">Enable if verifying a scheduleBatch() operation</span>
        </div>
      )}

      <InputField label="Predecessor" value={predecessor} onChange={setPredecessor} mono />
      <InputField label="Salt" value={salt} onChange={setSalt} mono />

      <button onClick={calculate} className="btn btn-blue">
        Calculate Hash
      </button>

      {error && <div className="error-message">{error}</div>}
      <OutputDisplay label="Operation ID" value={operationId} />
      {operationId && <CopyLinkButton getUrl={getShareableUrl} />}

      {operationId && (
        <StatusDisplay timelockAddress={timelockAddress} operationId={operationId as Hex} />
      )}
    </div>
  );
}
