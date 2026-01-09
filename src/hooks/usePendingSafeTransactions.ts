import { useQuery } from '@tanstack/react-query';
import type { Address, Hex } from 'viem';
import { extractTimelockCalldata } from '../lib/timelock';
import { getApiKey } from '../lib/api-keys';

/**
 * Fetch wrapper that adds Safe API key auth header if configured
 */
function safeFetch(url: string): Promise<Response> {
  const headers: HeadersInit = {};
  const apiKey = getApiKey('safe');
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return fetch(url, { headers });
}

// Cache durations
const SAFE_INFO_STALE_TIME = 30 * 60 * 1000; // 30 minutes
const SAFE_INFO_GC_TIME = 60 * 60 * 1000; // 1 hour
const PENDING_TX_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const PENDING_TX_GC_TIME = 30 * 60 * 1000; // 30 minutes

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
  const response = await safeFetch(url);
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
  chainId: number,
  currentNonce: number
): Promise<SafeTransaction[]> {
  const baseUrl = getSafeServiceUrl(chainId);
  if (!baseUrl) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  const response = await safeFetch(
    `${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/?executed=false&limit=20`
  );

  if (response.status === 429) {
    throw new Error('429: Rate limited by Safe Transaction Service');
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch pending transactions: ${response.status}`);
  }

  const data: SafeTransactionResponse = await response.json();

  // Filter out stale transactions (nonce < current Safe nonce)
  return data.results.filter((tx) => tx.nonce >= currentNonce);
}

/**
 * Hook to fetch Safe info (nonce, threshold, owners) with long cache
 */
export function useSafeInfo(safeAddress: Address | undefined, chainId: number | undefined) {
  return useQuery({
    queryKey: ['safeInfo', safeAddress, chainId],
    queryFn: async () => {
      const baseUrl = getSafeServiceUrl(chainId!);
      if (!baseUrl) throw new Error(`Unsupported chain: ${chainId}`);
      return fetchSafeInfo(baseUrl, safeAddress!);
    },
    enabled: !!safeAddress && !!chainId && !!SAFE_TX_SERVICE_SHORTNAMES[chainId],
    staleTime: SAFE_INFO_STALE_TIME,
    gcTime: SAFE_INFO_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });
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

  const url = `${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/?executed=true&limit=200&ordering=-executionDate`;

  const response = await safeFetch(url);
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
  // Get cached safe info for nonce filtering
  const { data: safeInfo, refetch: refetchSafeInfo } = useSafeInfo(safeAddress, chainId);

  const query = useQuery({
    queryKey: ['pendingSafeTransactions', safeAddress, chainId, safeInfo?.nonce],
    queryFn: () => fetchPendingTransactions(safeAddress!, chainId!, safeInfo!.nonce),
    enabled: !!safeAddress && !!chainId && !!SAFE_TX_SERVICE_SHORTNAMES[chainId] && !!safeInfo,
    staleTime: PENDING_TX_STALE_TIME,
    gcTime: PENDING_TX_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
  });

  // Safe refetch that refreshes safe info first (pending tx will auto-refetch via query key)
  const refetch = async () => {
    await refetchSafeInfo();
    // If safeInfo was already available, also refetch pending (query key may not change)
    if (safeInfo) {
      await query.refetch();
    }
  };

  return { ...query, refetch };
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
