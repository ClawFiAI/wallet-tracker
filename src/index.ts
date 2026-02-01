/**
 * Wallet Tracker - Track wallet activity across chains
 * Real implementation with Etherscan, BSCScan, Solscan APIs
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
  valueUsd?: number;
  token?: TokenInfo;
  timestamp: number;
  type: 'in' | 'out' | 'swap' | 'approval' | 'contract';
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name?: string;
  decimals: number;
}

export interface WalletBalance {
  native: string;
  nativeUsd?: number;
  tokens: TokenBalance[];
  totalUsd?: number;
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
  etherscanApiKey?: string;
  bscscanApiKey?: string;
  polygonscanApiKey?: string;
  arbiscanApiKey?: string;
  basescanApiKey?: string;
  onTransaction?: (tx: Transaction, wallet: WalletConfig) => void;
  onBalanceChange?: (balance: WalletBalance, wallet: WalletConfig) => void;
  onError?: (error: Error, wallet: WalletConfig) => void;
}

// Explorer API endpoints
const EXPLORER_APIS: Record<string, { api: string; apiKeyParam: string }> = {
  ethereum: { api: 'https://api.etherscan.io/api', apiKeyParam: 'apikey' },
  bsc: { api: 'https://api.bscscan.com/api', apiKeyParam: 'apikey' },
  polygon: { api: 'https://api.polygonscan.com/api', apiKeyParam: 'apikey' },
  arbitrum: { api: 'https://api.arbiscan.io/api', apiKeyParam: 'apikey' },
  base: { api: 'https://api.basescan.org/api', apiKeyParam: 'apikey' },
};

// Solana API
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const SOLSCAN_API = 'https://public-api.solscan.io';

/**
 * Wallet Tracker Class - Real Implementation
 */
export class WalletTracker {
  private wallets: Map<string, WalletConfig> = new Map();
  private activities: Map<string, WalletActivity> = new Map();
  private options: TrackerOptions;
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor(options: TrackerOptions = {}) {
    this.options = {
      pollInterval: 30000,
      ...options,
    };
  }

  /**
   * Get API key for chain
   */
  private getApiKey(chain: ChainId): string | undefined {
    const keyMap: Record<string, string | undefined> = {
      ethereum: this.options.etherscanApiKey,
      bsc: this.options.bscscanApiKey,
      polygon: this.options.polygonscanApiKey,
      arbitrum: this.options.arbiscanApiKey,
      base: this.options.basescanApiKey,
    };
    return keyMap[chain];
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
   * Fetch EVM wallet transactions from block explorer
   */
  private async fetchEvmTransactions(wallet: WalletConfig): Promise<Transaction[]> {
    const explorer = EXPLORER_APIS[wallet.chain];
    if (!explorer) {
      console.warn(`No explorer API for chain: ${wallet.chain}`);
      return [];
    }

    const apiKey = this.getApiKey(wallet.chain);
    const params = new URLSearchParams({
      module: 'account',
      action: 'txlist',
      address: wallet.address,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: '50',
      sort: 'desc',
    });

    if (apiKey) {
      params.append(explorer.apiKeyParam, apiKey);
    }

    try {
      const response = await fetch(`${explorer.api}?${params}`);
      const data = await response.json();

      if (data.status !== '1' || !Array.isArray(data.result)) {
        return [];
      }

      return data.result.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from.toLowerCase(),
        to: tx.to?.toLowerCase() || '',
        value: tx.value,
        timestamp: parseInt(tx.timeStamp) * 1000,
        type: this.getTransactionType(tx, wallet.address),
        status: tx.isError === '0' ? 'confirmed' : 'failed',
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        blockNumber: parseInt(tx.blockNumber),
      }));
    } catch (error) {
      console.error(`Failed to fetch transactions for ${wallet.address}:`, error);
      return [];
    }
  }

  /**
   * Fetch EVM token transfers
   */
  private async fetchEvmTokenTransfers(wallet: WalletConfig): Promise<Transaction[]> {
    const explorer = EXPLORER_APIS[wallet.chain];
    if (!explorer) return [];

    const apiKey = this.getApiKey(wallet.chain);
    const params = new URLSearchParams({
      module: 'account',
      action: 'tokentx',
      address: wallet.address,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: '50',
      sort: 'desc',
    });

    if (apiKey) {
      params.append(explorer.apiKeyParam, apiKey);
    }

    try {
      const response = await fetch(`${explorer.api}?${params}`);
      const data = await response.json();

      if (data.status !== '1' || !Array.isArray(data.result)) {
        return [];
      }

      return data.result.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from.toLowerCase(),
        to: tx.to?.toLowerCase() || '',
        value: tx.value,
        timestamp: parseInt(tx.timeStamp) * 1000,
        type: this.getTransactionType(tx, wallet.address),
        status: 'confirmed',
        token: {
          address: tx.contractAddress,
          symbol: tx.tokenSymbol,
          name: tx.tokenName,
          decimals: parseInt(tx.tokenDecimal),
        },
        blockNumber: parseInt(tx.blockNumber),
      }));
    } catch (error) {
      console.error(`Failed to fetch token transfers:`, error);
      return [];
    }
  }

  /**
   * Fetch Solana transactions
   */
  private async fetchSolanaTransactions(wallet: WalletConfig): Promise<Transaction[]> {
    try {
      // Use Solscan public API
      const response = await fetch(
        `${SOLSCAN_API}/account/transactions?account=${wallet.address}&limit=50`
      );
      const data = await response.json();

      if (!Array.isArray(data)) return [];

      return data.map((tx: any) => ({
        hash: tx.txHash,
        from: tx.signer?.[0] || '',
        to: '',
        value: (tx.lamport || 0).toString(),
        timestamp: (tx.blockTime || 0) * 1000,
        type: 'contract' as const,
        status: tx.status === 'Success' ? 'confirmed' : 'failed',
        blockNumber: tx.slot,
      }));
    } catch (error) {
      console.error(`Failed to fetch Solana transactions:`, error);
      return [];
    }
  }

  /**
   * Fetch EVM wallet balance
   */
  private async fetchEvmBalance(wallet: WalletConfig): Promise<WalletBalance> {
    const explorer = EXPLORER_APIS[wallet.chain];
    if (!explorer) {
      return { native: '0', tokens: [] };
    }

    const apiKey = this.getApiKey(wallet.chain);
    
    // Fetch native balance
    const balanceParams = new URLSearchParams({
      module: 'account',
      action: 'balance',
      address: wallet.address,
      tag: 'latest',
    });
    if (apiKey) balanceParams.append(explorer.apiKeyParam, apiKey);

    // Fetch token balances
    const tokenParams = new URLSearchParams({
      module: 'account',
      action: 'tokenlist',
      address: wallet.address,
    });
    if (apiKey) tokenParams.append(explorer.apiKeyParam, apiKey);

    try {
      const [balanceRes, tokenRes] = await Promise.all([
        fetch(`${explorer.api}?${balanceParams}`),
        fetch(`${explorer.api}?${tokenParams}`),
      ]);

      const balanceData = await balanceRes.json();
      const tokenData = await tokenRes.json();

      const native = balanceData.status === '1' ? balanceData.result : '0';
      
      const tokens: TokenBalance[] = [];
      if (tokenData.status === '1' && Array.isArray(tokenData.result)) {
        for (const t of tokenData.result) {
          if (t.balance && t.balance !== '0') {
            tokens.push({
              token: {
                address: t.contractAddress,
                symbol: t.symbol,
                name: t.name,
                decimals: parseInt(t.decimals) || 18,
              },
              balance: t.balance,
            });
          }
        }
      }

      return { native, tokens };
    } catch (error) {
      console.error(`Failed to fetch balance:`, error);
      return { native: '0', tokens: [] };
    }
  }

  /**
   * Fetch Solana balance
   */
  private async fetchSolanaBalance(wallet: WalletConfig): Promise<WalletBalance> {
    try {
      // Get SOL balance via RPC
      const response = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [wallet.address],
        }),
      });

      const data = await response.json();
      const lamports = data.result?.value || 0;

      // Get token accounts via Solscan
      const tokenResponse = await fetch(
        `${SOLSCAN_API}/account/tokens?account=${wallet.address}`
      );
      const tokenData = await tokenResponse.json();

      const tokens: TokenBalance[] = [];
      if (Array.isArray(tokenData)) {
        for (const t of tokenData) {
          if (t.tokenAmount?.uiAmount > 0) {
            tokens.push({
              token: {
                address: t.tokenAddress,
                symbol: t.tokenSymbol || 'Unknown',
                name: t.tokenName,
                decimals: t.tokenAmount?.decimals || 9,
              },
              balance: t.tokenAmount?.amount || '0',
            });
          }
        }
      }

      return { native: lamports.toString(), tokens };
    } catch (error) {
      console.error(`Failed to fetch Solana balance:`, error);
      return { native: '0', tokens: [] };
    }
  }

  /**
   * Determine transaction type
   */
  private getTransactionType(tx: any, walletAddress: string): Transaction['type'] {
    const addr = walletAddress.toLowerCase();
    if (tx.to === '' || !tx.to) return 'contract';
    if (tx.from.toLowerCase() === addr && tx.to.toLowerCase() === addr) return 'contract';
    if (tx.from.toLowerCase() === addr) return 'out';
    if (tx.to.toLowerCase() === addr) return 'in';
    return 'contract';
  }

  /**
   * Fetch wallet transactions based on chain
   */
  async fetchTransactions(wallet: WalletConfig): Promise<Transaction[]> {
    if (wallet.chain === 'solana') {
      return this.fetchSolanaTransactions(wallet);
    }

    // EVM chains - fetch both native and token transactions
    const [nativeTxs, tokenTxs] = await Promise.all([
      this.fetchEvmTransactions(wallet),
      this.fetchEvmTokenTransfers(wallet),
    ]);

    // Merge and sort by timestamp
    const allTxs = [...nativeTxs, ...tokenTxs];
    allTxs.sort((a, b) => b.timestamp - a.timestamp);

    // Deduplicate by hash
    const seen = new Set<string>();
    return allTxs.filter(tx => {
      if (seen.has(tx.hash)) return false;
      seen.add(tx.hash);
      return true;
    });
  }

  /**
   * Fetch wallet balance based on chain
   */
  async fetchBalance(wallet: WalletConfig): Promise<WalletBalance> {
    if (wallet.chain === 'solana') {
      return this.fetchSolanaBalance(wallet);
    }
    return this.fetchEvmBalance(wallet);
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
          newTxs.forEach(tx => this.options.onTransaction!(tx, wallet));
        }

        // Check for balance changes
        if (prev && this.options.onBalanceChange) {
          if (prev.balance.native !== balance.native) {
            this.options.onBalanceChange(balance, wallet);
          }
        }
      } catch (error) {
        console.error(`Failed to update wallet ${wallet.address}:`, error);
        this.options.onError?.(error as Error, wallet);
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

  /**
   * Get transaction history for display
   */
  getTransactionHistory(chain: ChainId, address: string, limit: number = 20): Transaction[] {
    const activity = this.getActivity(chain, address);
    if (!activity) return [];
    return activity.transactions.slice(0, limit);
  }
}

// Utility functions
export function formatBalance(balance: string, decimals: number = 18): string {
  const value = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const intPart = value / divisor;
  const fracPart = value % divisor;
  const fracStr = fracPart.toString().padStart(decimals, '0').slice(0, 6);
  return `${intPart}.${fracStr}`;
}

export function shortenAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function getExplorerTxUrl(hash: string, chain: ChainId): string {
  const explorers: Record<string, string> = {
    ethereum: 'https://etherscan.io/tx/',
    bsc: 'https://bscscan.com/tx/',
    polygon: 'https://polygonscan.com/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
    base: 'https://basescan.org/tx/',
    solana: 'https://solscan.io/tx/',
  };
  return `${explorers[chain] || ''}${hash}`;
}

export default WalletTracker;
