import { useState, useCallback, useEffect, useMemo } from 'react';
import { type Address, isAddress } from 'viem';
import { useAccount } from 'wagmi';
import { useAutoConnect, useIsSafeApp } from './hooks/useAutoConnect';
import {
  useUrlState,
  getSupportedChainId,
  type Operation as UrlOperation,
} from './hooks/useUrlState';
import { InputField } from './components/ui';
import { WalletConnection } from './components/WalletConnection';
import {
  ScheduleTab,
  ExecuteTab,
  DecodeTab,
  HashTab,
  CancelTab,
} from './tabs';
import { ApiKeysConfig } from './components/ApiKeysConfig';

const TIMELOCK_ADDRESS_KEY = 'safe-timelock-address';
const SAFE_ADDRESS_KEY = 'safe-address';

export function App() {
  // Get localStorage values for fallback
  const localStorageTimelock = typeof window !== 'undefined'
    ? localStorage.getItem(TIMELOCK_ADDRESS_KEY) || ''
    : '';
  const localStorageSafe = typeof window !== 'undefined'
    ? localStorage.getItem(SAFE_ADDRESS_KEY) || ''
    : '';

  // URL state management
  const { initialState, updateUrl, clearTabState, getCurrentShareableUrl } = useUrlState(localStorageTimelock, localStorageSafe);

  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [timelockAddress, setTimelockAddress] = useState(initialState.timelock);
  const [safeAddressInput, setSafeAddressInput] = useState(initialState.safe);

  // Auto-connect to Safe if in iframe
  useAutoConnect();

  // Detect if connected as Safe and get connected address
  const { address: connectedAddress, chainId: connectedChainId, isConnected } = useAccount();
  const isSafeApp = useIsSafeApp();
  const requestedChainId = getSupportedChainId(initialState.chainId);
  const effectiveChainId = requestedChainId ?? (isConnected ? connectedChainId : undefined);

  // Compute effective Safe address: input overrides, otherwise use connected Safe
  const effectiveSafeAddress = useMemo(() => {
    if (safeAddressInput && isAddress(safeAddressInput)) {
      return safeAddressInput as Address;
    }
    if (isSafeApp && connectedAddress) {
      return connectedAddress;
    }
    return undefined;
  }, [safeAddressInput, isSafeApp, connectedAddress]);

  // Persist timelock address to localStorage and URL
  useEffect(() => {
    if (timelockAddress) {
      localStorage.setItem(TIMELOCK_ADDRESS_KEY, timelockAddress);
    }
    updateUrl({ timelock: timelockAddress });
  }, [timelockAddress, updateUrl]);

  // Persist safe address to localStorage and URL
  useEffect(() => {
    if (safeAddressInput) {
      localStorage.setItem(SAFE_ADDRESS_KEY, safeAddressInput);
    } else {
      localStorage.removeItem(SAFE_ADDRESS_KEY);
    }
    updateUrl({ safe: safeAddressInput });
  }, [safeAddressInput, updateUrl]);

  // Update URL when tab changes
  useEffect(() => {
    updateUrl({ tab: activeTab });
  }, [activeTab, updateUrl]);

  useEffect(() => {
    updateUrl({ chainId: effectiveChainId ? String(effectiveChainId) : '' });
  }, [effectiveChainId, updateUrl]);

  const tabs = [
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'execute', label: 'Execute', icon: '▶️' },
    { id: 'decode', label: 'Decode', icon: '🔍' },
    { id: 'hash', label: 'Hash', icon: '#️⃣' },
    { id: 'cancel', label: 'Cancel', icon: '🚫' },
  ];

  const validTimelockAddress = isAddress(timelockAddress) ? (timelockAddress as Address) : undefined;

  // Callbacks to update URL from tabs
  const handleScheduleUpdate = useCallback((ops: UrlOperation[], delay: string) => {
    updateUrl({ ops, delay });
  }, [updateUrl]);

  const handleExecuteUpdate = useCallback((ops: UrlOperation[]) => {
    updateUrl({ ops });
  }, [updateUrl]);

  const handleDecodeUpdate = useCallback((calldata: string, decode: boolean) => {
    updateUrl({ calldata, decode });
  }, [updateUrl]);

  const handleHashUpdate = useCallback((target: string, value: string, data: string) => {
    updateUrl({ target, value, data });
  }, [updateUrl]);

  const handleCancelUpdate = useCallback((opId: string) => {
    updateUrl({ opId });
  }, [updateUrl]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>
            <span className="safe-green">Safe</span> +{' '}
            <span className="oz-orange">OZ Timelock</span>
          </h1>
          <p>Create and manage TimelockController transactions for Safe multisigs</p>
        </div>
        <WalletConnection />
      </header>

      <main className="app-main">
        <div className="config-section">
          <InputField
            label="Timelock Contract Address"
            value={timelockAddress}
            onChange={setTimelockAddress}
            placeholder="0x..."
            mono
            helper="The TimelockController contract owned by your Safe"
          />
          <InputField
            label="Safe Address"
            value={safeAddressInput}
            onChange={setSafeAddressInput}
            placeholder={isSafeApp && connectedAddress ? connectedAddress : '0x...'}
            mono
            helper={isSafeApp && connectedAddress && !safeAddressInput
              ? `Using connected Safe (${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)})`
              : 'The Safe multisig that owns the timelock (optional if connected as Safe)'}
          />
        </div>

        <nav className="tab-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="tab-panel">
          {activeTab === 'schedule' && (
            <ScheduleTab
              chainId={effectiveChainId}
              timelockAddress={validTimelockAddress}
              initialOps={initialState.ops}
              initialDelay={initialState.delay}
              onUpdate={handleScheduleUpdate}
              onClear={clearTabState}
              getShareableUrl={getCurrentShareableUrl}
              isSafeApp={isSafeApp}
            />
          )}
          {activeTab === 'execute' && (
            <ExecuteTab
              chainId={effectiveChainId}
              initialChainId={initialState.chainId}
              timelockAddress={validTimelockAddress}
              safeAddress={effectiveSafeAddress}
              initialOps={initialState.ops}
              initialOpId={initialState.opId}
              onUpdate={handleExecuteUpdate}
              onClear={clearTabState}
              getShareableUrl={getCurrentShareableUrl}
              isSafeApp={isSafeApp}
            />
          )}
          {activeTab === 'decode' && (
            <DecodeTab
              initialCalldata={initialState.calldata}
              initialDecode={initialState.decode}
              onUpdate={handleDecodeUpdate}
              timelockAddress={timelockAddress}
              safeAddress={effectiveSafeAddress}
              onClear={clearTabState}
              getShareableUrl={getCurrentShareableUrl}
            />
          )}
          {activeTab === 'hash' && (
            <HashTab
              chainId={effectiveChainId}
              timelockAddress={validTimelockAddress}
              safeAddress={effectiveSafeAddress}
              initialTarget={initialState.target}
              initialValue={initialState.value}
              initialData={initialState.data}
              onUpdate={handleHashUpdate}
              onClear={clearTabState}
              getShareableUrl={getCurrentShareableUrl}
            />
          )}
          {activeTab === 'cancel' && (
            <CancelTab
              chainId={effectiveChainId}
              timelockAddress={validTimelockAddress}
              safeAddress={effectiveSafeAddress}
              initialOpId={initialState.opId}
              onUpdate={handleCancelUpdate}
              onClear={clearTabState}
              getShareableUrl={getCurrentShareableUrl}
              isSafeApp={isSafeApp}
            />
          )}
        </div>
      </main>

      <ApiKeysConfig />

      <footer className="app-footer">
        <div className="workflow-hint">
          <strong>Workflow:</strong> Schedule → Wait for delay → Execute
        </div>
        <p>
          Copy the generated calldata and create a Safe transaction with your Timelock as the target.
        </p>
      </footer>
    </div>
  );
}

export default App;
