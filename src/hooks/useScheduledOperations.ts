import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReadContracts } from 'wagmi';
import type { Address, Hex } from 'viem';
import {
  usePendingSafeTransactions,
  fetchExecutedTransactions,
  filterTimelockTransactions,
  SAFE_TX_SERVICE_SHORTNAMES,
  type SafeTransaction,
} from './usePendingSafeTransactions';
import { useMinDelay } from './useTimelockStatus';
import {
  decodeTimelockCalldata,
  TIMELOCK_ABI,
  type DecodedTimelock,
} from '../lib/timelock';

export interface ScheduledOperation {
  safeTxHash: string;
  nonce: number;
  timelockCalldata: Hex;
  decoded: DecodedTimelock;
  operationId: Hex;
  submissionDate: string;
  safeStatus: 'pending' | 'executed';
  confirmations: number;
  confirmationsRequired: number;
  timelockStatus?: {
    isPending: boolean;
    isReady: boolean;
    isDone: boolean;
    timestamp: bigint;
  };
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function useScheduledOperations(
  safeAddress: Address | undefined,
  chainId: number | undefined,
  timelockAddress: Address | undefined
) {
  // Get minDelay to determine lookback period
  const { minDelay } = useMinDelay(timelockAddress);

  // Fetch pending Safe transactions
  const {
    data: pendingTxs,
    isLoading: pendingLoading,
    error: pendingError,
  } = usePendingSafeTransactions(safeAddress, chainId);

  // Calculate lookback date based on minDelay
  const sinceDate = useMemo(() => {
    if (minDelay !== undefined) {
      // Look back minDelay + 7 days
      const lookbackMs = Number(minDelay) * 1000 + SEVEN_DAYS_MS;
      return new Date(Date.now() - lookbackMs);
    }
    // Default to 30 days if minDelay not available
    return new Date(Date.now() - THIRTY_DAYS_MS);
  }, [minDelay]);

  // Fetch executed Safe transactions
  const {
    data: executedTxs,
    isLoading: executedLoading,
    error: executedError,
  } = useQuery({
    queryKey: ['executedSafeTransactions', safeAddress, chainId, sinceDate.getTime()],
    queryFn: () => fetchExecutedTransactions(safeAddress!, chainId!, sinceDate),
    enabled: !!safeAddress && !!chainId && !!SAFE_TX_SERVICE_SHORTNAMES[chainId],
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Filter and decode schedule operations from both sources
  const { pendingScheduleOps, executedScheduleOps } = useMemo(() => {
    const pending: Array<{
      tx: SafeTransaction;
      timelockCalldata: Hex;
      decoded: DecodedTimelock;
    }> = [];
    const executed: Array<{
      tx: SafeTransaction;
      timelockCalldata: Hex;
      decoded: DecodedTimelock;
    }> = [];

    // Process pending transactions
    if (pendingTxs && timelockAddress) {
      const filtered = filterTimelockTransactions(pendingTxs, timelockAddress);
      for (const tx of filtered) {
        try {
          const decoded = decodeTimelockCalldata(tx.timelockCalldata);
          if (decoded && (decoded.functionName === 'schedule' || decoded.functionName === 'scheduleBatch')) {
            pending.push({ tx, timelockCalldata: tx.timelockCalldata, decoded });
          }
        } catch {
          // Skip transactions that can't be decoded
        }
      }
    }

    // Process executed transactions
    if (executedTxs && timelockAddress) {
      const filtered = filterTimelockTransactions(executedTxs, timelockAddress);
      for (const tx of filtered) {
        try {
          const decoded = decodeTimelockCalldata(tx.timelockCalldata);
          if (decoded && (decoded.functionName === 'schedule' || decoded.functionName === 'scheduleBatch')) {
            executed.push({ tx, timelockCalldata: tx.timelockCalldata, decoded });
          }
        } catch {
          // Skip transactions that can't be decoded
        }
      }
    }

    return { pendingScheduleOps: pending, executedScheduleOps: executed };
  }, [pendingTxs, executedTxs, timelockAddress]);

  // Collect operation IDs for batch status check
  const executedOperationIds = useMemo(() => {
    return executedScheduleOps
      .map((op) => op.decoded.operationId)
      .filter((id): id is Hex => !!id);
  }, [executedScheduleOps]);

  // Batch query on-chain status for executed operations
  const statusContracts = useMemo(() => {
    if (!timelockAddress || executedOperationIds.length === 0) return [];

    const contracts: Array<{
      address: Address;
      abi: typeof TIMELOCK_ABI;
      functionName: string;
      args: [Hex];
    }> = [];

    for (const operationId of executedOperationIds) {
      contracts.push(
        {
          address: timelockAddress,
          abi: TIMELOCK_ABI,
          functionName: 'isOperationPending',
          args: [operationId],
        },
        {
          address: timelockAddress,
          abi: TIMELOCK_ABI,
          functionName: 'isOperationReady',
          args: [operationId],
        },
        {
          address: timelockAddress,
          abi: TIMELOCK_ABI,
          functionName: 'isOperationDone',
          args: [operationId],
        },
        {
          address: timelockAddress,
          abi: TIMELOCK_ABI,
          functionName: 'getTimestamp',
          args: [operationId],
        }
      );
    }

    return contracts;
  }, [timelockAddress, executedOperationIds]);

  const { data: statusData, isLoading: statusLoading } = useReadContracts({
    contracts: statusContracts,
    query: {
      enabled: statusContracts.length > 0,
    },
  });

  // Parse status data into a map
  const statusMap = useMemo(() => {
    const map = new Map<Hex, {
      isPending: boolean;
      isReady: boolean;
      isDone: boolean;
      timestamp: bigint;
    }>();

    if (!statusData || statusData.length === 0) return map;

    for (let i = 0; i < executedOperationIds.length; i++) {
      const operationId = executedOperationIds[i];
      const baseIdx = i * 4;

      const isPending = statusData[baseIdx]?.result as boolean | undefined;
      const isReady = statusData[baseIdx + 1]?.result as boolean | undefined;
      const isDone = statusData[baseIdx + 2]?.result as boolean | undefined;
      const timestamp = statusData[baseIdx + 3]?.result as bigint | undefined;

      if (isPending !== undefined && isReady !== undefined && isDone !== undefined) {
        map.set(operationId, {
          isPending: isPending ?? false,
          isReady: isReady ?? false,
          isDone: isDone ?? false,
          timestamp: timestamp ?? 0n,
        });
      }
    }

    return map;
  }, [statusData, executedOperationIds]);

  // Build final operations list
  const operations = useMemo(() => {
    const result: ScheduledOperation[] = [];

    // Add pending Safe transactions (awaiting signatures)
    for (const { tx, timelockCalldata, decoded } of pendingScheduleOps) {
      if (!decoded.operationId) continue;

      result.push({
        safeTxHash: tx.safeTxHash,
        nonce: tx.nonce,
        timelockCalldata,
        decoded,
        operationId: decoded.operationId,
        submissionDate: tx.submissionDate,
        safeStatus: 'pending',
        confirmations: tx.confirmations?.length ?? 0,
        confirmationsRequired: tx.confirmationsRequired,
      });
    }

    // Add executed Safe transactions (in timelock or ready)
    for (const { tx, timelockCalldata, decoded } of executedScheduleOps) {
      if (!decoded.operationId) continue;

      const status = statusMap.get(decoded.operationId);

      // Skip if already executed on timelock
      if (status?.isDone) continue;

      result.push({
        safeTxHash: tx.safeTxHash,
        nonce: tx.nonce,
        timelockCalldata,
        decoded,
        operationId: decoded.operationId,
        submissionDate: tx.submissionDate,
        safeStatus: 'executed',
        confirmations: tx.confirmations?.length ?? 0,
        confirmationsRequired: tx.confirmationsRequired,
        timelockStatus: status,
      });
    }

    // Sort: Ready first, then pending timelock, then pending signatures
    result.sort((a, b) => {
      // Ready operations first
      if (a.timelockStatus?.isReady && !b.timelockStatus?.isReady) return -1;
      if (!a.timelockStatus?.isReady && b.timelockStatus?.isReady) return 1;

      // Then pending timelock (executed but waiting)
      if (a.safeStatus === 'executed' && b.safeStatus === 'pending') return -1;
      if (a.safeStatus === 'pending' && b.safeStatus === 'executed') return 1;

      // Then by date (newest first)
      return new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime();
    });

    return result;
  }, [pendingScheduleOps, executedScheduleOps, statusMap]);

  return {
    operations,
    isLoading: pendingLoading || executedLoading || statusLoading,
    error: pendingError || executedError,
  };
}
