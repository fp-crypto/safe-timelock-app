import { useQuery } from '@tanstack/react-query';
import type { Address, Hex } from 'viem';
import { extractTimelockCalldata } from '../lib/timelock';

export interface SafeTransaction {
  safeTxHash: string;
  to: string;
  data: string;
  value: string;
  nonce: number;
  confirmations: Array<{
    owner: string;
    submissionDate: string;
    signature: string;
  }>;
  confirmationsRequired: number;
  submissionDate: string;
  isExecuted: boolean;
}

interface SafeTransactionResponse {
  count: number;
  results: SafeTransaction[];
}

export const SAFE_TX_SERVICE_SHORTNAMES: Record<number, string> = {
  1: 'eth',
  11155111: 'sep',
  42161: 'arb1',
  10: 'oeth',
  137: 'pol',
  8453: 'base',
  100: 'gno',
};

export function getSafeServiceUrl(chainId: number): string | null {
  const shortname = SAFE_TX_SERVICE_SHORTNAMES[chainId];
  if (!shortname) return null;
  return `https://api.safe.global/tx-service/${shortname}`;
}

interface SafeInfo {
  nonce: number;
  threshold: number;
  owners: string[];
}

async function fetchSafeInfo(
  baseUrl: string,
  safeAddress: Address
): Promise<SafeInfo> {
  const url = `${baseUrl}/api/v1/safes/${safeAddress}/`;
  const response = await fetch(url);
  if (response.status === 429) {
    throw new Error('429: Rate limited by Safe Transaction Service');
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch Safe info: ${response.status}`);
  }
  return response.json();
}

async function fetchPendingTransactions(
  safeAddress: Address,
  chainId: number
): Promise<SafeTransaction[]> {
  const baseUrl = getSafeServiceUrl(chainId);
  if (!baseUrl) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  const [safeInfo, txResponse] = await Promise.all([
    fetchSafeInfo(baseUrl, safeAddress),
    fetch(`${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/?executed=false&limit=50`),
  ]);

  if (txResponse.status === 429) {
    throw new Error('429: Rate limited by Safe Transaction Service');
  }
  if (!txResponse.ok) {
    throw new Error(`Failed to fetch pending transactions: ${txResponse.status}`);
  }

  const data: SafeTransactionResponse = await txResponse.json();

  // Filter out stale transactions (nonce < current Safe nonce)
  return data.results.filter((tx) => tx.nonce >= safeInfo.nonce);
}

export async function fetchExecutedTransactions(
  safeAddress: Address,
  chainId: number,
  sinceDate?: Date
): Promise<SafeTransaction[]> {
  const baseUrl = getSafeServiceUrl(chainId);
  if (!baseUrl) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  let url = `${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/?executed=true&limit=100&ordering=-executionDate`;

  const response = await fetch(url);
  if (response.status === 429) {
    throw new Error('429: Rate limited by Safe Transaction Service');
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch executed transactions: ${response.status}`);
  }

  const data: SafeTransactionResponse = await response.json();

  // Filter by date if provided
  if (sinceDate) {
    return data.results.filter((tx) => new Date(tx.submissionDate) >= sinceDate);
  }

  return data.results;
}

export function usePendingSafeTransactions(
  safeAddress: Address | undefined,
  chainId: number | undefined
) {
  return useQuery({
    queryKey: ['pendingSafeTransactions', safeAddress, chainId],
    queryFn: () => fetchPendingTransactions(safeAddress!, chainId!),
    enabled: !!safeAddress && !!chainId && !!SAFE_TX_SERVICE_SHORTNAMES[chainId],
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });
}

export interface FilteredSafeTransaction extends SafeTransaction {
  timelockCalldata: Hex;
}

export function filterTimelockTransactions(
  transactions: SafeTransaction[],
  timelockAddress: string | undefined
): FilteredSafeTransaction[] {
  if (!timelockAddress) return [];

  const result: FilteredSafeTransaction[] = [];

  for (const tx of transactions) {
    const timelockCalldata = extractTimelockCalldata(
      tx.to,
      tx.data as Hex,
      timelockAddress
    );

    if (timelockCalldata) {
      result.push({
        ...tx,
        timelockCalldata,
      });
    }
  }

  return result;
}
