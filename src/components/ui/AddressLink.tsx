import { useState, useCallback } from 'react';
import { useChainId } from 'wagmi';
import { getAddressUrl } from '../../lib/explorers';
import { truncateAddress } from '../../lib/selectors';

export interface AddressLinkProps {
  address: string;
  truncate?: boolean;
  className?: string;
}

export function AddressLink({ address, truncate = true, className = '' }: AddressLinkProps) {
  const [copied, setCopied] = useState(false);
  const chainId = useChainId();
  const explorerUrl = getAddressUrl(chainId, address);
  const displayAddress = truncate ? truncateAddress(address) : address;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Clipboard write failed - don't show success
    });
  }, [address]);

  return (
    <span className={`address-link-wrapper ${className}`}>
      <code
        className="address-link-value"
        title="Click to copy"
        onClick={handleCopy}
      >
        {copied ? '✓ Copied' : displayAddress}
      </code>
      <span className="address-link-tooltip">
        <div className="address-link-full">{address}</div>
        <div className="address-link-actions">
          <button className="address-link-copy" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy address'}
          </button>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="address-link-explorer"
              onClick={(e) => e.stopPropagation()}
            >
              View on Explorer →
            </a>
          )}
        </div>
      </span>
    </span>
  );
}
