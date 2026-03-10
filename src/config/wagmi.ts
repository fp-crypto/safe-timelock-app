import { http, fallback, createConfig } from 'wagmi';
import { mainnet, sepolia, arbitrum, optimism, polygon, base, gnosis } from 'wagmi/chains';
import { safe, injected, walletConnect } from 'wagmi/connectors';
import type { Chain } from 'viem';

// WalletConnect Project ID - users should replace with their own
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

if (WALLETCONNECT_PROJECT_ID === 'YOUR_PROJECT_ID') {
  console.warn(
    '[WalletConnect] No project ID configured. Set VITE_WALLETCONNECT_PROJECT_ID for WalletConnect support.'
  );
}

// Supported chains
export const chains = [mainnet, sepolia, arbitrum, optimism, polygon, base, gnosis] as const;
type SupportedChain = typeof chains[number];

const RPC_ENV_KEYS: Record<SupportedChain['id'], keyof ImportMetaEnv> = {
  [mainnet.id]: 'VITE_RPC_URL_MAINNET',
  [sepolia.id]: 'VITE_RPC_URL_SEPOLIA',
  [arbitrum.id]: 'VITE_RPC_URL_ARBITRUM',
  [optimism.id]: 'VITE_RPC_URL_OPTIMISM',
  [polygon.id]: 'VITE_RPC_URL_POLYGON',
  [base.id]: 'VITE_RPC_URL_BASE',
  [gnosis.id]: 'VITE_RPC_URL_GNOSIS',
};

function parseRpcUrlList(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

function getRpcUrls(chain: SupportedChain): string[] {
  const envUrls = parseRpcUrlList(import.meta.env[RPC_ENV_KEYS[chain.id]]);
  const defaultUrls = chain.rpcUrls.default.http;

  return [...new Set([...envUrls, ...defaultUrls])];
}

const HTTP_OPTS = { retryCount: 1, retryDelay: 250, timeout: 10_000 } as const;

function createChainTransport(chain: SupportedChain) {
  const urls = getRpcUrls(chain);
  const transports = urls.map((url) => http(url, HTTP_OPTS));

  if (transports.length === 1) {
    return transports[0];
  }

  return fallback(transports, { rank: true, retryCount: 1, retryDelay: 250 });
}

function createTransportsConfig(supportedChains: readonly SupportedChain[]) {
  return Object.fromEntries(
    supportedChains.map((chain) => [chain.id, createChainTransport(chain)])
  ) as Record<Chain['id'], ReturnType<typeof createChainTransport>>;
}

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
  transports: createTransportsConfig(chains),
});

// Declare types for wagmi
declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
