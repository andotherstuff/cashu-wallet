import { useState } from 'react';
import { useCashuStore } from '@/stores/cashuStore';
import { useCashuWallet } from '@/hooks/useCashuWallet';
import { useCashuHistory } from '@/hooks/useCashuHistory';
import { CashuMint, CashuWallet, Proof, getEncodedTokenV4, getDecodedToken } from '@cashu/cashu-ts';
import { CashuProof, CashuToken } from '@/lib/cashu';

export function useCashuToken() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cashuStore = useCashuStore();
  const { updateProofs } = useCashuWallet();
  const { createHistory } = useCashuHistory();

  /**
   * Generate a send token
   * @param mintUrl The URL of the mint to use
   * @param amount Amount to send in satoshis
   * @returns The encoded token string
   */
  const sendToken = async (mintUrl: string, amount: number): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const mint = new CashuMint(mintUrl);
      const wallet = new CashuWallet(mint);

      // Load mint keysets
      await wallet.loadMint();

      // Get all proofs from store
      const proofs = await cashuStore.getMintProofs(mintUrl);

      // Perform coin selection
      const { keep: proofsToKeep, send: proofsToSend } = await wallet.send(amount, proofs);

      // Create token string
      const token = getEncodedTokenV4({
        mint: mintUrl,
        proofs: proofsToSend.map(p => ({
          id: p.id || '',
          amount: p.amount,
          secret: p.secret || '',
          C: p.C || ''
        }))
      });
      // Create new token for the proofs we're keeping
      if (proofsToKeep.length > 0) {
        const keepTokenData: CashuToken = {
          mint: mintUrl,
          proofs: proofsToKeep.map(p => ({
            id: p.id || '',
            amount: p.amount,
            secret: p.secret || '',
            C: p.C || ''
          }))
        };

        // update proofs
        await updateProofs({ mintUrl, proofsToAdd: keepTokenData.proofs, proofsToRemove: [...proofsToSend, ...proofs] });
      }

      // Create history event
      await createHistory({
        direction: 'out',
        amount: amount.toString(),
      });

      return token;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(`Failed to generate token: ${message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Receive a token
   * @param token The encoded token string
   * @returns The received proofs
   */
  const receiveToken = async (token: string): Promise<Proof[]> => {
    setIsLoading(true);
    setError(null);

    try {
      // Decode token
      const decodedToken = getDecodedToken(token);
      if (!decodedToken) {
        throw new Error('Invalid token format');
      }

      const { mint: mintUrl, proofs: tokenProofs } = decodedToken;

      // Setup wallet for receiving
      const mint = new CashuMint(mintUrl);
      const wallet = new CashuWallet(mint);

      // Load mint keysets
      await wallet.loadMint();

      // Receive proofs from token
      const receivedProofs = await wallet.receive(token);
      // Create token event in Nostr
      const receivedTokenData: CashuToken = {
        mint: mintUrl,
        proofs: receivedProofs.map(p => ({
          id: p.id || '',
          amount: p.amount,
          secret: p.secret || '',
          C: p.C || ''
        }))
      };

      try {
        // Attempt to create token in Nostr, but don't rely on the return value
        await updateProofs({ mintUrl, proofsToAdd: receivedTokenData.proofs, proofsToRemove: [] });
      } catch (err) {
        console.error('Error storing token in Nostr:', err);
      }

      // Create history event
      const totalAmount = receivedProofs.reduce((sum, p) => sum + p.amount, 0);
      await createHistory({
        direction: 'in',
        amount: totalAmount.toString(),
      });

      return receivedProofs;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(`Failed to receive token: ${message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendToken,
    receiveToken,
    isLoading,
    error
  };
} 