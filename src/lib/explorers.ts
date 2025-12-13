// Block explorer URLs by chain ID
const EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io',
  5: 'https://goerli.etherscan.io',
  10: 'https://optimistic.etherscan.io',
  56: 'https://bscscan.com',
  100: 'https://gnosisscan.io',
  137: 'https://polygonscan.com',
  250: 'https://ftmscan.com',
  8453: 'https://basescan.org',
  42161: 'https://arbiscan.io',
  43114: 'https://snowtrace.io',
  11155111: 'https://sepolia.etherscan.io',
};

export function getExplorerUrl(chainId: number | undefined): string | null {
  if (!chainId) return null;
  return EXPLORERS[chainId] || null;
}

export function getAddressUrl(chainId: number | undefined, address: string): string | null {
  const explorer = getExplorerUrl(chainId);
  if (!explorer) return null;
  return `${explorer}/address/${address}`;
}

export function getTxUrl(chainId: number | undefined, txHash: string): string | null {
  const explorer = getExplorerUrl(chainId);
  if (!explorer) return null;
  return `${explorer}/tx/${txHash}`;
}
