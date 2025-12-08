import { useState, useCallback, useEffect } from 'react';
import { type Hex, type Address } from 'viem';
import { InputField, OutputDisplay, BatchOperationItem, CopyLinkButton } from '../components/ui';
import { DecodedCalldata } from '../components/DecodedCalldata';
import { AbiManager } from '../components/AbiManager';
import { PendingSafeTransactions } from '../components/PendingSafeTransactions';
import { decodeTimelockCalldata, formatDelay } from '../lib/timelock';
import { parseUrlState } from '../hooks/useUrlState';

interface DecodeTabProps {
  initialCalldata: string;
  initialDecode: boolean;
  onUpdate: (calldata: string, decode: boolean) => void;
  timelockAddress: string;
  onClear: () => void;
  getShareableUrl: () => string;
}

export function DecodeTab({
  initialCalldata,
  initialDecode,
  onUpdate,
  timelockAddress,
  onClear,
  getShareableUrl,
}: DecodeTabProps) {
  const [calldata, setCalldata] = useState(() => {
    const current = parseUrlState();
    return current.calldata || initialCalldata;
  });
  const [decoded, setDecoded] = useState<ReturnType<typeof decodeTimelockCalldata>>(null);
  const [error, setError] = useState('');
  const [hasAutoDecoded, setHasAutoDecoded] = useState(false);

  useEffect(() => {
    onUpdate(calldata, decoded !== null);
  }, [calldata, decoded, onUpdate]);

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

  // Auto-decode on mount if initialDecode is true and we have calldata
  useEffect(() => {
    if (initialDecode && initialCalldata && !hasAutoDecoded) {
      setHasAutoDecoded(true);
      decode();
    }
  }, [initialDecode, initialCalldata, hasAutoDecoded, decode]);

  const handleSelectPendingTx = useCallback((data: string) => {
    setCalldata(data);
    setDecoded(null);
    setError('');
  }, []);

  const handleClear = useCallback(() => {
    setCalldata('');
    setDecoded(null);
    setError('');
    setHasAutoDecoded(false);
    onClear();
  }, [onClear]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div className="tab-header-row">
          <h3>Decode Calldata</h3>
          <button onClick={handleClear} className="clear-btn" title="Clear all fields">
            Clear
          </button>
        </div>
        <p>Paste TimelockController calldata to decode and inspect it.</p>
      </div>

      <PendingSafeTransactions
        timelockAddress={timelockAddress}
        onSelect={handleSelectPendingTx}
      />

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
          <CopyLinkButton getUrl={getShareableUrl} />
        </div>
      )}

      <AbiManager />
    </div>
  );
}
