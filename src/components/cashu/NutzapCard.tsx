import { useState, useEffect } from "react";
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
import { useNostr } from "@/hooks/useNostr";
import { CASHU_EVENT_KINDS } from "@/lib/cashu";

export function NutzapCard() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { wallet, updateProofs } = useCashuWallet();
  const cashuStore = useCashuStore();
  const { sendToken } = useCashuToken();
  const { sendNutzap, isSending, error: sendError } = useSendNutzap();
  const { fetchNutzapInfo, isFetching } = useFetchNutzapInfo();
  const { createRedemption, isCreatingRedemption } = useNutzapRedemption();
  const {
    data: fetchedNutzaps,
    isLoading: isLoadingNutzaps,
    refetch: refetchNutzaps,
  } = useReceivedNutzaps();
  const nutzapInfoQuery = useNutzapInfo(user?.pubkey);

  const [activeTab, setActiveTab] = useState("send");
  const [recipientNpub, setRecipientNpub] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [redeemingNutzap, setRedeemingNutzap] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [receivedNutzaps, setReceivedNutzaps] = useState<ReceivedNutzap[]>([]);

  // Get user's npub
  const userNpub = user ? nip19.npubEncode(user.pubkey) : "";

  // Set up subscription for real-time nutzaps
  useEffect(() => {
    if (!user || !nutzapInfoQuery.data) return;

    // Get trusted mints from nutzap info
    const trustedMints = nutzapInfoQuery.data.mints.map((mint) => mint.url);
    if (trustedMints.length === 0) return;

    // Initialize with fetched nutzaps when available
    if (fetchedNutzaps) {
      setReceivedNutzaps(fetchedNutzaps);
    }

    // Create subscription filter
    const filter = {
      kinds: [CASHU_EVENT_KINDS.ZAP],
      "#p": [user.pubkey], // Events that p-tag the user
      "#u": trustedMints, // Events that u-tag one of the trusted mints
    };

    // Cache for keeping track of event IDs we've already processed
    const processedEventIds = new Set<string>(
      fetchedNutzaps?.map((n) => n.id) || []
    );

    // Create an abort controller for the subscription
    const controller = new AbortController();
    const signal = controller.signal;

    // Start a continuous query for new events
    const fetchRealTimeEvents = async () => {
      try {
        // Use regular query with a signal that can be aborted on component unmount
        const events = await nostr.query([filter], { signal });

        // Process any new events
        for (const event of events) {
          // Skip if we've already processed this event
          if (processedEventIds.has(event.id)) continue;
          processedEventIds.add(event.id);

          try {
            // Get the mint URL from tags
            const mintTag = event.tags.find((tag) => tag[0] === "u");
            if (!mintTag) continue;
            const mintUrl = mintTag[1];

            // Verify the mint is in the trusted list
            if (!trustedMints.includes(mintUrl)) continue;

            // Get proofs from tags
            const proofTags = event.tags.filter((tag) => tag[0] === "proof");
            if (proofTags.length === 0) continue;

            const proofs = proofTags
              .map((tag) => {
                try {
                  return JSON.parse(tag[1]);
                } catch (e) {
                  console.error("Failed to parse proof:", e);
                  return null;
                }
              })
              .filter(Boolean);

            if (proofs.length === 0) continue;

            // Get the zapped event if any
            let zappedEvent: string | undefined;
            const eventTag = event.tags.find((tag) => tag[0] === "e");
            if (eventTag) {
              zappedEvent = eventTag[1];
            }

            // Create nutzap object
            const nutzap: ReceivedNutzap = {
              id: event.id,
              pubkey: event.pubkey,
              createdAt: event.created_at,
              content: event.content,
              proofs,
              mintUrl,
              zappedEvent,
              redeemed: false, // New nutzaps are not redeemed yet
            };

            // Add to received nutzaps, putting newest first
            setReceivedNutzaps((prev) => [nutzap, ...prev]);

            // Optional: Show success notification for new nutzaps
            setSuccess(
              `New Zap received! ${proofs.reduce(
                (sum, p) => sum + p.amount,
                0
              )} sats`
            );
            setTimeout(() => setSuccess(null), 3000);
          } catch (error) {
            console.error("Error processing nutzap event:", error);
          }
        }

        // Set up a polling interval for continuous real-time updates if component is still mounted
        if (!signal.aborted) {
          setTimeout(fetchRealTimeEvents, 5000); // Poll every 5 seconds
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error("Error fetching real-time events:", error);
          // Try again after a delay
          setTimeout(fetchRealTimeEvents, 10000); // Retry after 10 seconds
        }
      }
    };

    // Start the initial fetch
    fetchRealTimeEvents();

    // Cleanup subscription on unmount
    return () => {
      controller.abort();
    };
  }, [user, nutzapInfoQuery.data, fetchedNutzaps, nostr]);

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

      // Mark nutzap as redeemed in state
      setReceivedNutzaps((nutzaps) =>
        nutzaps.map((n) => (n.id === nutzap.id ? { ...n, redeemed: true } : n))
      );

      setSuccess(
        `Successfully redeemed ${proofs.reduce(
          (sum, p) => sum + p.amount,
          0
        )} sats`
      );
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

            {isLoadingNutzaps && receivedNutzaps.length === 0 ? (
              <div className="text-center py-4">Loading incoming zaps...</div>
            ) : receivedNutzaps.length > 0 ? (
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
