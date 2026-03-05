import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address } from 'viem';
import { fetchExecutedTransactions } from './usePendingSafeTransactions';

vi.mock('../lib/api-keys', () => ({
  getApiKey: () => null,
}));

interface MockTx {
  safeTxHash: string;
  transactionHash: string | null;
  to: string;
  data: string;
  value: string;
  nonce: number;
  executionDate: string | null;
  submissionDate: string;
  confirmations: [];
  confirmationsRequired: number;
  isExecuted: boolean;
}

function tx(id: string, executionDate: string | null, submissionDate: string): MockTx {
  return {
    safeTxHash: `safe-${id}`,
    transactionHash: `0x${id}`,
    to: '0x0000000000000000000000000000000000000000',
    data: '0x',
    value: '0',
    nonce: 1,
    executionDate,
    submissionDate,
    confirmations: [],
    confirmationsRequired: 2,
    isExecuted: true,
  };
}

function makeResponse(results: MockTx[]) {
  return {
    count: results.length,
    results,
  };
}

describe('fetchExecutedTransactions', () => {
  const safeAddress = '0x1234567890123456789012345678901234567890' as Address;
  const chainId = 1;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('filters by executionDate and paginates until cutoff', async () => {
    const sinceDate = new Date('2026-01-01T00:00:00.000Z');

    const page1 = Array.from({ length: 200 }, (_, i) =>
      tx(
        `p1-${i}`,
        '2026-02-01T00:00:00.000Z',
        '2025-01-01T00:00:00.000Z'
      )
    );
    const page2 = [
      tx('keep', '2026-01-15T00:00:00.000Z', '2025-01-01T00:00:00.000Z'),
      tx('old', '2025-12-31T00:00:00.000Z', '2025-01-01T00:00:00.000Z'),
    ];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeResponse(page1)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(makeResponse(page2)), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const results = await fetchExecutedTransactions(safeAddress, chainId, sinceDate);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(201);
    expect(results.some((r) => r.safeTxHash === 'safe-old')).toBe(false);
    expect(results.some((r) => r.safeTxHash === 'safe-keep')).toBe(true);
  });

  it('falls back to submissionDate when executionDate is null', async () => {
    const sinceDate = new Date('2026-01-01T00:00:00.000Z');
    const page = [
      tx('keep-submission', null, '2026-01-10T00:00:00.000Z'),
      tx('drop-submission', null, '2025-12-20T00:00:00.000Z'),
    ];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeResponse(page)), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await fetchExecutedTransactions(safeAddress, chainId, sinceDate);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].safeTxHash).toBe('safe-keep-submission');
  });
});
