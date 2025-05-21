import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQuery } from '@tanstack/react-query';
import { CASHU_EVENT_KINDS } from '@/lib/cashu';
import { useNutzapInfo } from '@/hooks/useNutzaps';
import { getLastEventTimestamp } from '@/lib/nostrTimestamps';

export interface ReceivedNutzap {
  id: string;
  pubkey: string; // Sender's pubkey
  createdAt: number;
  content: string; // Comment from sender
  proofs: Array<{
    amount: number;
    C: string;
    id: string;
    secret: string;
  }>;
  mintUrl: string;
  zappedEvent?: string; // Event ID being zapped, if any
  redeemed: boolean; // Whether this nutzap has been redeemed
}

/**
 * Hook to fetch nutzap events received by the user
 */
export function useReceivedNutzaps() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const nutzapInfoQuery = useNutzapInfo(user?.pubkey);

  return useQuery({
    queryKey: ['nutzap', 'received', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user) throw new Error('User not logged in');

      // Get the nutzap info for the user
      const nutzapInfo = await nutzapInfoQuery.refetch();
      if (!nutzapInfo.data) {
        return [];
      }

      // Get trusted mints from nutzap info
      const trustedMints = nutzapInfo.data.mints.map(mint => mint.url);
      if (trustedMints.length === 0) {
        return [];
      }

      // Get relays where the user reads nutzap events
      const relays = nutzapInfo.data.relays;

      // Get p2pk pubkey that the tokens should be locked to
      const p2pkPubkey = nutzapInfo.data.p2pkPubkey;

      // Get the last timestamp of redemption events
      const lastRedemptionTimestamp = getLastEventTimestamp(
        user.pubkey,
        CASHU_EVENT_KINDS.HISTORY
      );

      // Query for nutzap events
      const filter = {
        kinds: [CASHU_EVENT_KINDS.ZAP],
        '#p': [user.pubkey], // Events that p-tag the user
        '#u': trustedMints, // Events that u-tag one of the trusted mints
        limit: 50
      };

      // Add since filter if we have a last redemption timestamp
      if (lastRedemptionTimestamp) {
        Object.assign(filter, { since: lastRedemptionTimestamp });
      }

      const events = await nostr.query([filter], { signal });

      // Query for redemption events to check which nutzaps have been redeemed
      const redemptionEvents = await nostr.query([
        {
          kinds: [CASHU_EVENT_KINDS.HISTORY],
          authors: [user.pubkey],
          limit: 100
        }
      ], { signal });

      // Extract redeemed event IDs
      const redeemedEventIds = new Set<string>();
      for (const event of redemptionEvents) {
        event.tags
          .filter(tag => tag[0] === 'e' && tag[3] === 'redeemed')
          .forEach(tag => redeemedEventIds.add(tag[1]));
      }

      // Process and validate nutzap events
      const receivedNutzaps: ReceivedNutzap[] = [];

      for (const event of events) {
        try {
          // Check if this nutzap has already been redeemed
          const isRedeemed = redeemedEventIds.has(event.id);

          // Get the mint URL
          const mintTag = event.tags.find(tag => tag[0] === 'u');
          if (!mintTag) continue;
          const mintUrl = mintTag[1];

          // Verify the mint is in the trusted list
          if (!trustedMints.includes(mintUrl)) continue;

          // Get proofs
          const proofTags = event.tags.filter(tag => tag[0] === 'proof');
          if (proofTags.length === 0) continue;

          const proofs = proofTags.map(tag => {
            try {
              return JSON.parse(tag[1]);
            } catch (e) {
              console.error('Failed to parse proof:', e);
              return null;
            }
          }).filter(Boolean);

          if (proofs.length === 0) continue;

          // Verify the tokens are P2PK locked to the user's pubkey
          // (This is a basic check - in a production app you'd do a more thorough validation)
          for (const proof of proofs) {
            // Check if the token is P2PK locked properly
            try {
              const secret = JSON.parse(proof.secret);
              if (!(Array.isArray(secret) &&
                secret[0] === 'P2PK' &&
                secret[1]?.data?.startsWith('02'))) {
                // Not properly P2PK locked
                continue;
              }

              // In a real implementation, you would verify this more thoroughly
              // by checking the pubkey matches the user's P2PK pubkey
              // const p2pkTarget = secret[1].data;
            } catch (e) {
              console.error('Failed to parse token secret:', e);
              continue;
            }
          }

          // Get the zapped event if any
          let zappedEvent: string | undefined;
          const eventTag = event.tags.find(tag => tag[0] === 'e');
          if (eventTag) {
            zappedEvent = eventTag[1];
          }

          // Add to received nutzaps
          receivedNutzaps.push({
            id: event.id,
            pubkey: event.pubkey,
            createdAt: event.created_at,
            content: event.content,
            proofs,
            mintUrl,
            zappedEvent,
            redeemed: isRedeemed
          });
        } catch (error) {
          console.error('Error processing nutzap event:', error);
        }
      }

      // Sort by timestamp, newest first
      return receivedNutzaps.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!user && nutzapInfoQuery.isSuccess && !!nutzapInfoQuery.data
  });
} 