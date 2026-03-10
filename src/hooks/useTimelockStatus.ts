import { useReadContract, useReadContracts } from 'wagmi';
import { TIMELOCK_ABI } from '../lib/timelock';
import type { Address, Hex } from 'viem';
import { chains } from '../config/wagmi';

type SupportedChainId = typeof chains[number]['id'];

export interface OperationStatus {
  isOperation: boolean;
  isPending: boolean;
  isReady: boolean;
  isDone: boolean;
  timestamp: bigint;
}

/**
 * Hook to get the status of a timelock operation
 */
export function useOperationStatus(
  timelockAddress: Address | undefined,
  operationId: Hex | undefined,
  chainId?: SupportedChainId
): {
  status: OperationStatus | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      {
        chainId,
        address: timelockAddress,
        abi: TIMELOCK_ABI,
        functionName: 'isOperation',
        args: operationId ? [operationId] : undefined,
      },
      {
        chainId,
        address: timelockAddress,
        abi: TIMELOCK_ABI,
        functionName: 'isOperationPending',
        args: operationId ? [operationId] : undefined,
      },
      {
        chainId,
        address: timelockAddress,
        abi: TIMELOCK_ABI,
        functionName: 'isOperationReady',
        args: operationId ? [operationId] : undefined,
      },
      {
        chainId,
        address: timelockAddress,
        abi: TIMELOCK_ABI,
        functionName: 'isOperationDone',
        args: operationId ? [operationId] : undefined,
      },
      {
        chainId,
        address: timelockAddress,
        abi: TIMELOCK_ABI,
        functionName: 'getTimestamp',
        args: operationId ? [operationId] : undefined,
      },
    ],
    query: {
      enabled: !!timelockAddress && !!operationId,
      refetchOnWindowFocus: false,
    },
  });

  if (!data || data.some((r) => r.status === 'failure')) {
    return {
      status: null,
      isLoading,
      error: error || (data?.find((r) => r.status === 'failure')?.error as Error | null),
      refetch,
    };
  }

  const status: OperationStatus = {
    isOperation: data[0].result as boolean,
    isPending: data[1].result as boolean,
    isReady: data[2].result as boolean,
    isDone: data[3].result as boolean,
    timestamp: data[4].result as bigint,
  };

  return { status, isLoading, error: null, refetch };
}

export function useMinDelay(
  timelockAddress: Address | undefined,
  chainId?: SupportedChainId
): {
  minDelay: bigint | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useReadContract({
    chainId,
    address: timelockAddress,
    abi: TIMELOCK_ABI,
    functionName: 'getMinDelay',
    query: {
      enabled: !!timelockAddress,
      refetchOnWindowFocus: false,
    },
  });

  return {
    minDelay: data as bigint | undefined,
    isLoading,
    error: error as Error | null,
  };
}
