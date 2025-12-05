import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from 'wagmi';
import { useIsSafeApp } from '../hooks/useAutoConnect';
import { chains } from '../config/wagmi';

export function WalletConnection() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isSafeApp = useIsSafeApp();

  if (isConnected) {
    return (
      <div className="wallet-connected">
        <div className="wallet-info">
          <div className="wallet-badge">
            {isSafeApp && <span className="safe-badge">Safe App</span>}
            <span className="connector-name">{connector?.name}</span>
          </div>
          <div className="wallet-address">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
          <select
            value={chainId}
            onChange={(e) => switchChain?.({ chainId: Number(e.target.value) as typeof chains[number]['id'] })}
            className="chain-select"
          >
            {chains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>
        </div>
        {!isSafeApp && (
          <button onClick={() => disconnect()} className="btn btn-secondary">
            Disconnect
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <p className="connect-prompt">Connect your wallet to submit transactions</p>
      <div className="connector-buttons">
        {connectors
          .filter((c) => c.id !== 'safe') // Hide Safe connector in UI (auto-connects)
          .map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={isPending}
              className="btn btn-primary"
            >
              {connector.name}
            </button>
          ))}
      </div>
    </div>
  );
}
