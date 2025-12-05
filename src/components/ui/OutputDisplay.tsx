import { useState } from 'react';

export interface OutputDisplayProps {
  label: string;
  value: string;
}

export function OutputDisplay({ label, value }: OutputDisplayProps) {
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
