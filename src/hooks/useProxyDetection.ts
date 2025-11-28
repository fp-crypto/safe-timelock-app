import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import type { Address, Hex } from 'viem';

// ERC1967 storage slots
// Implementation: keccak256("eip1967.proxy.implementation") - 1
const ERC1967_IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as Hex;

// Beacon: keccak256("eip1967.proxy.beacon") - 1
const ERC1967_BEACON_SLOT =
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50' as Hex;

// Zero value to compare against
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

export interface ProxyInfo {
  isProxy: boolean;
  implementationAddress: Address | null;
  proxyType: 'erc1967' | 'beacon' | null;
}

/**
 * Extract address from storage slot value (last 20 bytes)
 */
function extractAddress(slot: Hex): Address | null {
  if (!slot || slot === ZERO_BYTES32) return null;
  // Address is in the last 20 bytes (40 hex chars)
  const addressHex = '0x' + slot.slice(-40);
  // Validate it's not zero address
  if (addressHex === '0x0000000000000000000000000000000000000000') return null;
  return addressHex as Address;
}

/**
 * Fetch proxy info for an address
 */
async function fetchProxyInfo(
  client: ReturnType<typeof usePublicClient>,
  address: Address
): Promise<ProxyInfo> {
  try {
    // Read ERC1967 implementation slot
    const implSlot = await client.getStorageAt({
      address,
      slot: ERC1967_IMPLEMENTATION_SLOT,
    });

    const implAddress = extractAddress(implSlot || (ZERO_BYTES32 as Hex));
    if (implAddress) {
      return {
        isProxy: true,
        implementationAddress: implAddress,
        proxyType: 'erc1967',
      };
    }

    // Check beacon slot
    const beaconSlot = await client.getStorageAt({
      address,
      slot: ERC1967_BEACON_SLOT,
    });

    const beaconAddress = extractAddress(beaconSlot || (ZERO_BYTES32 as Hex));
    if (beaconAddress) {
      // For beacon proxies, we'd need to call implementation() on the beacon
      // For simplicity, just return the beacon address and note it's a beacon
      return {
        isProxy: true,
        implementationAddress: beaconAddress,
        proxyType: 'beacon',
      };
    }

    return {
      isProxy: false,
      implementationAddress: null,
      proxyType: null,
    };
  } catch {
    // If we can't read storage, assume not a proxy
    return {
      isProxy: false,
      implementationAddress: null,
      proxyType: null,
    };
  }
}

/**
 * Hook to detect if an address is an ERC1967 proxy
 * and retrieve its implementation address
 */
export function useProxyDetection(address: Address | undefined) {
  const client = usePublicClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['proxy-detection', address, client?.chain?.id],
    queryFn: () => {
      if (!client || !address) {
        return { isProxy: false, implementationAddress: null, proxyType: null };
      }
      return fetchProxyInfo(client, address);
    },
    enabled: !!address && !!client,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    isProxy: data?.isProxy ?? false,
    implementationAddress: data?.implementationAddress ?? null,
    proxyType: data?.proxyType ?? null,
    isLoading,
    error: error?.message ?? null,
  };
}
