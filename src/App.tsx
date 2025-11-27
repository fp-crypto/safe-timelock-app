import { useState, useCallback, useEffect } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from 'wagmi';
import { type Hex, type Address, isAddress, zeroHash } from 'viem';
import { useAutoConnect, useIsSafeApp } from './hooks/useAutoConnect';
import { useOperationStatus, useMinDelay } from './hooks/useTimelockStatus';
import {
  encodeSchedule,
  encodeScheduleBatch,
  encodeExecute,
  encodeExecuteBatch,
  encodeCancel,
  decodeTimelockCalldata,
  hashOperation,
  generateRandomSalt,
  formatDelay,
} from './lib/timelock';
import { chains } from './config/wagmi';
import { DecodedCalldata, DecodedCalldataSummary } from './components/DecodedCalldata';
import { AbiManager } from './components/AbiManager';

// Wallet Connection Component
function WalletConnection() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isSafeApp = useIsSafeApp();

  if (isConnected) {
    return (
      <div className="wallet-connected">
        <div className="wallet-info">
          <div className="wallet-badge">
            {isSafeApp && <span className="safe-badge">Safe App</span>}
            <span className="connector-name">{connector?.name}</span>
          </div>
          <div className="wallet-address">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
          <select
            value={chainId}
            onChange={(e) => switchChain?.({ chainId: Number(e.target.value) as typeof chains[number]['id'] })}
            className="chain-select"
          >
            {chains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>
        </div>
        {!isSafeApp && (
          <button onClick={() => disconnect()} className="btn btn-secondary">
            Disconnect
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <p className="connect-prompt">Connect your wallet to submit transactions</p>
      <div className="connector-buttons">
        {connectors
          .filter((c) => c.id !== 'safe') // Hide Safe connector in UI (auto-connects)
          .map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={isPending}
              className="btn btn-primary"
            >
              {connector.name}
            </button>
          ))}
      </div>
    </div>
  );
}

// Input Field Component
function InputField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  mono,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
  helper?: string;
}) {
  return (
    <div className="input-field">
      <label>{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={mono ? 'mono' : ''}
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={mono ? 'mono' : ''}
        />
      )}
      {helper && <span className="helper">{helper}</span>}
    </div>
  );
}

// Output Display Component
function OutputDisplay({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="output-display">
      <div className="output-header">
        <label>{label}</label>
        {value && (
          <button onClick={handleCopy} className="copy-btn">
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        )}
      </div>
      <div className="output-value">{value || '—'}</div>
    </div>
  );
}

// Operation Status Display
function StatusDisplay({
  timelockAddress,
  operationId,
}: {
  timelockAddress: Address | undefined;
  operationId: Hex | undefined;
}) {
  const { status, isLoading, refetch } = useOperationStatus(timelockAddress, operationId);

  if (!timelockAddress || !operationId) return null;

  const getStatusText = () => {
    if (isLoading) return 'Loading...';
    if (!status?.isOperation) return 'Not Found';
    if (status.isDone) return 'Executed';
    if (status.isReady) return 'Ready';
    if (status.isPending) return 'Pending';
    return 'Unknown';
  };

  const getStatusClass = () => {
    if (!status?.isOperation) return 'status-unknown';
    if (status.isDone) return 'status-done';
    if (status.isReady) return 'status-ready';
    if (status.isPending) return 'status-pending';
    return 'status-unknown';
  };

  return (
    <div className="status-display">
      <div className="status-row">
        <span className={`status-badge ${getStatusClass()}`}>{getStatusText()}</span>
        <button onClick={() => refetch()} className="refresh-btn">
          ↻
        </button>
      </div>
      {status?.timestamp !== undefined && status.timestamp > 0n && (
        <div className="status-timestamp">
          Ready at: {new Date(Number(status.timestamp) * 1000).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// Schedule Tab
function ScheduleTab({ timelockAddress }: { timelockAddress: Address | undefined }) {
  const [target, setTarget] = useState('');
  const [value, setValue] = useState('0');
  const [data, setData] = useState('0x');
  const [predecessor, setPredecessor] = useState<string>(zeroHash);
  const [salt, setSalt] = useState<string>(zeroHash);
  const [delay, setDelay] = useState('86400');
  const [output, setOutput] = useState({ calldata: '', operationId: '' });
  const [error, setError] = useState('');

  const { isConnected } = useAccount();
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { minDelay } = useMinDelay(timelockAddress);

  const encode = useCallback(() => {
    try {
      setError('');
      if (!isAddress(target)) throw new Error('Invalid target address');

      const result = encodeSchedule(
        target as Address,
        BigInt(value),
        data as Hex,
        predecessor as Hex,
        salt as Hex,
        BigInt(delay)
      );
      setOutput({ calldata: result.calldata, operationId: result.operationId });
    } catch (err: any) {
      setError(err.message);
      setOutput({ calldata: '', operationId: '' });
    }
  }, [target, value, data, predecessor, salt, delay]);

  const submit = () => {
    if (!timelockAddress || !output.calldata) return;
    sendTransaction({
      to: timelockAddress,
      data: output.calldata as Hex,
    });
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Schedule Operation</h3>
        <p>
          Encode a <code>schedule()</code> call for the TimelockController.
        </p>
      </div>

      <InputField label="Target Address" value={target} onChange={setTarget} placeholder="0x..." mono />
      <InputField
        label="Value (wei)"
        value={value}
        onChange={setValue}
        placeholder="0"
        helper="Amount of ETH to send with the call"
      />
      <InputField
        label="Calldata"
        value={data}
        onChange={setData}
        placeholder="0x..."
        multiline
        mono
        helper="The encoded function call to execute"
      />
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
          Encode Schedule
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
      <OutputDisplay label="Schedule Calldata" value={output.calldata} />

      {output.operationId && (
        <StatusDisplay
          timelockAddress={timelockAddress}
          operationId={output.operationId as Hex}
        />
      )}
    </div>
  );
}

// Schedule Batch Tab
function ScheduleBatchTab({ timelockAddress }: { timelockAddress: Address | undefined }) {
  const [operations, setOperations] = useState([{ target: '', value: '0', data: '0x' }]);
  const [predecessor, setPredecessor] = useState<string>(zeroHash);
  const [salt, setSalt] = useState<string>(zeroHash);
  const [delay, setDelay] = useState('86400');
  const [output, setOutput] = useState({ calldata: '', operationId: '' });
  const [error, setError] = useState('');

  const { isConnected } = useAccount();
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

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
        if (!isAddress(op.target)) throw new Error(`Invalid address: ${op.target}`);
        return op.target as Address;
      });
      const values = operations.map((op) => BigInt(op.value));
      const payloads = operations.map((op) => op.data as Hex);

      const result = encodeScheduleBatch(
        targets,
        values,
        payloads,
        predecessor as Hex,
        salt as Hex,
        BigInt(delay)
      );
      setOutput({ calldata: result.calldata, operationId: result.operationId });
    } catch (err: any) {
      setError(err.message);
      setOutput({ calldata: '', operationId: '' });
    }
  }, [operations, predecessor, salt, delay]);

  const submit = () => {
    if (!timelockAddress || !output.calldata) return;
    sendTransaction({ to: timelockAddress, data: output.calldata as Hex });
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Schedule Batch</h3>
        <p>
          Encode a <code>scheduleBatch()</code> for multiple operations atomically.
        </p>
      </div>

      {operations.map((op, i) => (
        <div key={i} className="operation-card">
          <div className="operation-header">
            <span>Operation {i + 1}</span>
            {operations.length > 1 && (
              <button onClick={() => removeOperation(i)} className="remove-btn">
                ✕
              </button>
            )}
          </div>
          <InputField
            label="Target"
            value={op.target}
            onChange={(v) => updateOp(i, 'target', v)}
            placeholder="0x..."
            mono
          />
          <InputField
            label="Value"
            value={op.value}
            onChange={(v) => updateOp(i, 'value', v)}
            placeholder="0"
          />
          <InputField
            label="Data"
            value={op.data}
            onChange={(v) => updateOp(i, 'data', v)}
            placeholder="0x..."
            mono
          />
        </div>
      ))}

      <button onClick={addOperation} className="btn btn-secondary add-op-btn">
        + Add Operation
      </button>

      <InputField label="Predecessor" value={predecessor} onChange={setPredecessor} mono />
      <div className="input-row">
        <InputField label="Salt" value={salt} onChange={setSalt} mono />
        <button onClick={() => setSalt(generateRandomSalt())} className="btn btn-secondary">
          Random
        </button>
      </div>
      <InputField label="Delay (seconds)" value={delay} onChange={setDelay} />

      <div className="actions">
        <button onClick={encode} className="btn btn-primary">
          Encode Batch
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
      <OutputDisplay label="Batch Calldata" value={output.calldata} />
    </div>
  );
}

// Execute Tab
function ExecuteTab({ timelockAddress }: { timelockAddress: Address | undefined }) {
  const [importCalldata, setImportCalldata] = useState('');
  const [target, setTarget] = useState('');
  const [value, setValue] = useState('0');
  const [data, setData] = useState('0x');
  const [predecessor, setPredecessor] = useState<string>(zeroHash);
  const [salt, setSalt] = useState<string>(zeroHash);
  const [output, setOutput] = useState({ calldata: '', operationId: '' });
  const [error, setError] = useState('');

  const { isConnected } = useAccount();
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleImport = useCallback(() => {
    try {
      setError('');
      const decoded = decodeTimelockCalldata(importCalldata as Hex);
      if (!decoded) throw new Error('Could not decode calldata');
      if (decoded.functionName !== 'schedule') {
        throw new Error(`Expected schedule() calldata, got ${decoded.functionName}()`);
      }
      setTarget(decoded.target || '');
      setValue(decoded.value || '0');
      setData(decoded.data || '0x');
      setPredecessor(decoded.predecessor || zeroHash);
      setSalt(decoded.salt || zeroHash);
      setImportCalldata('');
    } catch (err: any) {
      setError(err.message);
    }
  }, [importCalldata]);

  const encode = useCallback(() => {
    try {
      setError('');
      if (!isAddress(target)) throw new Error('Invalid target address');
      const result = encodeExecute(
        target as Address,
        BigInt(value),
        data as Hex,
        predecessor as Hex,
        salt as Hex
      );
      setOutput({ calldata: result.calldata, operationId: result.operationId });
    } catch (err: any) {
      setError(err.message);
      setOutput({ calldata: '', operationId: '' });
    }
  }, [target, value, data, predecessor, salt]);

  const submit = () => {
    if (!timelockAddress || !output.calldata) return;
    sendTransaction({ to: timelockAddress, data: output.calldata as Hex, value: BigInt(value) });
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Execute Operation</h3>
        <p>
          Encode an <code>execute()</code> call. Use the same params from scheduling.
        </p>
      </div>

      <div className="import-section">
        <InputField
          label="Import from Schedule Calldata"
          value={importCalldata}
          onChange={setImportCalldata}
          placeholder="Paste schedule() calldata to auto-fill fields..."
          multiline
          mono
        />
        <button onClick={handleImport} disabled={!importCalldata} className="btn btn-secondary">
          Import
        </button>
      </div>

      <InputField label="Target Address" value={target} onChange={setTarget} placeholder="0x..." mono />
      <InputField label="Value (wei)" value={value} onChange={setValue} placeholder="0" />
      <InputField label="Calldata" value={data} onChange={setData} placeholder="0x..." multiline mono />
      <InputField label="Predecessor" value={predecessor} onChange={setPredecessor} mono />
      <InputField label="Salt" value={salt} onChange={setSalt} mono />

      <div className="actions">
        <button onClick={encode} className="btn btn-warning">
          Encode Execute
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
      <OutputDisplay label="Execute Calldata" value={output.calldata} />

      {output.operationId && (
        <StatusDisplay timelockAddress={timelockAddress} operationId={output.operationId as Hex} />
      )}
    </div>
  );
}

// Execute Batch Tab
function ExecuteBatchTab({ timelockAddress }: { timelockAddress: Address | undefined }) {
  const [importCalldata, setImportCalldata] = useState('');
  const [operations, setOperations] = useState([{ target: '', value: '0', data: '0x' }]);
  const [predecessor, setPredecessor] = useState<string>(zeroHash);
  const [salt, setSalt] = useState<string>(zeroHash);
  const [output, setOutput] = useState({ calldata: '', operationId: '' });
  const [error, setError] = useState('');

  const { isConnected } = useAccount();
  const { sendTransaction, data: txHash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleImport = useCallback(() => {
    try {
      setError('');
      const decoded = decodeTimelockCalldata(importCalldata as Hex);
      if (!decoded) throw new Error('Could not decode calldata');
      if (decoded.functionName !== 'scheduleBatch') {
        throw new Error(`Expected scheduleBatch() calldata, got ${decoded.functionName}()`);
      }
      if (!decoded.operations || decoded.operations.length === 0) {
        throw new Error('No operations found in calldata');
      }
      setOperations(decoded.operations.map(op => ({
        target: op.target,
        value: op.value,
        data: op.data,
      })));
      setPredecessor(decoded.predecessor || zeroHash);
      setSalt(decoded.salt || zeroHash);
      setImportCalldata('');
    } catch (err: any) {
      setError(err.message);
    }
  }, [importCalldata]);

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
        if (!isAddress(op.target)) throw new Error(`Invalid address: ${op.target}`);
        return op.target as Address;
      });
      const values = operations.map((op) => BigInt(op.value));
      const payloads = operations.map((op) => op.data as Hex);

      const result = encodeExecuteBatch(
        targets,
        values,
        payloads,
        predecessor as Hex,
        salt as Hex
      );
      setOutput({ calldata: result.calldata, operationId: result.operationId });
    } catch (err: any) {
      setError(err.message);
      setOutput({ calldata: '', operationId: '' });
    }
  }, [operations, predecessor, salt]);

  const submit = () => {
    if (!timelockAddress || !output.calldata) return;
    const totalValue = operations.reduce((sum, op) => sum + BigInt(op.value), 0n);
    sendTransaction({ to: timelockAddress, data: output.calldata as Hex, value: totalValue });
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Execute Batch</h3>
        <p>
          Encode an <code>executeBatch()</code> to execute multiple operations atomically.
        </p>
      </div>

      <div className="import-section">
        <InputField
          label="Import from Schedule Batch Calldata"
          value={importCalldata}
          onChange={setImportCalldata}
          placeholder="Paste scheduleBatch() calldata to auto-fill fields..."
          multiline
          mono
        />
        <button onClick={handleImport} disabled={!importCalldata} className="btn btn-secondary">
          Import
        </button>
      </div>

      {operations.map((op, i) => (
        <div key={i} className="operation-card">
          <div className="operation-header">
            <span>Operation {i + 1}</span>
            {operations.length > 1 && (
              <button onClick={() => removeOperation(i)} className="remove-btn">
                ✕
              </button>
            )}
          </div>
          <InputField
            label="Target"
            value={op.target}
            onChange={(v) => updateOp(i, 'target', v)}
            placeholder="0x..."
            mono
          />
          <InputField
            label="Value"
            value={op.value}
            onChange={(v) => updateOp(i, 'value', v)}
            placeholder="0"
          />
          <InputField
            label="Data"
            value={op.data}
            onChange={(v) => updateOp(i, 'data', v)}
            placeholder="0x..."
            mono
          />
        </div>
      ))}

      <button onClick={addOperation} className="btn btn-secondary add-op-btn">
        + Add Operation
      </button>

      <InputField label="Predecessor" value={predecessor} onChange={setPredecessor} mono />
      <InputField label="Salt" value={salt} onChange={setSalt} mono />

      <div className="actions">
        <button onClick={encode} className="btn btn-warning">
          Encode Execute Batch
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
      <OutputDisplay label="Execute Batch Calldata" value={output.calldata} />

      {output.operationId && (
        <StatusDisplay timelockAddress={timelockAddress} operationId={output.operationId as Hex} />
      )}
    </div>
  );
}

// Expandable Batch Operation Item
function BatchOperationItem({
  index,
  operation,
}: {
  index: number;
  operation: { target: Address; value: string; data: Hex };
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="batch-operation">
      <div
        className="batch-operation-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="batch-op-index">#{index + 1}</span>
        <DecodedCalldataSummary calldata={operation.data} />
        <span className="batch-op-expand">{isExpanded ? '▼' : '▶'}</span>
      </div>
      {isExpanded && (
        <div className="batch-operation-content">
          <div className="op-details">
            <div>
              <span className="label">Target:</span> <code>{operation.target}</code>
            </div>
            <div>
              <span className="label">Value:</span> <code>{operation.value} wei</code>
            </div>
          </div>
          <DecodedCalldata calldata={operation.data} target={operation.target} />
        </div>
      )}
    </div>
  );
}

// Decode Tab
function DecodeTab() {
  const [calldata, setCalldata] = useState('');
  const [decoded, setDecoded] = useState<ReturnType<typeof decodeTimelockCalldata>>(null);
  const [error, setError] = useState('');

  const decode = useCallback(() => {
    try {
      setError('');
      const result = decodeTimelockCalldata(calldata as Hex);
      if (!result) throw new Error('Could not decode. Make sure it\'s valid TimelockController calldata.');
      setDecoded(result);
    } catch (err: any) {
      setError(err.message);
      setDecoded(null);
    }
  }, [calldata]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Decode Calldata</h3>
        <p>Paste TimelockController calldata to decode and inspect it.</p>
      </div>

      <InputField
        label="Calldata"
        value={calldata}
        onChange={setCalldata}
        placeholder="0x..."
        multiline
        mono
      />

      <button onClick={decode} className="btn btn-purple">
        Decode
      </button>

      {error && <div className="error-message">{error}</div>}

      {decoded && (
        <div className="decoded-result">
          <div className="decoded-function">
            <span className="label">Function:</span>
            <code>{decoded.functionName}()</code>
          </div>

          {decoded.operationId && <OutputDisplay label="Operation ID" value={decoded.operationId} />}
          {decoded.target && <OutputDisplay label="Target" value={decoded.target} />}
          {decoded.value && <OutputDisplay label="Value (wei)" value={decoded.value} />}

          {/* Single operation: show inner calldata decoder */}
          {decoded.data && (
            <>
              <OutputDisplay label="Inner Calldata" value={decoded.data} />
              <DecodedCalldata calldata={decoded.data as Hex} target={decoded.target} />
            </>
          )}

          {/* Batch operations: show expandable list */}
          {decoded.operations && (
            <div className="operations-list">
              <label>Operations ({decoded.operations.length})</label>
              {decoded.operations.map((op, i) => (
                <BatchOperationItem
                  key={i}
                  index={i}
                  operation={op as { target: Address; value: string; data: Hex }}
                />
              ))}
            </div>
          )}

          {decoded.predecessor && <OutputDisplay label="Predecessor" value={decoded.predecessor} />}
          {decoded.salt && <OutputDisplay label="Salt" value={decoded.salt} />}
          {decoded.delay && (
            <OutputDisplay label="Delay" value={`${decoded.delay}s (${formatDelay(decoded.delay)})`} />
          )}
        </div>
      )}

      <AbiManager />
    </div>
  );
}

// Hash Calculator Tab
function HashTab() {
  const [target, setTarget] = useState('');
  const [value, setValue] = useState('0');
  const [data, setData] = useState('0x');
  const [predecessor, setPredecessor] = useState<string>(zeroHash);
  const [salt, setSalt] = useState<string>(zeroHash);
  const [operationId, setOperationId] = useState('');
  const [error, setError] = useState('');

  const calculate = useCallback(() => {
    try {
      setError('');
      if (!isAddress(target)) throw new Error('Invalid target address');
      const hash = hashOperation(target as Address, BigInt(value), data as Hex, predecessor as Hex, salt as Hex);
      setOperationId(hash);
    } catch (err: any) {
      setError(err.message);
      setOperationId('');
    }
  }, [target, value, data, predecessor, salt]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Calculate Operation ID</h3>
        <p>Calculate the hash to check an operation's status on-chain.</p>
      </div>

      <InputField label="Target" value={target} onChange={setTarget} placeholder="0x..." mono />
      <InputField label="Value (wei)" value={value} onChange={setValue} placeholder="0" />
      <InputField label="Calldata" value={data} onChange={setData} placeholder="0x..." multiline mono />
      <InputField label="Predecessor" value={predecessor} onChange={setPredecessor} mono />
      <InputField label="Salt" value={salt} onChange={setSalt} mono />

      <button onClick={calculate} className="btn btn-blue">
        Calculate Hash
      </button>

      {error && <div className="error-message">{error}</div>}
      <OutputDisplay label="Operation ID" value={operationId} />
    </div>
  );
}

// Cancel Tab
function CancelTab({ timelockAddress }: { timelockAddress: Address | undefined }) {
  const [operationId, setOperationId] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

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

  const submit = () => {
    if (!timelockAddress || !output) return;
    sendTransaction({ to: timelockAddress, data: output as Hex });
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Cancel Operation</h3>
        <p>
          Encode a <code>cancel()</code> to abort a pending operation.
        </p>
      </div>

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

const TIMELOCK_ADDRESS_KEY = 'safe-timelock-address';

// Main App
export function App() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [timelockAddress, setTimelockAddress] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TIMELOCK_ADDRESS_KEY) || '';
    }
    return '';
  });

  // Persist timelock address to localStorage
  useEffect(() => {
    if (timelockAddress) {
      localStorage.setItem(TIMELOCK_ADDRESS_KEY, timelockAddress);
    }
  }, [timelockAddress]);

  // Auto-connect to Safe if in iframe
  useAutoConnect();

  const tabs = [
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'schedule-batch', label: 'Schedule Batch', icon: '📦' },
    { id: 'execute', label: 'Execute', icon: '▶️' },
    { id: 'execute-batch', label: 'Execute Batch', icon: '⏩' },
    { id: 'decode', label: 'Decode', icon: '🔍' },
    { id: 'hash', label: 'Hash', icon: '#️⃣' },
    { id: 'cancel', label: 'Cancel', icon: '🚫' },
  ];

  const validTimelockAddress = isAddress(timelockAddress) ? (timelockAddress as Address) : undefined;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>
            <span className="safe-green">Safe</span> +{' '}
            <span className="oz-orange">OZ Timelock</span>
          </h1>
          <p>Create and manage TimelockController transactions for Safe multisigs</p>
        </div>
        <WalletConnection />
      </header>

      <main className="app-main">
        <div className="config-section">
          <InputField
            label="Timelock Contract Address"
            value={timelockAddress}
            onChange={setTimelockAddress}
            placeholder="0x..."
            mono
            helper="The TimelockController contract owned by your Safe"
          />
        </div>

        <nav className="tab-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="tab-panel">
          {activeTab === 'schedule' && <ScheduleTab timelockAddress={validTimelockAddress} />}
          {activeTab === 'schedule-batch' && <ScheduleBatchTab timelockAddress={validTimelockAddress} />}
          {activeTab === 'execute' && <ExecuteTab timelockAddress={validTimelockAddress} />}
          {activeTab === 'execute-batch' && <ExecuteBatchTab timelockAddress={validTimelockAddress} />}
          {activeTab === 'decode' && <DecodeTab />}
          {activeTab === 'hash' && <HashTab />}
          {activeTab === 'cancel' && <CancelTab timelockAddress={validTimelockAddress} />}
        </div>
      </main>

      <footer className="app-footer">
        <div className="workflow-hint">
          <strong>Workflow:</strong> Schedule → Wait for delay → Execute
        </div>
        <p>
          Copy the generated calldata and create a Safe transaction with your Timelock as the target.
        </p>
      </footer>
    </div>
  );
}

export default App;
