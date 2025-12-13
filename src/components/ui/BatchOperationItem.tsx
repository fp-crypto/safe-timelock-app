import { useState } from 'react';
import type { Hex, Address } from 'viem';
import { DecodedCalldata, DecodedCalldataSummary } from '../DecodedCalldata';
import { AddressLink } from './AddressLink';

export interface BatchOperationItemProps {
  index: number;
  operation: { target: Address; value: string; data: Hex };
}

export function BatchOperationItem({ index, operation }: BatchOperationItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="batch-operation">
      <div
        className="batch-operation-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="batch-op-index">#{index + 1}</span>
        <DecodedCalldataSummary calldata={operation.data} target={operation.target} />
        <span className="batch-op-expand">{isExpanded ? '▼' : '▶'}</span>
      </div>
      {isExpanded && (
        <div className="batch-operation-content">
          <div className="op-details">
            <div>
              <span className="label">Target:</span> <AddressLink address={operation.target} truncate={false} />
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
