import { Keys, type Proof } from '@cashu/cashu-ts'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { GetInfoResponse, MintKeyset, MintKeys } from '@cashu/cashu-ts'
import { CashuToken } from '@/lib/cashu';

interface ProofWithEventId extends Proof {
  eventId: string;
}

export interface Nip60TokenEvent {
  id: string;
  token: CashuToken;
  createdAt: number;
}

interface CashuStore {
  mints: { url: string, mintInfo?: GetInfoResponse, keysets?: MintKeyset[], keys?: Record<string, MintKeys>[], events?: Nip60TokenEvent[] }[];
  proofs: ProofWithEventId[];
  privkey?: string;

  addMint: (url: string) => void;
  setMintInfo: (url: string, mintInfo: GetInfoResponse) => void;
  setKeysets: (url: string, keysets: MintKeyset[]) => void;
  setKeys: (url: string, keys: Record<string, MintKeys>[]) => void;
  addProofs: (proofs: Proof[], eventId: string) => void;
  removeProofs: (proofs: Proof[]) => void;
  setPrivkey: (privkey: string) => void;
  getMintProofs: (mintUrl: string) => Promise<Proof[]>;
  getProofEventId: (proof: Proof) => string | undefined;
  getProofsByEventId: (eventId: string) => Proof[];
}

// Usage:
// const mints = useStore((state) => state.mints);
// const proofs = useStore((state) => state.proofs);
// const addMint = useStore((state) => state.addMint);
// const addProof = useStore((state) => state.addProof);
export const useCashuStore = create<CashuStore>()(
  persist(
    (set, get) => ({
      mints: [],
      proofs: [],
      isLoading: false,

      addMint(url) {
        const existingMints = get().mints.map((mint) => mint.url)
        if (!existingMints.includes(url)) {
          set({ mints: [...get().mints, { url }] })
        }
      },

      setMintInfo(url, mintInfo) {
        set({ mints: get().mints.map((mint) => mint.url === url ? { ...mint, mintInfo } : mint) })
      },

      setKeysets(url, keysets) {
        set({ mints: get().mints.map((mint) => mint.url === url ? { ...mint, keysets } : mint) })
      },

      setKeys(url, keys) {
        set({ mints: get().mints.map((mint) => mint.url === url ? { ...mint, keys } : mint) })
      },

      addProofs(proofs, eventId) {
        const existingProofs = get().proofs.map((p) => p.secret)
        for (const proof of proofs) {
          if (!existingProofs.includes(proof.secret)) {
            set({ proofs: [...get().proofs, { ...proof, eventId }] })
          }
        }
      },

      removeProofs(proofs: Proof[]) {
        set((state) => ({
          proofs: state.proofs.filter((proof) => !proofs.some((p) => p.secret === proof.secret))
        }));
      },

      setPrivkey(privkey) {
        set({ privkey })
      },

      async getMintProofs(mintUrl: string): Promise<Proof[]> {
        // get all active keysets for the mint
        const keysets = get().mints.find((mint) => mint.url === mintUrl)?.keysets;
        if (!keysets) {
          throw new Error('No keysets found for mint');
        }
        // filter only active keysets
        const activeKeysets = keysets.filter((keyset) => keyset.active);
        // get all proofs for the keysets from store
        const proofs = get().proofs.filter((proof) => activeKeysets.some((keyset) => keyset.id === proof.id));
        return proofs;
      },

      getProofEventId(proof) {
        return get().proofs.find((p) => p.secret === proof.secret)?.eventId;
      },

      getProofsByEventId(eventId: string) {
        return get().proofs.filter((p) => p.eventId === eventId);
      }
    }),
    { name: 'cashu' },
  ),
)