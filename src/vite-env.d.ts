/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_RPC_URL_MAINNET?: string;
  readonly VITE_RPC_URL_SEPOLIA?: string;
  readonly VITE_RPC_URL_ARBITRUM?: string;
  readonly VITE_RPC_URL_OPTIMISM?: string;
  readonly VITE_RPC_URL_POLYGON?: string;
  readonly VITE_RPC_URL_BASE?: string;
  readonly VITE_RPC_URL_GNOSIS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
