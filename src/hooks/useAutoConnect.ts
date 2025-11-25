import { useEffect } from 'react';
import { useConnect, useAccount, Connector } from 'wagmi';

/**
 * Auto-connects to Safe if the app is loaded inside a Safe App iframe.
 * This hook should be called once at the app root level.
 */
export function useAutoConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    // Don't auto-connect if already connected
    if (isConnected) return;

    // Find the Safe connector
    const safeConnector = connectors.find(
      (connector: Connector) => connector.id === 'safe' && connector.ready
    );

    // Auto-connect to Safe if available (means we're in Safe iframe)
    if (safeConnector) {
      connect({ connector: safeConnector });
    }
  }, [connect, connectors, isConnected]);
}

/**
 * Hook to detect if we're running inside a Safe App iframe
 */
export function useIsSafeApp(): boolean {
  const { connector } = useAccount();
  return connector?.id === 'safe';
}
