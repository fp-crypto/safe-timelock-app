import { http, createConfig } from 'wagmi';
import { mainnet, sepolia, arbitrum, optimism, polygon, base, gnosis } from 'wagmi/chains';
import { safe, injected, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID - users should replace with their own
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

if (WALLETCONNECT_PROJECT_ID === 'YOUR_PROJECT_ID') {
  console.warn(
    '[WalletConnect] No project ID configured. Set VITE_WALLETCONNECT_PROJECT_ID for WalletConnect support.'
  );
}

// Supported chains
export const chains = [mainnet, sepolia, arbitrum, optimism, polygon, base, gnosis] as const;

// Create wagmi config
export const config = createConfig({
  chains,
  connectors: [
    // Safe connector - auto-connects when running inside Safe App iframe
    safe({
      allowedDomains: [/app\.safe\.global$/, /safe\.global$/],
      debug: false,
    }),
    // Injected wallets (MetaMask, etc.)
    injected({
      shimDisconnect: true,
    }),
    // WalletConnect - works with Safe mobile app and many other wallets
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'Safe Timelock Tool',
        description: 'Create and manage OpenZeppelin Timelock transactions for Safe multisigs',
        url: typeof window !== 'undefined' ? window.location.origin : '',
        icons: ['https://safe.global/images/safe-logo-green.png'],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [base.id]: http(),
    [gnosis.id]: http(),
  },
});

// Declare types for wagmi
declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
