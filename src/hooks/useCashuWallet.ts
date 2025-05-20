import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CASHU_EVENT_KINDS, CashuWallet, CashuToken } from '@/lib/cashu';
import { nip44 } from 'nostr-tools';
import { useCashuStore } from '@/stores/cashuStore';

/**
 * Hook to fetch and manage the user's Cashu wallet
 */
export function useCashuWallet() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const cashuStore = useCashuStore();

  // Fetch wallet information (kind 17375)
  const walletQuery = useQuery({
    queryKey: ['cashu', 'wallet', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user) throw new Error('User not logged in');

      const events = await nostr.query([
        { kinds: [CASHU_EVENT_KINDS.WALLET], authors: [user.pubkey], limit: 1 }
      ], { signal });

      if (events.length === 0) {
        return null;
      }

      const event = events[0];
      
      try {
        // Decrypt wallet content
        if (!user.signer.nip44) {
          throw new Error('NIP-44 encryption not supported by your signer');
        }
        
        const decrypted = await user.signer.nip44.decrypt(user.pubkey, event.content);
        const walletData = JSON.parse(decrypted) as CashuWallet;
        
        // Ensure wallet has required properties
        if (!walletData.mints) {
          walletData.mints = [];
        }
        
        cashuStore.addMints(walletData.mints);
        cashuStore.setPrivkey(walletData.privkey);

        return {
          id: event.id,
          wallet: walletData,
          createdAt: event.created_at
        };
      } catch (error) {
        console.error('Failed to decrypt wallet data:', error);
        return null;
      }
    },
    enabled: !!user
  });

  // Fetch token events (kind 7375)
  const tokensQuery = useQuery({
    queryKey: ['cashu', 'tokens', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user) throw new Error('User not logged in');

      const events = await nostr.query([
        { kinds: [CASHU_EVENT_KINDS.TOKEN], authors: [user.pubkey], limit: 100 }
      ], { signal });

      if (events.length === 0) {
        return [];
      }

      const tokens: { id: string; token: CashuToken; createdAt: number }[] = [];

      for (const event of events) {
        try {
          if (!user.signer.nip44) {
            throw new Error('NIP-44 encryption not supported by your signer');
          }
          
          const decrypted = await user.signer.nip44.decrypt(user.pubkey, event.content);
          const tokenData = JSON.parse(decrypted) as CashuToken;
          
          tokens.push({
            id: event.id,
            token: tokenData,
            createdAt: event.created_at
          });
        } catch (error) {
          console.error('Failed to decrypt token data:', error);
        }
      }

      return tokens;
    },
    enabled: !!user
  });

  // Create or update wallet
  const createWalletMutation = useMutation({
    mutationFn: async (walletData: CashuWallet) => {
      if (!user) throw new Error('User not logged in');
      if (!user.signer.nip44) {
        throw new Error('NIP-44 encryption not supported by your signer');
      }

      // Encrypt wallet data
      const content = await user.signer.nip44.encrypt(
        user.pubkey, 
        JSON.stringify(walletData)
      );

      // Create wallet event
      const event = await user.signer.signEvent({
        kind: CASHU_EVENT_KINDS.WALLET,
        content,
        tags: walletData.mints.map(mint => ['mint', mint]),
        created_at: Math.floor(Date.now() / 1000)
      });

      // Publish event
      await nostr.event(event);
      
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashu', 'wallet', user?.pubkey] });
    }
  });

  // Create token event
  const createTokenMutation = useMutation({
    mutationFn: async (tokenData: CashuToken) => {
      if (!user) throw new Error('User not logged in');
      if (!user.signer.nip44) {
        throw new Error('NIP-44 encryption not supported by your signer');
      }

      // Encrypt token data
      const content = await user.signer.nip44.encrypt(
        user.pubkey, 
        JSON.stringify(tokenData)
      );

      // Create token event
      const event = await user.signer.signEvent({
        kind: CASHU_EVENT_KINDS.TOKEN,
        content,
        tags: [],
        created_at: Math.floor(Date.now() / 1000)
      });

      // Publish event
      await nostr.event(event);
      
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashu', 'tokens', user?.pubkey] });
    }
  });

  // Delete token event
  const deleteTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      if (!user) throw new Error('User not logged in');

      // Create deletion event (NIP-09)
      const event = await user.signer.signEvent({
        kind: 5, // Deletion event
        content: 'Deleted token',
        tags: [
          ['e', tokenId],
          ['k', CASHU_EVENT_KINDS.TOKEN.toString()]
        ],
        created_at: Math.floor(Date.now() / 1000)
      });

      // Publish event
      await nostr.event(event);
      
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashu', 'tokens', user?.pubkey] });
    }
  });

  // Create spending history event
  const createHistoryMutation = useMutation({
    mutationFn: async ({ 
      direction, 
      amount, 
      createdTokens = [], 
      destroyedTokens = [],
      redeemedTokens = []
    }: {
      direction: 'in' | 'out';
      amount: string;
      createdTokens?: string[];
      destroyedTokens?: string[];
      redeemedTokens?: string[];
    }) => {
      if (!user) throw new Error('User not logged in');
      if (!user.signer.nip44) {
        throw new Error('NIP-44 encryption not supported by your signer');
      }

      // Prepare content data
      const contentData = [
        ['direction', direction],
        ['amount', amount],
        ...createdTokens.map(id => ['e', id, '', 'created']),
        ...destroyedTokens.map(id => ['e', id, '', 'destroyed'])
      ];

      // Encrypt content
      const content = await user.signer.nip44.encrypt(
        user.pubkey, 
        JSON.stringify(contentData)
      );

      // Create history event with unencrypted redeemed tags
      const event = await user.signer.signEvent({
        kind: CASHU_EVENT_KINDS.HISTORY,
        content,
        tags: redeemedTokens.map(id => ['e', id, '', 'redeemed']),
        created_at: Math.floor(Date.now() / 1000)
      });

      // Publish event
      await nostr.event(event);
      
      return event;
    }
  });

  return {
    wallet: walletQuery.data?.wallet,
    walletId: walletQuery.data?.id,
    tokens: tokensQuery.data || [],
    isLoading: walletQuery.isLoading || tokensQuery.isLoading,
    createWallet: createWalletMutation.mutate,
    createToken: createTokenMutation.mutate,
    deleteToken: deleteTokenMutation.mutate,
    createHistory: createHistoryMutation.mutate,
  };
}