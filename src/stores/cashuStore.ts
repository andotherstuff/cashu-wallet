import { Keys, type Proof } from '@cashu/cashu-ts'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { GetInfoResponse, MintKeyset, MintKeys } from '@cashu/cashu-ts'
interface CashuStore {
  mints: { url: string, mintInfo?: GetInfoResponse, keysets?: MintKeyset[], keys?: Record<string, MintKeys>[] }[];
  proofs: Proof[];
  privkey?: string;

  addMint: (url: string) => void;
  setMintInfo: (url: string, mintInfo: GetInfoResponse) => void;
  setKeysets: (url: string, keysets: MintKeyset[]) => void;
  setKeys: (url: string, keys: Record<string, MintKeys>[]) => void;
  addProof: (proof: Proof) => void;
  removeProofs: (proofIds: string[]) => void;
  setPrivkey: (privkey: string) => void;
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

      addProof(proof) {
        set({ proofs: [...get().proofs, proof] })
      },

      removeProofs(proofIds) {
        set({
          proofs: get().proofs.filter(proof =>
            !proofIds.includes(proof.id || '')
          )
        })
      },

      setPrivkey(privkey) {
        set({ privkey })
      },

      async fetchWallet(): Promise<void> {

      }
    }),
    { name: 'cashu' },
  ),
)