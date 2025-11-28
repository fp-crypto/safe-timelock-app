import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChainId, usePublicClient } from 'wagmi';
import type { Abi, AbiFunction, Address, Hex } from 'viem';
import { decodeFunctionData, toFunctionSelector } from 'viem';
import { fetchSourcifyAbi } from './useSourcifyAbi';
import { formatParamValue, type DecodedInnerCalldata, type DecodedParam } from '../lib/selectors';

// ERC1967 storage slots
const ERC1967_IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as Hex;

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

interface SourcifyDecodeResult {
  decoded: DecodedInnerCalldata | null;
  isLoading: boolean;
  source: 'sourcify' | 'sourcify-impl' | null;
}

/**
 * Extract address from storage slot value (last 20 bytes)
 */
function extractAddress(slot: Hex): Address | null {
  if (!slot || slot === ZERO_BYTES32) return null;
  const addressHex = '0x' + slot.slice(-40);
  if (addressHex === '0x0000000000000000000000000000000000000000') return null;
  return addressHex as Address;
}

/**
 * Find a function in an ABI by its selector
 */
function findFunctionBySelector(abi: Abi, selector: Hex): AbiFunction | null {
  for (const item of abi) {
    if (item.type !== 'function') continue;
    try {
      const fnSelector = toFunctionSelector(item);
      if (fnSelector.toLowerCase() === selector.toLowerCase()) {
        return item;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Try to decode calldata using an ABI
 */
function tryDecodeWithAbi(
  calldata: Hex,
  abi: Abi,
  selector: Hex,
  source: 'sourcify' | 'sourcify-impl',
  implAddress?: Address | null
): DecodedInnerCalldata | null {
  const func = findFunctionBySelector(abi, selector);
  if (!func) return null;

  try {
    const decoded = decodeFunctionData({ abi, data: calldata });
    const args = decoded.args ?? [];

    const params: DecodedParam[] = func.inputs.map((input, i) => ({
      name: input.name || `arg${i}`,
      type: input.type,
      value: args[i],
      display: formatParamValue(input.type, args[i]),
    }));

    const signature = `${func.name}(${func.inputs.map((i) => i.type).join(',')})`;
    const description =
      source === 'sourcify-impl' && implAddress
        ? `Sourcify (impl: ${implAddress.slice(0, 10)}...)`
        : 'Sourcify verified contract';

    return {
      status: 'decoded',
      source,
      selector,
      functionName: func.name,
      signature,
      description,
      params,
      summary: `Call ${func.name}()`,
    };
  } catch {
    // Decoding failed, return signature-only
    const signature = `${func.name}(${func.inputs.map((i) => i.type).join(',')})`;
    return {
      status: 'signature-only',
      source,
      selector,
      functionName: func.name,
      signature,
      description: source === 'sourcify-impl' ? 'Sourcify (implementation)' : 'Sourcify verified',
    };
  }
}

/**
 * Hook to decode calldata using Sourcify ABIs.
 * Checks both the target address and its implementation (if proxy).
 */
export function useSourcifyDecode(
  calldata: Hex | undefined,
  target: Address | undefined,
  selector: Hex | null,
  skip: boolean
): SourcifyDecodeResult {
  const chainId = useChainId();
  const client = usePublicClient();

  const shouldFetch = !skip && !!target && !!selector && !!chainId;

  // Fetch target ABI
  const {
    data: targetAbi,
    isLoading: targetLoading,
    isFetched: targetFetched,
  } = useQuery({
    queryKey: ['sourcify-decode-target', chainId, target],
    queryFn: () => fetchSourcifyAbi(chainId, target!),
    enabled: shouldFetch,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Check if selector exists in target ABI
  const targetMatch = useMemo(() => {
    if (!targetAbi || !calldata || !selector) return null;
    return tryDecodeWithAbi(calldata, targetAbi, selector, 'sourcify');
  }, [targetAbi, calldata, selector]);

  // Check if target is a proxy (only if no match in target ABI)
  const shouldCheckProxy = shouldFetch && targetFetched && !targetMatch;

  const { data: implAddress, isLoading: proxyLoading } = useQuery({
    queryKey: ['sourcify-decode-proxy', target, client?.chain?.id],
    queryFn: async () => {
      if (!client || !target) return null;
      try {
        const slot = await client.getStorageAt({
          address: target,
          slot: ERC1967_IMPLEMENTATION_SLOT,
        });
        return extractAddress(slot || (ZERO_BYTES32 as Hex));
      } catch {
        return null;
      }
    },
    enabled: shouldCheckProxy && !!client,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch implementation ABI (only if target is proxy and no match in target ABI)
  const shouldFetchImpl = shouldCheckProxy && !!implAddress;

  const { data: implAbi, isLoading: implLoading } = useQuery({
    queryKey: ['sourcify-decode-impl', chainId, implAddress],
    queryFn: () => fetchSourcifyAbi(chainId, implAddress!),
    enabled: shouldFetchImpl,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Check if selector exists in implementation ABI
  const implMatch = useMemo(() => {
    if (!implAbi || !calldata || !selector) return null;
    return tryDecodeWithAbi(calldata, implAbi, selector, 'sourcify-impl', implAddress);
  }, [implAbi, calldata, selector, implAddress]);

  // Determine final result
  const result = useMemo((): SourcifyDecodeResult => {
    if (skip || !target || !selector) {
      return { decoded: null, isLoading: false, source: null };
    }

    // Return target match if found
    if (targetMatch) {
      return { decoded: targetMatch, isLoading: false, source: 'sourcify' };
    }

    // Return implementation match if found
    if (implMatch) {
      return { decoded: implMatch, isLoading: false, source: 'sourcify-impl' };
    }

    // Check if still loading
    const isLoading = targetLoading || (shouldCheckProxy && proxyLoading) || (shouldFetchImpl && implLoading);

    return { decoded: null, isLoading, source: null };
  }, [skip, target, selector, targetMatch, implMatch, targetLoading, shouldCheckProxy, proxyLoading, shouldFetchImpl, implLoading]);

  return result;
}
