import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import type { Abi, Address } from 'viem';
import { useProxyDetection } from './useProxyDetection';

interface SourcifyFile {
  name: string;
  path: string;
  content: string;
}

interface SourcifyResponse {
  status: 'full' | 'partial';
  files: SourcifyFile[];
}

export type SourcifyStatus = 'idle' | 'loading' | 'success' | 'not-found' | 'error';

export interface UseSourcifyAbiResult {
  abi: Abi | null;
  status: SourcifyStatus;
  error: string | null;
  isProxy: boolean;
  implementationAddress: Address | null;
  proxyType: 'erc1967' | 'beacon' | null;
  isCheckingProxy: boolean;
  fetch: () => void;
  fetchImplementation: () => void;
  reset: () => void;
}

/**
 * Fetch ABI from Sourcify (exported for reuse)
 */
export async function fetchSourcifyAbi(
  chainId: number,
  address: Address
): Promise<Abi | null> {
  const url = `https://sourcify.dev/server/files/any/${chainId}/${address}`;
  const response = await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Sourcify API error: ${response.status}`);
  }

  const data: SourcifyResponse = await response.json();

  // Find metadata.json file
  const metadataFile = data.files.find(
    (f) => f.name === 'metadata.json' || f.path.endsWith('metadata.json')
  );

  if (!metadataFile) {
    throw new Error('No metadata.json found in Sourcify response');
  }

  // Parse metadata and extract ABI
  const metadata = JSON.parse(metadataFile.content);
  const abi = metadata?.output?.abi;

  if (!abi || !Array.isArray(abi)) {
    throw new Error('Invalid ABI in metadata');
  }

  return abi as Abi;
}

/**
 * Hook to fetch contract ABI from Sourcify with proxy detection
 */
export function useSourcifyAbi(address: Address | undefined): UseSourcifyAbiResult {
  const chainId = useChainId();
  const queryClient = useQueryClient();

  // Track which address we're fetching ABI for (proxy vs implementation)
  const [targetAddress, setTargetAddress] = useState<Address | undefined>(undefined);
  const [shouldFetch, setShouldFetch] = useState(false);

  // Proxy detection
  const {
    isProxy,
    implementationAddress,
    proxyType,
    isLoading: isCheckingProxy,
  } = useProxyDetection(targetAddress);

  // ABI fetch query
  const {
    data: abi,
    isLoading,
    error,
    isFetched,
  } = useQuery({
    queryKey: ['sourcify-abi', chainId, targetAddress],
    queryFn: async () => {
      if (!targetAddress || !chainId) return null;
      return fetchSourcifyAbi(chainId, targetAddress);
    },
    enabled: shouldFetch && !!targetAddress && !!chainId,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Determine status
  const getStatus = (): SourcifyStatus => {
    if (!shouldFetch || !targetAddress) return 'idle';
    if (isLoading) return 'loading';
    if (error) return 'error';
    if (isFetched && abi === null) return 'not-found';
    if (abi) return 'success';
    return 'idle';
  };

  // Fetch ABI for the given address (or the address prop)
  const fetch = useCallback(() => {
    if (!address) return;
    setTargetAddress(address);
    setShouldFetch(true);
  }, [address]);

  // Fetch ABI for the implementation address (if proxy)
  const fetchImplementation = useCallback(() => {
    if (!implementationAddress) return;
    setTargetAddress(implementationAddress);
    // Invalidate to force refetch with new address
    queryClient.invalidateQueries({
      queryKey: ['sourcify-abi', chainId, implementationAddress],
    });
    setShouldFetch(true);
  }, [implementationAddress, chainId, queryClient]);

  // Reset state
  const reset = useCallback(() => {
    setTargetAddress(undefined);
    setShouldFetch(false);
  }, []);

  return {
    abi: abi ?? null,
    status: getStatus(),
    error: error instanceof Error ? error.message : null,
    isProxy,
    implementationAddress,
    proxyType,
    isCheckingProxy,
    fetch,
    fetchImplementation,
    reset,
  };
}
