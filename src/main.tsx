import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { config } from './config/wagmi';
import { App } from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 24 hours in garbage collection
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

// Persist query cache to localStorage for cross-tab sharing
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'safe-timelock-cache',
  // Only persist Safe API queries (not wagmi queries which have their own caching)
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          // Only persist Safe-related queries
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              const key = query.queryKey[0];
              return typeof key === 'string' && (
                key === 'safeInfo' ||
                key === 'pendingSafeTransactions' ||
                key === 'executedSafeTransactions'
              );
            },
          },
        }}
      >
        <App />
      </PersistQueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
