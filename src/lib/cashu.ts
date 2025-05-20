// Types and utilities for Cashu wallet (NIP-60)

export interface CashuProof {
  id: string;
  amount: number;
  secret: string;
  C: string;
}

export interface CashuToken {
  mint: string;
  proofs: CashuProof[];
  del?: string[]; // token-ids that were destroyed by the creation of this token
}

export interface CashuWallet {
  privkey?: string; // Private key used to unlock P2PK ecash
  mints: string[]; // List of mint URLs
}

export interface SpendingHistoryEntry {
  direction: 'in' | 'out';
  amount: string;
  createdTokens?: string[];
  destroyedTokens?: string[];
  redeemedTokens?: string[];
  timestamp?: number;
}

// Event kinds as defined in NIP-60
export const CASHU_EVENT_KINDS = {
  WALLET: 17375, // Replaceable event for wallet info
  TOKEN: 7375,   // Token events for unspent proofs
  HISTORY: 7376, // Spending history events
  QUOTE: 7374,   // Quote events (optional)
};

// Helper function to calculate total balance from tokens
export function calculateBalance(tokens: CashuToken[]): { [mint: string]: number } {
  const balances: { [mint: string]: number } = {};
  
  for (const token of tokens) {
    if (!balances[token.mint]) {
      balances[token.mint] = 0;
    }
    
    for (const proof of token.proofs) {
      balances[token.mint] += proof.amount;
    }
  }
  
  return balances;
}

// Helper function to format balance with appropriate units
export function formatBalance(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)} BTC`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(2)} mBTC`;
  } else {
    return `${amount} sats`;
  }
}