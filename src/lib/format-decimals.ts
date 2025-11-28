export interface DecimalFormat {
  label: string;
  decimals: number;
  formatted: string;
}

const FORMATS = [
  { label: '1e18 (WAD)', decimals: 18 },
  { label: '1e6 (USDC)', decimals: 6 },
] as const;

// Minimum value to show tooltip (1 million)
const MIN_VALUE_FOR_TOOLTIP = 1_000_000n;

/**
 * Format a bigint with decimal places
 * e.g., formatWithDecimals(1234567890123456789n, 18) => "1.234567890123456789"
 */
export function formatWithDecimals(value: bigint, decimals: number): string {
  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;
  const divisor = 10n ** BigInt(decimals);

  const integerPart = absValue / divisor;
  const fractionalPart = absValue % divisor;

  // Pad fractional part with leading zeros
  let fractionalStr = fractionalPart.toString().padStart(decimals, '0');

  // Trim trailing zeros but keep at least 2 decimal places for readability
  fractionalStr = fractionalStr.replace(/0+$/, '');
  if (fractionalStr.length < 2) {
    fractionalStr = fractionalStr.padEnd(2, '0');
  }

  // Format integer part with commas
  const integerStr = integerPart.toLocaleString('en-US');

  const sign = isNegative ? '-' : '';
  return `${sign}${integerStr}.${fractionalStr}`;
}

/**
 * Check if a value should show the decimal tooltip
 */
export function shouldShowDecimalTooltip(value: unknown): value is bigint {
  if (typeof value !== 'bigint') return false;
  const absValue = value < 0n ? -value : value;
  return absValue >= MIN_VALUE_FOR_TOOLTIP;
}

/**
 * Get all decimal format representations for a value
 */
export function getDecimalFormats(value: bigint): DecimalFormat[] {
  return FORMATS.map(({ label, decimals }) => ({
    label,
    decimals,
    formatted: formatWithDecimals(value, decimals),
  }));
}
