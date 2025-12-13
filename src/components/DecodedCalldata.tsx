import { useState } from 'react';
import { isAddress, type Address, type Hex } from 'viem';
import { useDecodeCalldata, type DecodedInnerCalldata } from '../hooks';
import { DecimalTooltip } from './DecimalTooltip';
import { AddressLink } from './ui';

interface DecodedCalldataProps {
  calldata: Hex | undefined;
  target?: string;
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`risk-badge risk-${level}`}>
      {level.toUpperCase()}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const labels: Record<string, string> = {
    local: 'Built-in',
    'user-abi': 'Custom ABI',
    sourcify: 'Sourcify',
    'sourcify-impl': 'Sourcify (impl)',
    '4byte': '4byte.directory',
  };
  return <span className="source-badge">{labels[source] || source}</span>;
}

function CopyableValue({
  value,
  display,
}: {
  value: string;
  display: string;
}) {
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isTruncated = value !== display;

  if (!isTruncated) {
    return <span className="param-value">{display}</span>;
  }

  return (
    <span className="param-value-wrapper">
      <span
        className="param-value clickable"
        onClick={() => setShowFull(!showFull)}
        title="Click to expand"
      >
        {showFull ? value : display}
      </span>
      {showFull && (
        <button
          className="param-copy-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
        >
          {copied ? '✓' : 'Copy'}
        </button>
      )}
    </span>
  );
}

/**
 * Check if a type is a numeric type that should show decimal tooltip
 */
function isNumericType(type: string): boolean {
  return type.startsWith('uint') || type.startsWith('int');
}

function ParamsTable({
  params,
}: {
  params: { name: string; type: string; value: unknown; display: string }[];
}) {
  return (
    <div className="params-table">
      <div className="params-header">
        <span>Name</span>
        <span>Type</span>
        <span>Value</span>
      </div>
      {params.map((param, i) => (
        <div key={i} className="params-row">
          <span className="param-name">{param.name || `arg${i}`}</span>
          <span className="param-type">{param.type}</span>
          {param.type === 'address' && typeof param.value === 'string' ? (
            <AddressLink address={param.value} />
          ) : isNumericType(param.type) ? (
            <DecimalTooltip value={param.value}>
              <CopyableValue value={String(param.value)} display={param.display} />
            </DecimalTooltip>
          ) : (
            <CopyableValue value={String(param.value)} display={param.display} />
          )}
        </div>
      ))}
    </div>
  );
}

function DecodedContent({
  decoded,
  target,
}: {
  decoded: DecodedInnerCalldata;
  target?: string;
}) {
  if (decoded.status === 'unknown') {
    return (
      <div className="decoded-calldata decoded-unknown">
        <div className="decoded-header">
          <span className="function-name">Unknown Function</span>
        </div>
        <div className="decoded-body">
          <div className="decoded-row">
            <span className="label">Selector:</span>
            <code>{decoded.selector}</code>
          </div>
          <p className="decoded-hint">
            Add a custom ABI to decode this function's parameters.
          </p>
        </div>
      </div>
    );
  }

  const isCritical = decoded.riskLevel === 'critical';
  const isHigh = decoded.riskLevel === 'high';

  return (
    <div
      className={`decoded-calldata ${isCritical ? 'decoded-critical' : ''} ${isHigh ? 'decoded-high' : ''}`}
    >
      <div className="decoded-header">
        {decoded.riskLevel && <RiskBadge level={decoded.riskLevel} />}
        <span className="function-name">{decoded.functionName}()</span>
        {decoded.source && <SourceBadge source={decoded.source} />}
      </div>

      <div className="decoded-body">
        {decoded.signature && (
          <div className="decoded-row">
            <span className="label">Signature:</span>
            <code>{decoded.signature}</code>
          </div>
        )}

        {target && (
          <div className="decoded-row">
            <span className="label">Target:</span>
            <AddressLink address={target} />
          </div>
        )}

        {decoded.description && (
          <div className="decoded-row">
            <span className="label">Description:</span>
            <span>{decoded.description}</span>
          </div>
        )}

        {decoded.params && decoded.params.length > 0 && (
          <div className="decoded-params">
            <span className="label">Parameters:</span>
            <ParamsTable params={decoded.params} />
          </div>
        )}

        {decoded.summary && (
          <div className="decoded-summary">
            <span className="summary-icon">→</span>
            <span>{decoded.summary}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DecodedCalldata({ calldata, target }: DecodedCalldataProps) {
  const validTarget = target && isAddress(target) ? (target as Address) : undefined;
  const decoded = useDecodeCalldata(calldata, validTarget);

  // Don't render anything for empty calldata (0x)
  if (!calldata || calldata === '0x') {
    return (
      <div className="decoded-calldata decoded-empty">
        <div className="decoded-header">
          <span className="function-name">No calldata</span>
        </div>
        <div className="decoded-body">
          <p className="decoded-hint">
            This operation sends ETH without calling a function.
          </p>
        </div>
      </div>
    );
  }

  if (decoded.isLoading) {
    return (
      <div className="decoded-calldata decoded-loading">
        <div className="decoded-header">
          <span className="function-name">Looking up signature...</span>
        </div>
        <div className="decoded-body">
          <div className="decoded-row">
            <span className="label">Selector:</span>
            <code>{decoded.selector}</code>
          </div>
        </div>
      </div>
    );
  }

  return <DecodedContent decoded={decoded} target={target} />;
}

// Lightweight version for batch operation summaries
export function DecodedCalldataSummary({
  calldata,
  target,
}: {
  calldata: Hex | undefined;
  target?: string;
}) {
  const validTarget = target && isAddress(target) ? (target as Address) : undefined;
  const decoded = useDecodeCalldata(calldata, validTarget);

  if (!calldata || calldata === '0x') {
    return <span className="decoded-summary-inline">ETH transfer</span>;
  }

  if (decoded.isLoading) {
    return <span className="decoded-summary-inline">Loading...</span>;
  }

  if (decoded.status === 'unknown') {
    return (
      <span className="decoded-summary-inline">
        <code>{decoded.selector}</code>
      </span>
    );
  }

  return (
    <span className="decoded-summary-inline">
      {decoded.riskLevel && (
        <span className={`risk-dot risk-${decoded.riskLevel}`} />
      )}
      <span className="function-name">{decoded.functionName}()</span>
    </span>
  );
}
