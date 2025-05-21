import { bytesToHex } from "@noble/hashes/utils";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { calculateBalance, formatBalance } from "@/lib/cashu";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AlertCircle, Plus, Trash } from "lucide-react";
import { useCashuStore } from "@/stores/cashuStore";
import { generateSecretKey } from "nostr-tools";
import { cn } from "@/lib/utils";

export function CashuWalletCard() {
  const { user } = useCurrentUser();
  const { wallet, isLoading, createWallet } = useCashuWallet();
  const cashuStore = useCashuStore();
  const [newMint, setNewMint] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Calculate total balance across all mints
  const balances = calculateBalance(cashuStore.proofs);

  const handleCreateWallet = () => {
    if (!user) {
      setError("You must be logged in to create a wallet");
      return;
    }

    const privkey = bytesToHex(generateSecretKey()).slice(2);
    cashuStore.setPrivkey(privkey);

    // Create a new wallet with the default mint
    createWallet({
      privkey,
      mints: cashuStore.mints.map((m) => m.url),
    });
  };

  const handleAddMint = () => {
    if (!wallet || !wallet.mints) return;

    try {
      // Validate URL
      new URL(newMint);

      // Add mint to wallet
      createWallet({
        ...wallet,
        mints: [...wallet.mints, newMint],
      });

      // Clear input
      setNewMint("");
      setError(null);
    } catch (e) {
      setError("Invalid mint URL");
    }
  };

  const handleRemoveMint = (mintUrl: string) => {
    if (!wallet || !wallet.mints) return;

    // Don't allow removing the last mint
    if (wallet.mints.length <= 1) {
      setError("Cannot remove the last mint");
      return;
    }

    // Remove mint from wallet
    createWallet({
      ...wallet,
      mints: wallet.mints.filter((m) => m !== mintUrl),
    });

    // If removing the active mint, set the first available mint as active
    if (cashuStore.activeMintUrl === mintUrl) {
      const remainingMints = wallet.mints.filter((m) => m !== mintUrl);
      if (remainingMints.length > 0) {
        cashuStore.setActiveMintUrl(remainingMints[0]);
      }
    }
  };

  // Set active mint when clicking on a mint
  const handleSetActiveMint = (mintUrl: string) => {
    cashuStore.setActiveMintUrl(mintUrl);
  };

  const cleanMintUrl = (mintUrl: string) => {
    return mintUrl.replace("https://", "");
  };

  // Ensure we have an active mint when wallet is loaded
  if (
    wallet &&
    wallet.mints &&
    wallet.mints.length > 0 &&
    !cashuStore.activeMintUrl
  ) {
    cashuStore.setActiveMintUrl(wallet.mints[0]);
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cashu Wallet</CardTitle>
          <CardDescription>Loading wallet...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cashu Wallet</CardTitle>
          <CardDescription>You don't have a Cashu wallet yet</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreateWallet} disabled={!user}>
            Create Wallet
          </Button>
          {!user && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need to log in to create a wallet
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cashu Wallet</CardTitle>
        <CardDescription>Manage your Cashu ecash</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Balances</h3>
            {Object.entries(balances).length > 0 ? (
              <div className="mt-2 space-y-2">
                {Object.entries(balances).map(([mint, amount]) => (
                  <div key={mint} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {cleanMintUrl(mint)}
                    </span>
                    <span className="font-medium">{formatBalance(amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">
                No balance yet
              </p>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-medium">Mints</h3>
            <div className="mt-2 space-y-2">
              {wallet.mints &&
                wallet.mints.map((mint) => (
                  <div key={mint} className="flex justify-between items-center">
                    <Button
                      variant="ghost"
                      className={cn(
                        "px-3 py-1 h-auto text-sm truncate max-w-[200px] mr-2",
                        cashuStore.activeMintUrl === mint &&
                          "border-2 border-primary rounded-full"
                      )}
                      onClick={() => handleSetActiveMint(mint)}
                    >
                      {cleanMintUrl(mint)}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMint(mint)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-end gap-2">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="mint">Add Mint</Label>
              <Input
                id="mint"
                placeholder="https://mint.example.com"
                value={newMint}
                onChange={(e) => setNewMint(e.target.value)}
              />
            </div>
            <Button onClick={handleAddMint}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">NIP-60 Cashu Wallet</p>
      </CardFooter>
    </Card>
  );
}
