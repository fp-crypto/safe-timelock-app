import { useQuery } from '@tanstack/react-query';
import type { Hex } from 'viem';

interface FourByteResult {
  id: number;
  text_signature: string;
  hex_signature: string;
  bytes_signature: string;
}

interface FourByteResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FourByteResult[];
}

/**
 * Fetch function signature from 4byte.directory API
 */
async function fetchSignature(selector: Hex): Promise<string | null> {
  const response = await fetch(
    `https://www.4byte.directory/api/v1/signatures/?hex_signature=${selector}`
  );

  if (!response.ok) {
    throw new Error('4byte.directory lookup failed');
  }

  const data: FourByteResponse = await response.json();

  // Return the most popular (first) result, or null if none found
  return data.results[0]?.text_signature ?? null;
}

/**
 * Hook to lookup function signature from 4byte.directory
 * Caches results for 24 hours
 */
export function use4ByteDirectory(selector: Hex | undefined | null) {
  return useQuery({
    queryKey: ['4byte', selector],
    queryFn: () => fetchSignature(selector!),
    enabled: !!selector && selector.length === 10,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
