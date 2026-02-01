/**
 * Wallet Tracker - Track wallet activity across chains
 */

export interface WalletConfig {
  address: string;
  chain: ChainId;
  label?: string;
}

export type ChainId = 'ethereum' | 'bsc' | 'polygon' | 'arbitrum' | 'base' | 'solana' | string;

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  token?: TokenInfo;
  timestamp: number;
  type: 'in' | 'out' | 'swap' | 'approval';
  status: 'pending' | 'confirmed' | 'failed';
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name?: string;
  decimals: number;
}

export interface WalletBalance {
  native: string;
  tokens: TokenBalance[];
}

export interface TokenBalance {
  token: TokenInfo;
  balance: string;
  valueUsd?: number;
}

export interface WalletActivity {
  wallet: WalletConfig;
  transactions: Transaction[];
  balance: WalletBalance;
  lastUpdated: number;
}

export interface TrackerOptions {
  pollInterval?: number;
  onTransaction?: (tx: Transaction) => void;
  onBalanceChange?: (balance: WalletBalance) => void;
}

/**
 * Wallet Tracker Class
 */
export class WalletTracker {
  private wallets: Map<string, WalletConfig> = new Map();
  private activities: Map<string, WalletActivity> = new Map();
  private options: TrackerOptions;
  private pollTimer?: NodeJS.Timer;

  constructor(options: TrackerOptions = {}) {
    this.options = {
      pollInterval: 30000,
      ...options,
    };
  }

  /**
   * Add wallet to track
   */
  addWallet(config: WalletConfig): void {
    const key = `${config.chain}:${config.address}`;
    this.wallets.set(key, config);
  }

  /**
   * Remove wallet from tracking
   */
  removeWallet(chain: ChainId, address: string): void {
    const key = `${chain}:${address}`;
    this.wallets.delete(key);
    this.activities.delete(key);
  }

  /**
   * Get all tracked wallets
   */
  getWallets(): WalletConfig[] {
    return Array.from(this.wallets.values());
  }

  /**
   * Get activity for a specific wallet
   */
  getActivity(chain: ChainId, address: string): WalletActivity | undefined {
    const key = `${chain}:${address}`;
    return this.activities.get(key);
  }

  /**
   * Fetch wallet transactions (implement with your preferred API)
   */
  async fetchTransactions(wallet: WalletConfig): Promise<Transaction[]> {
    // Placeholder - implement with Etherscan, Alchemy, etc.
    console.log(`Fetching transactions for ${wallet.address} on ${wallet.chain}`);
    return [];
  }

  /**
   * Fetch wallet balance
   */
  async fetchBalance(wallet: WalletConfig): Promise<WalletBalance> {
    // Placeholder - implement with provider
    console.log(`Fetching balance for ${wallet.address} on ${wallet.chain}`);
    return { native: '0', tokens: [] };
  }

  /**
   * Update all tracked wallets
   */
  async update(): Promise<void> {
    for (const wallet of this.wallets.values()) {
      try {
        const transactions = await this.fetchTransactions(wallet);
        const balance = await this.fetchBalance(wallet);
        
        const key = `${wallet.chain}:${wallet.address}`;
        const prev = this.activities.get(key);
        
        this.activities.set(key, {
          wallet,
          transactions,
          balance,
          lastUpdated: Date.now(),
        });

        // Check for new transactions
        if (prev && this.options.onTransaction) {
          const newTxs = transactions.filter(
            tx => !prev.transactions.find(p => p.hash === tx.hash)
          );
          newTxs.forEach(tx => this.options.onTransaction!(tx));
        }

        // Check for balance changes
        if (prev && this.options.onBalanceChange) {
          if (prev.balance.native !== balance.native) {
            this.options.onBalanceChange(balance);
          }
        }
      } catch (error) {
        console.error(`Failed to update wallet ${wallet.address}:`, error);
      }
    }
  }

  /**
   * Start automatic polling
   */
  start(): void {
    this.update();
    this.pollTimer = setInterval(() => this.update(), this.options.pollInterval);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }
}

export default WalletTracker;
