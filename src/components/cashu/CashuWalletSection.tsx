import { CashuWalletCard } from "@/components/cashu/CashuWalletCard";
import { CashuWalletLightningCard } from "@/components/cashu/CashuWalletLightningCard";

export function CashuWalletSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CashuWalletCard />
      <CashuWalletLightningCard />
    </div>
  );
}
