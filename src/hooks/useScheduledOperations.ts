import { useMemo, useCallback } from 'react';
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
import {
  deriveTimelockStatusFromTimestamp,
  isDisplayableScheduledStatus,
  type TimelockOperationStatus,
} from '../lib/timelock-status';

// Cache durations
const EXECUTED_TX_STALE_TIME = 10 * 60 * 1000; // 10 minutes
const EXECUTED_TX_GC_TIME = 30 * 60 * 1000; // 30 minutes

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
  timelockStatus?: TimelockOperationStatus;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_HUNDRED_EIGHTY_DAYS_MS = 180 * 24 * 60 * 60 * 1000;

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
    refetch: refetchPending,
  } = usePendingSafeTransactions(safeAddress, chainId);

  // Calculate lookback date based on minDelay
  const sinceDate = useMemo(() => {
    if (minDelay !== undefined) {
      // Keep at least 6 months of history so long-lived ready ops still appear.
      const lookbackMs = Math.max(Number(minDelay) * 1000 + THIRTY_DAYS_MS, ONE_HUNDRED_EIGHTY_DAYS_MS);
      return new Date(Date.now() - lookbackMs);
    }
    // Default to 6 months if minDelay not available
    return new Date(Date.now() - ONE_HUNDRED_EIGHTY_DAYS_MS);
  }, [minDelay]);

  // Fetch executed Safe transactions
  const {
    data: executedTxs,
    isLoading: executedLoading,
    error: executedError,
    refetch: refetchExecuted,
  } = useQuery({
    queryKey: ['executedSafeTransactions', safeAddress, chainId, sinceDate.getTime()],
    queryFn: () => fetchExecutedTransactions(safeAddress!, chainId!, sinceDate),
    enabled: !!safeAddress && !!chainId && !!SAFE_TX_SERVICE_SHORTNAMES[chainId],
    staleTime: EXECUTED_TX_STALE_TIME,
    gcTime: EXECUTED_TX_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429')) return false;
      return failureCount < 2;
    },
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

  // Batch query on-chain timestamps for executed operations
  const statusContracts = useMemo(() => {
    if (!timelockAddress || executedOperationIds.length === 0) return [];

    const contracts: Array<{
      address: Address;
      abi: typeof TIMELOCK_ABI;
      functionName: string;
      args: [Hex];
    }> = [];

    for (const operationId of executedOperationIds) {
      contracts.push({
        address: timelockAddress,
        abi: TIMELOCK_ABI,
        functionName: 'getTimestamp',
        args: [operationId],
      });
    }

    return contracts;
  }, [timelockAddress, executedOperationIds]);

  const { data: statusData, isLoading: statusLoading } = useReadContracts({
    contracts: statusContracts,
    batchSize: 1024,
    query: {
      enabled: statusContracts.length > 0,
      refetchOnWindowFocus: false,
    },
  });

  // Parse status data into a map
  const statusMap = useMemo(() => {
    const map = new Map<Hex, TimelockOperationStatus>();

    if (!statusData || statusData.length === 0) return map;
    const now = BigInt(Math.floor(Date.now() / 1000));

    for (let i = 0; i < executedOperationIds.length; i++) {
      const operationId = executedOperationIds[i];
      const entry = statusData[i];
      if (!entry || entry.status === 'failure') continue;

      const timestamp = entry.result;
      if (typeof timestamp !== 'bigint') continue;

      map.set(operationId, deriveTimelockStatusFromTimestamp(timestamp, now));
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
      // Fail closed for executed txs: include only when on-chain status confirms pending/ready.
      if (!isDisplayableScheduledStatus(status)) continue;

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

  // Combined refetch for all data
  const refetch = useCallback(() => {
    refetchPending();
    refetchExecuted();
  }, [refetchPending, refetchExecuted]);

  return {
    operations,
    isLoading: pendingLoading || executedLoading || statusLoading,
    error: pendingError || executedError,
    refetch,
  };
}
