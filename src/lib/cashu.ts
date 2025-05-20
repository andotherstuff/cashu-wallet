// Types and utilities for Cashu wallet (NIP-60)

import { useCashuStore } from "@/stores/cashuStore";
import { CashuMint, Proof, CashuWallet, GetInfoResponse, MintKeyset, MintKeys } from "@cashu/cashu-ts";
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

export interface CashuWalletStruct {
  privkey: string; // Private key used to unlock P2PK ecash
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
export function calculateBalance(proofs: Proof[]): Record<string, number> {
  const balances: { [mint: string]: number } = {};
  const mints = useCashuStore.getState().mints;
  for (const mint of mints) {
    const keysets = mint.keysets;
    if (!keysets) continue;
    for (const keyset of keysets) {
      // select all proofs with id == keyset.id
      const proofsForKeyset = proofs.filter((proof) => proof.id === keyset.id);
      balances[mint.url] = proofsForKeyset.reduce((acc, proof) => acc + proof.amount, 0);
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

export async function activateMint(mintUrl: string): Promise<{ mintInfo: GetInfoResponse, keysets: MintKeyset[] }> {
  const mint = new CashuMint(mintUrl);
  const wallet = new CashuWallet(mint);
  const mintInfo = await wallet.getMintInfo();
  const keysets = await wallet.getKeySets();
  return { mintInfo, keysets };
}

export async function updateMintKeys(mintUrl: string): Promise<{ keys: Record<string, MintKeys>[] }> {
  const mint = new CashuMint(mintUrl);
  const wallet = new CashuWallet(mint);
  const keysets = await wallet.getKeySets();
  const keys = await Promise.all(keysets.map(async (keyset) => {
    return { [keyset.id]: await wallet.getKeys(keyset.id) };
  }));
  return { keys };
}