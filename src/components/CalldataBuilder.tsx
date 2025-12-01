import { useState, useMemo, useCallback } from 'react';
import { encodeFunctionData, type Abi, type AbiFunction, type Address, isAddress } from 'viem';
import { useSourcifyAbi } from '../hooks/useSourcifyAbi';

interface CalldataBuilderProps {
  targetAddress: string;
  onCalldataGenerated: (calldata: string) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * Get writable functions from an ABI (non-view, non-pure)
 */
function getWritableFunctions(abi: Abi): AbiFunction[] {
  return abi.filter(
    (item): item is AbiFunction =>
      item.type === 'function' &&
      item.stateMutability !== 'view' &&
      item.stateMutability !== 'pure'
  );
}

/**
 * Format a function signature for display
 */
function formatFunctionSignature(fn: AbiFunction): string {
  const params = fn.inputs.map((input) => {
    const name = input.name ? ` ${input.name}` : '';
    return `${input.type}${name}`;
  });
  return `${fn.name}(${params.join(', ')})`;
}

/**
 * Render input field for a parameter type
 */
function ParameterInput({
  name,
  type,
  value,
  onChange,
}: {
  name: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const isArrayType = type.endsWith('[]');
  const isBytesType = type === 'bytes' || type.startsWith('bytes');
  const isBoolType = type === 'bool';

  if (isBoolType) {
    return (
      <div className="param-input">
        <label>
          <span className="param-name">{name || 'unnamed'}</span>
          <span className="param-type">({type})</span>
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="param-select"
        >
          <option value="">Select...</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </div>
    );
  }

  if (isArrayType) {
    return (
      <div className="param-input">
        <label>
          <span className="param-name">{name || 'unnamed'}</span>
          <span className="param-type">({type})</span>
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder='["item1", "item2"] or comma-separated'
          className="param-textarea mono"
          rows={2}
        />
        <span className="param-hint">JSON array or comma-separated values</span>
      </div>
    );
  }

  if (isBytesType && type === 'bytes') {
    return (
      <div className="param-input">
        <label>
          <span className="param-name">{name || 'unnamed'}</span>
          <span className="param-type">({type})</span>
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0x..."
          className="param-textarea mono"
          rows={2}
        />
      </div>
    );
  }

  return (
    <div className="param-input">
      <label>
        <span className="param-name">{name || 'unnamed'}</span>
        <span className="param-type">({type})</span>
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={getPlaceholder(type)}
        className={`param-text-input ${type === 'address' || isBytesType ? 'mono' : ''}`}
      />
    </div>
  );
}

function getPlaceholder(type: string): string {
  if (type === 'address') return '0x...';
  if (type.startsWith('uint') || type.startsWith('int')) return '0';
  if (type.startsWith('bytes')) return '0x...';
  if (type === 'string') return 'text...';
  return '';
}

/**
 * Parse parameter value based on type
 */
function parseParamValue(value: string, type: string): unknown {
  const trimmed = value.trim();

  if (type === 'bool') {
    return trimmed === 'true';
  }

  if (type.startsWith('uint') || type.startsWith('int')) {
    return BigInt(trimmed || '0');
  }

  if (type.endsWith('[]')) {
    // Array type
    if (trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }
    // Empty input = empty array
    if (trimmed === '') {
      return [];
    }
    // Comma-separated
    const baseType = type.slice(0, -2);
    return trimmed.split(',').map((v) => parseParamValue(v.trim(), baseType));
  }

  // address, bytes, string - return as-is
  return trimmed;
}

export function CalldataBuilder({ targetAddress, onCalldataGenerated, onExpandedChange }: CalldataBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFunctionName, setSelectedFunctionName] = useState<string>('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [encodeError, setEncodeError] = useState<string | null>(null);

  const validAddress = isAddress(targetAddress) ? (targetAddress as Address) : undefined;

  const {
    abi,
    status,
    error: fetchError,
    isProxy,
    implementationAddress,
    proxyType,
    isCheckingProxy,
    fetch,
    fetchImplementation,
    reset,
  } = useSourcifyAbi(validAddress);

  // Get writable functions from ABI
  const writableFunctions = useMemo(() => {
    if (!abi) return [];
    return getWritableFunctions(abi);
  }, [abi]);

  // Get selected function
  const selectedFunction = useMemo(() => {
    return writableFunctions.find((fn) => fn.name === selectedFunctionName);
  }, [writableFunctions, selectedFunctionName]);

  // Handle function selection change
  const handleFunctionChange = useCallback((functionName: string) => {
    setSelectedFunctionName(functionName);
    setParamValues({});
    setEncodeError(null);
  }, []);

  // Handle parameter value change
  const handleParamChange = useCallback((paramIndex: number, value: string) => {
    setParamValues((prev) => ({
      ...prev,
      [paramIndex]: value,
    }));
    setEncodeError(null);
  }, []);

  // Generate calldata
  const handleApply = useCallback(() => {
    if (!selectedFunction || !abi) return;

    try {
      setEncodeError(null);

      // Parse all parameter values
      const args = selectedFunction.inputs.map((input, i) => {
        const rawValue = paramValues[i] ?? '';
        return parseParamValue(rawValue, input.type);
      });

      // Encode function data
      const calldata = encodeFunctionData({
        abi,
        functionName: selectedFunction.name,
        args,
      });

      onCalldataGenerated(calldata);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to encode calldata';
      setEncodeError(message);
    }
  }, [selectedFunction, abi, paramValues, onCalldataGenerated]);

  // Handle fetch button click
  const handleFetch = useCallback(() => {
    setIsExpanded(true);
    onExpandedChange?.(true);
    fetch();
  }, [fetch, onExpandedChange]);

  // Handle reset
  const handleReset = useCallback(() => {
    reset();
    setSelectedFunctionName('');
    setParamValues({});
    setEncodeError(null);
    setIsExpanded(false);
    onExpandedChange?.(false);
  }, [reset, onExpandedChange]);

  // Render status message
  const renderStatus = () => {
    if (!isExpanded) return null;

    if (status === 'loading' || isCheckingProxy) {
      return <div className="cb-status loading">Fetching ABI from Sourcify...</div>;
    }

    if (status === 'error') {
      return (
        <div className="cb-status error">
          Error: {fetchError}
          <button onClick={handleReset} className="cb-reset-btn">
            Try again
          </button>
        </div>
      );
    }

    if (status === 'not-found') {
      return (
        <div className="cb-status not-found">
          Contract not verified on Sourcify.
          <button onClick={handleReset} className="cb-reset-btn">
            Close
          </button>
        </div>
      );
    }

    return null;
  };

  // Render proxy warning
  const renderProxyWarning = () => {
    if (!isExpanded || status !== 'success' || !isProxy || !implementationAddress) {
      return null;
    }

    return (
      <div className="cb-proxy-warning">
        <div className="cb-proxy-icon">⚠️</div>
        <div className="cb-proxy-content">
          <div className="cb-proxy-title">
            Proxy Detected ({proxyType === 'beacon' ? 'Beacon' : 'ERC1967'})
          </div>
          <div className="cb-proxy-impl">
            Implementation: <code>{implementationAddress.slice(0, 10)}...{implementationAddress.slice(-8)}</code>
          </div>
          <div className="cb-proxy-actions">
            <button onClick={fetchImplementation} className="btn btn-secondary btn-sm">
              Use Implementation ABI
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render function selector and params
  const renderFunctionBuilder = () => {
    if (!isExpanded || status !== 'success' || !abi) return null;

    return (
      <div className="cb-function-builder">
        <div className="cb-function-select">
          <label>Function</label>
          <select
            value={selectedFunctionName}
            onChange={(e) => handleFunctionChange(e.target.value)}
            className="cb-select"
          >
            <option value="">Select a function...</option>
            {writableFunctions.map((fn) => (
              <option key={fn.name} value={fn.name}>
                {formatFunctionSignature(fn)}
              </option>
            ))}
          </select>
          {writableFunctions.length === 0 && (
            <span className="cb-hint">No writable functions found</span>
          )}
        </div>

        {selectedFunction && selectedFunction.inputs.length > 0 && (
          <div className="cb-params">
            <label>Parameters</label>
            {selectedFunction.inputs.map((input, i) => (
              <ParameterInput
                key={i}
                name={input.name || `param${i}`}
                type={input.type}
                value={paramValues[i] ?? ''}
                onChange={(v) => handleParamChange(i, v)}
              />
            ))}
          </div>
        )}

        {selectedFunction && (
          <div className="cb-actions">
            <button onClick={handleApply} className="btn btn-primary btn-sm">
              Apply to Calldata
            </button>
            <button onClick={handleReset} className="btn btn-secondary btn-sm">
              Close
            </button>
          </div>
        )}

        {encodeError && <div className="cb-error">{encodeError}</div>}
      </div>
    );
  };

  // Don't render if no valid address
  if (!validAddress) {
    return null;
  }

  return (
    <div className="calldata-builder">
      {!isExpanded && (
        <button onClick={handleFetch} className="cb-fetch-btn">
          Fetch ABI from Sourcify
        </button>
      )}

      {renderStatus()}
      {renderProxyWarning()}
      {renderFunctionBuilder()}
    </div>
  );
}
