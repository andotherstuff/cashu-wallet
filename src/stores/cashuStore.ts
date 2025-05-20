import { type Proof } from '@cashu/cashu-ts'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CashuStore {
  mints: { url: string }[];
  proofs: Proof[];

  addMint: (url: string) => void;
  addProof: (proof: Proof) => void;
}

// Usage:
// const mints = useStore((state) => state.mints);
// const proofs = useStore((state) => state.proofs);
// const addMint = useStore((state) => state.addMint);
// const addProof = useStore((state) => state.addProof);
export const cashuStore = create<CashuStore>()(
  persist(
    (set, get) => ({
      mints: [],
      proofs: [],

      addMint(url) {
        set({ mints: [...get().mints, { url }] })
      },

      addProof(proof) {
        set({ proofs: [...get().proofs, proof] })
      },
    }),
    { name: 'cashu' },
  ),
)