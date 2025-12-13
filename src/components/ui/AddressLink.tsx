import { useChainId } from 'wagmi';
import { getAddressUrl } from '../../lib/explorers';
import { truncateAddress } from '../../lib/selectors';

export interface AddressLinkProps {
  address: string;
  truncate?: boolean;
  className?: string;
}

export function AddressLink({ address, truncate = true, className = '' }: AddressLinkProps) {
  const chainId = useChainId();
  const explorerUrl = getAddressUrl(chainId, address);
  const displayAddress = truncate ? truncateAddress(address) : address;

  return (
    <span className={`address-link-wrapper ${className}`}>
      <code className="address-link-value" title={address}>
        {displayAddress}
      </code>
      <span className="address-link-tooltip">
        <div className="address-link-full">{address}</div>
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
      </span>
    </span>
  );
}
