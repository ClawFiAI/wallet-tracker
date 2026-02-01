# Wallet Tracker

[![npm version](https://badge.fury.io/js/wallet-tracker.svg)](https://www.npmjs.com/package/wallet-tracker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Track wallet activity and transactions across multiple blockchains.

## Features

- 🔍 Multi-chain wallet tracking
- 📊 Real-time balance monitoring
- 📝 Transaction history
- 🔔 Activity callbacks
- ⚡ Automatic polling

## Installation

```bash
npm install wallet-tracker
```

## Quick Start

```typescript
import { WalletTracker } from 'wallet-tracker';

const tracker = new WalletTracker({
  pollInterval: 30000,
  onTransaction: (tx) => {
    console.log('New transaction:', tx.hash);
  },
  onBalanceChange: (balance) => {
    console.log('Balance changed:', balance.native);
  },
});

// Add wallets to track
tracker.addWallet({
  address: '0x...',
  chain: 'ethereum',
  label: 'Main Wallet',
});

tracker.addWallet({
  address: '...',
  chain: 'solana',
  label: 'Solana Wallet',
});

// Start tracking
tracker.start();

// Get activity
const activity = tracker.getActivity('ethereum', '0x...');
console.log('Transactions:', activity?.transactions.length);

// Stop tracking
tracker.stop();
```

## API

### `WalletTracker`

```typescript
const tracker = new WalletTracker({
  pollInterval: 30000,        // Polling interval in ms
  onTransaction: (tx) => {},  // New transaction callback
  onBalanceChange: (b) => {}, // Balance change callback
});
```

### Methods

| Method | Description |
|--------|-------------|
| `addWallet(config)` | Add wallet to track |
| `removeWallet(chain, address)` | Remove wallet |
| `getWallets()` | Get all tracked wallets |
| `getActivity(chain, address)` | Get wallet activity |
| `update()` | Manual update |
| `start()` | Start auto-polling |
| `stop()` | Stop polling |

## Supported Chains

- Ethereum
- BSC
- Polygon
- Arbitrum
- Base
- Solana
- Custom chains

## Types

```typescript
interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  token?: TokenInfo;
  timestamp: number;
  type: 'in' | 'out' | 'swap' | 'approval';
  status: 'pending' | 'confirmed' | 'failed';
}

interface WalletBalance {
  native: string;
  tokens: TokenBalance[];
}
```

## License

MIT © [ClawFi](https://github.com/ClawFiAI)
