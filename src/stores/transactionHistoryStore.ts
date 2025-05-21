import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SpendingHistoryEntry } from '@/lib/cashu';

interface TransactionHistoryStore {
  history: (SpendingHistoryEntry & { id: string })[];

  // Add a new history entry to the store
  addHistoryEntry: (entry: SpendingHistoryEntry & { id: string }) => void;

  // Get history entries, optionally filtered by direction
  getHistoryEntries: (direction?: 'in' | 'out') => (SpendingHistoryEntry & { id: string })[];

  // Clear history entries for a specific user
  clearHistory: (pubkey?: string) => void;
}

export const useTransactionHistoryStore = create<TransactionHistoryStore>()(
  persist(
    (set, get) => ({
      history: [],

      addHistoryEntry(entry) {
        // Check if entry already exists
        const exists = get().history.some(item => item.id === entry.id);
        if (!exists) {
          set(state => ({
            history: [entry, ...state.history]
          }));
        }
      },

      getHistoryEntries(direction) {
        const history = get().history;

        if (!direction) {
          // Return all entries sorted by timestamp (newest first)
          return [...history].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }

        // Return filtered entries sorted by timestamp
        return history
          .filter(entry => entry.direction === direction)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      },

      clearHistory(pubkey) {
        // If pubkey provided, we could filter by it in the future
        // Currently just clear all history
        set({ history: [] });
      },
    }),
    { name: 'cashu-history' },
  ),
) 