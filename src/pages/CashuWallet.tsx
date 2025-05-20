import { LoginArea } from '@/components/auth/LoginArea';
import { CashuWalletCard } from '@/components/cashu/CashuWalletCard';
import { CashuHistoryCard } from '@/components/cashu/CashuHistoryCard';
import { CashuTransactionCard } from '@/components/cashu/CashuTransactionCard';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function CashuWallet() {
  const { user } = useCurrentUser();

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Cashu Wallet</h1>
          <p className="text-muted-foreground">NIP-60 Cashu ecash wallet</p>
        </div>
        <LoginArea />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <CashuWalletCard />
          <CashuTransactionCard />
        </div>
        <div>
          <CashuHistoryCard />
        </div>
      </div>

      {!user && (
        <div className="mt-8 p-4 bg-muted rounded-lg text-center">
          <p className="text-lg font-medium">Log in to use your Cashu wallet</p>
          <p className="text-muted-foreground">
            Your wallet data is stored encrypted on Nostr relays and follows you across applications.
          </p>
        </div>
      )}
    </div>
  );
}

export default CashuWallet;