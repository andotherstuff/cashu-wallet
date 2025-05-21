import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  Zap,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCashuStore } from "@/stores/cashuStore";
import { useCashuToken } from "@/hooks/useCashuToken";
import { useReceivedNutzaps, ReceivedNutzap } from "@/hooks/useReceivedNutzaps";
import { useSendNutzap, useFetchNutzapInfo } from "@/hooks/useSendNutzap";
import { useNutzapRedemption } from "@/hooks/useNutzapRedemption";
import { nip19 } from "nostr-tools";
import { Proof } from "@cashu/cashu-ts";
import { useNutzapInfo } from "@/hooks/useNutzaps";

export function NutzapCard() {
  const { user } = useCurrentUser();
  const { wallet, updateProofs } = useCashuWallet();
  const cashuStore = useCashuStore();
  const { sendToken } = useCashuToken();
  const { sendNutzap, isSending, error: sendError } = useSendNutzap();
  const { fetchNutzapInfo, isFetching } = useFetchNutzapInfo();
  const { createRedemption, isCreatingRedemption } = useNutzapRedemption();
  const {
    data: receivedNutzaps,
    isLoading: isLoadingNutzaps,
    refetch: refetchNutzaps,
  } = useReceivedNutzaps();

  const [activeTab, setActiveTab] = useState("send");
  const [recipientNpub, setRecipientNpub] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [redeemingNutzap, setRedeemingNutzap] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  // Get user's npub
  const userNpub = user ? nip19.npubEncode(user.pubkey) : "";

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
      setSuccess("Copied to clipboard!");
    } catch (err) {
      setError("Failed to copy to clipboard");
    }
  };

  const handleSendNutzap = async () => {
    if (!cashuStore.activeMintUrl) {
      setError(
        "No active mint selected. Please select a mint in your wallet settings."
      );
      return;
    }

    if (!amount || isNaN(parseInt(amount))) {
      setError("Please enter a valid amount");
      return;
    }

    if (!recipientNpub) {
      setError("Please enter a recipient's Nostr ID (npub)");
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      // Decode the npub to get the pubkey
      let recipientPubkey: string;
      try {
        const decoded = nip19.decode(recipientNpub);
        if (decoded.type !== "npub") {
          throw new Error("Invalid npub format");
        }
        recipientPubkey = decoded.data;
      } catch (e) {
        setError("Invalid npub format. Please enter a valid Nostr ID (npub).");
        return;
      }

      // First fetch the recipient's nutzap info
      const recipientInfo = await fetchNutzapInfo(recipientPubkey);

      console.log("Recipient info", recipientInfo);

      // Generate token (mint) with the specified amount and get proofs for the nutzap
      const amountValue = parseInt(amount);

      // Send token using p2pk pubkey from recipient info
      const proofs = (await sendToken(
        cashuStore.activeMintUrl,
        amountValue,
        recipientInfo.p2pkPubkey
      )) as Proof[];

      // Send nutzap using recipient info
      await sendNutzap({
        recipientInfo,
        comment,
        proofs,
        mintUrl: cashuStore.activeMintUrl,
      });

      setSuccess(`Successfully sent ${amountValue} sats to ${recipientNpub}`);
      setAmount("");
      setComment("");
      setRecipientNpub("");
    } catch (error) {
      console.error("Error sending nutzap:", error);
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleRedeemNutzap = async (nutzap: ReceivedNutzap) => {
    if (nutzap.redeemed) {
      return; // Already redeemed
    }

    try {
      setRedeemingNutzap(nutzap.id);
      setError(null);

      // Receive the token proofs
      const { proofs, mintUrl } = nutzap;

      // Update proofs in the wallet
      const tokenEvent = await updateProofs({
        mintUrl,
        proofsToAdd: proofs,
        proofsToRemove: [],
      });

      if (!tokenEvent) {
        throw new Error("Failed to add proofs to wallet");
      }

      // Record the redemption
      await createRedemption({
        nutzapEventIds: [nutzap.id],
        direction: "in",
        amount: proofs.reduce((sum, p) => sum + p.amount, 0).toString(),
        createdTokenEventId: tokenEvent.id,
      });

      // Refresh the list
      await refetchNutzaps();

      setSuccess(
        `Successfully redeemed ${proofs.reduce(
          (sum, p) => sum + p.amount,
          0
        )} sats`
      );
      // set redeemed to true
      nutzap.redeemed = true;
    } catch (error) {
      console.error("Error redeeming nutzap:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setRedeemingNutzap(null);
    }
  };

  if (!wallet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nostr Zaps</CardTitle>
          <CardDescription>Create a wallet first</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nostr Zaps</CardTitle>
        <CardDescription>
          Send and receive Cashu tokens via Nostr
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="send">
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Send
            </TabsTrigger>
            <TabsTrigger value="receive">
              <ArrowDownLeft className="h-4 w-4 mr-2" />
              Receive
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient (npub)</Label>
              <Input
                id="recipient"
                placeholder="npub1..."
                value={recipientNpub}
                onChange={(e) => setRecipientNpub(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (sats)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Comment (optional)</Label>
              <Input
                id="comment"
                placeholder="Thanks for the content!"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSendNutzap}
              disabled={
                !cashuStore.activeMintUrl ||
                !amount ||
                !recipientNpub ||
                !user ||
                isSending
              }
            >
              {isSending ? "Sending..." : "Send Zap"}
              <Zap className="h-4 w-4 ml-2" />
            </Button>
          </TabsContent>

          <TabsContent value="receive" className="space-y-4 mt-4">
            {user && (
              <div className="border rounded-md p-3 mb-4">
                <Label className="text-sm text-muted-foreground mb-1 block">
                  Your Nostr ID (npub)
                </Label>
                <div className="flex items-center">
                  <div className="text-sm font-mono truncate flex-1 bg-muted p-2 rounded-l-md">
                    {userNpub}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => copyToClipboard(userNpub)}
                    disabled={copying}
                  >
                    {copying ? "Copied!" : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {isLoadingNutzaps ? (
              <div className="text-center py-4">Loading incoming zaps...</div>
            ) : receivedNutzaps && receivedNutzaps.length > 0 ? (
              <div className="space-y-4">
                {receivedNutzaps.map((nutzap) => (
                  <div
                    key={nutzap.id}
                    className={`border rounded-md p-3 ${
                      nutzap.redeemed ? "bg-muted/50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium">
                          From: {nutzap.pubkey.slice(0, 8)}...
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(nutzap.createdAt * 1000).toLocaleString()}
                        </div>
                        {nutzap.content && (
                          <div className="mt-1 text-sm">{nutzap.content}</div>
                        )}
                        <div className="mt-1 font-semibold">
                          {nutzap.proofs.reduce((sum, p) => sum + p.amount, 0)}{" "}
                          sats
                        </div>
                      </div>
                      <div>
                        {nutzap.redeemed ? (
                          <div className="text-xs flex items-center text-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Redeemed
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleRedeemNutzap(nutzap)}
                            disabled={
                              isCreatingRedemption ||
                              redeemingNutzap === nutzap.id
                            }
                          >
                            {redeemingNutzap === nutzap.id
                              ? "Redeeming..."
                              : "Redeem"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No incoming zaps received yet
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => refetchNutzaps()}
              disabled={isLoadingNutzaps}
            >
              Refresh
            </Button>
          </TabsContent>
        </Tabs>

        {(error || sendError) && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || String(sendError)}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mt-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
