import { useState, useCallback, useEffect } from 'react';
import { type Address, isAddress } from 'viem';
import { useAutoConnect } from './hooks/useAutoConnect';
import { useUrlState, type Operation as UrlOperation } from './hooks/useUrlState';
import { InputField } from './components/ui';
import { WalletConnection } from './components/WalletConnection';
import {
  ScheduleTab,
  ExecuteTab,
  DecodeTab,
  HashTab,
  CancelTab,
} from './tabs';

const TIMELOCK_ADDRESS_KEY = 'safe-timelock-address';

export function App() {
  // Get localStorage timelock for fallback
  const localStorageTimelock = typeof window !== 'undefined'
    ? localStorage.getItem(TIMELOCK_ADDRESS_KEY) || ''
    : '';

  // URL state management
  const { initialState, updateUrl, clearTabState } = useUrlState(localStorageTimelock);

  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [timelockAddress, setTimelockAddress] = useState(initialState.timelock);

  // Persist timelock address to localStorage and URL
  useEffect(() => {
    if (timelockAddress) {
      localStorage.setItem(TIMELOCK_ADDRESS_KEY, timelockAddress);
    }
    updateUrl({ timelock: timelockAddress });
  }, [timelockAddress, updateUrl]);

  // Update URL when tab changes
  useEffect(() => {
    updateUrl({ tab: activeTab });
  }, [activeTab, updateUrl]);

  // Auto-connect to Safe if in iframe
  useAutoConnect();

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
              timelockAddress={validTimelockAddress}
              initialOps={initialState.ops}
              initialDelay={initialState.delay}
              onUpdate={handleScheduleUpdate}
              onClear={clearTabState}
            />
          )}
          {activeTab === 'execute' && (
            <ExecuteTab
              timelockAddress={validTimelockAddress}
              initialOps={initialState.ops}
              onUpdate={handleExecuteUpdate}
              onClear={clearTabState}
            />
          )}
          {activeTab === 'decode' && (
            <DecodeTab
              initialCalldata={initialState.calldata}
              initialDecode={initialState.decode}
              onUpdate={handleDecodeUpdate}
              timelockAddress={timelockAddress}
              onClear={clearTabState}
            />
          )}
          {activeTab === 'hash' && (
            <HashTab
              timelockAddress={validTimelockAddress}
              initialTarget={initialState.target}
              initialValue={initialState.value}
              initialData={initialState.data}
              onUpdate={handleHashUpdate}
              onClear={clearTabState}
            />
          )}
          {activeTab === 'cancel' && (
            <CancelTab
              timelockAddress={validTimelockAddress}
              initialOpId={initialState.opId}
              onUpdate={handleCancelUpdate}
              onClear={clearTabState}
            />
          )}
        </div>
      </main>

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
