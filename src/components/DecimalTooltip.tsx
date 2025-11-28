import { useMemo } from 'react';
import { getDecimalFormats, shouldShowDecimalTooltip } from '../lib/format-decimals';

interface DecimalTooltipProps {
  value: unknown;
  children: React.ReactNode;
}

/**
 * Wraps a value with a hover tooltip showing decimal conversions.
 * Only shows tooltip for large bigint values (>= 1e6).
 */
export function DecimalTooltip({ value, children }: DecimalTooltipProps) {
  const formats = useMemo(() => {
    if (!shouldShowDecimalTooltip(value)) return null;
    return getDecimalFormats(value);
  }, [value]);

  // If no formats to show, just render children directly
  if (!formats) {
    return <>{children}</>;
  }

  return (
    <span className="decimal-tooltip-wrapper">
      {children}
      <span className="decimal-tooltip">
        {formats.map((fmt) => (
          <div key={fmt.decimals} className="decimal-tooltip-row">
            <span className="decimal-tooltip-label">{fmt.label}</span>
            <span className="decimal-tooltip-value">{fmt.formatted}</span>
          </div>
        ))}
      </span>
    </span>
  );
}
