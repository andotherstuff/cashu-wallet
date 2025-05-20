import { type Proof } from '@cashu/cashu-ts'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CashuStore {
  mints: { url: string }[];
  proofs: Proof[];
  privkey?: string;

  addMints: (urls: string[]) => void;
  addProof: (proof: Proof) => void;
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

      addMints(urls) {
        const newMints = urls.map((url) => ({ url }))
        const existingMints = get().mints.map((mint) => mint.url)
        const uniqueMints = newMints.filter((mint) => !existingMints.includes(mint.url))

        set({ mints: [...get().mints, ...uniqueMints] })
      },

      addProof(proof) {
        set({ proofs: [...get().proofs, proof] })
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