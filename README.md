# Safe + OpenZeppelin Timelock Tool

A web application to create, decode, and execute OpenZeppelin TimelockController transactions when the timelock is owned by a Safe multisig.

## Features

### Core Operations
- **Schedule Operations** - Encode `schedule()` and `scheduleBatch()` calls with automatic operation ID calculation
- **Execute Operations** - Encode `execute()` and `executeBatch()` calls after the delay period
- **Decode Calldata** - Inspect any timelock calldata to see what it does
- **Calculate Hashes** - Compute operation IDs to check status on-chain
- **Cancel Operations** - Encode `cancel()` calls for pending operations
- **Live Status** - Query the timelock contract for operation status (pending/ready/done)

### Smart Calldata Building
- **Sourcify Integration** - Automatically fetch verified contract ABIs from Sourcify
- **Proxy Detection** - Detects ERC1967 proxies and fetches implementation ABIs
- **Function Builder** - Visual interface to select functions and fill in parameters
- **Custom ABIs** - Store and manage your own contract ABIs for unverified contracts

### Enhanced Decoding
- **Multi-source Decoding** - Tries local selectors → custom ABIs → Sourcify → 4byte.directory
- **Decimal Format Tooltips** - Hover over large numbers to see WAD (1e18) and USDC (1e6) formats
- **Risk Indicators** - Visual warnings for high-risk operations
- **Parameter Inspection** - Click to expand full values, copy to clipboard

## How It Works

### Safe App Mode
When loaded inside the Safe wallet interface (app.safe.global), the tool automatically connects to your Safe. Transactions are proposed directly to your Safe for signing.

### Standalone Mode
When used outside of Safe, connect any wallet (MetaMask, WalletConnect, etc.). You can then:
1. Generate the encoded calldata
2. Copy it and create a Safe transaction manually
3. Or connect via WalletConnect to a Safe

## Workflow

```
1. Schedule   →   2. Wait for delay   →   3. Execute
   └─ Creates operation with delay       └─ Executes after delay passes
```

1. **Schedule**: Create a timelock operation with the target contract, calldata, and delay
2. **Wait**: The operation ID can be tracked - status goes from "pending" → "ready"
3. **Execute**: Once ready, execute the operation with the same parameters

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or pnpm/yarn)
- A WalletConnect Project ID (get one at [cloud.walletconnect.com](https://cloud.walletconnect.com))

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd safe-timelock-app

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Add your WalletConnect Project ID to .env
# VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Start development server
npm run dev
```

### Building

```bash
npm run build    # TypeScript check + production build
npm run preview  # Preview production build locally
```

### Deploying as a Safe App

1. Build the app: `npm run build`

2. Deploy the `dist` folder to a hosting service (Vercel, Netlify, IPFS, etc.)

3. Make sure CORS headers are set:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET
   Access-Control-Allow-Headers: X-Requested-With, content-type, Authorization
   ```

4. In your Safe wallet:
   - Go to Apps → Add custom app
   - Enter your deployed URL
   - The app will load in the Safe interface

## Tech Stack

- **React 18** - UI framework
- **viem** - Ethereum library for encoding/decoding
- **wagmi v2** - React hooks for Ethereum
- **@tanstack/react-query** - Data fetching and caching
- **TypeScript** - Type safety
- **Vite** - Build tool

## Project Structure

```
src/
├── components/
│   ├── AbiManager.tsx       # Custom ABI storage UI
│   ├── CalldataBuilder.tsx  # Sourcify-powered calldata builder
│   ├── DecodedCalldata.tsx  # Calldata decoder with risk levels
│   └── DecimalTooltip.tsx   # Number format tooltip
├── config/
│   └── wagmi.ts             # Wagmi config with Safe connector
├── hooks/
│   ├── useAutoConnect.ts    # Auto-connect in Safe iframe
│   ├── useDecodeCalldata.ts # Multi-source calldata decoder
│   ├── useProxyDetection.ts # ERC1967 proxy detection
│   ├── useSourcifyAbi.ts    # Sourcify API integration
│   └── useTimelockStatus.ts # Timelock operation status
├── lib/
│   ├── abi-storage.ts       # localStorage ABI management
│   ├── format-decimals.ts   # Decimal format utilities
│   ├── selectors.ts         # Known function selectors
│   └── timelock.ts          # Timelock encoding/decoding
├── App.tsx                  # Main application
└── index.css                # Styles
```

## OpenZeppelin Timelock

This tool is designed for [OpenZeppelin's TimelockController](https://docs.openzeppelin.com/contracts/4.x/api/governance#TimelockController) contract. Key concepts:

- **Operation ID**: A keccak256 hash of (target, value, data, predecessor, salt)
- **Predecessor**: An operation that must execute before this one (use 0x00...00 for none)
- **Salt**: Unique value to differentiate otherwise identical operations
- **Delay**: Minimum time that must pass between scheduling and execution

## Supported Networks

- Ethereum Mainnet
- Sepolia Testnet
- Arbitrum One
- Optimism
- Polygon
- Base
- Gnosis Chain

Add more chains in `src/config/wagmi.ts`.

## Security Notes

- This tool only encodes/decodes calldata - it doesn't execute transactions directly
- Always verify the decoded calldata before signing
- The tool queries public RPC endpoints and Sourcify for contract data
- No private keys or sensitive data are stored
- Custom ABIs are stored in browser localStorage only

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or PR.
