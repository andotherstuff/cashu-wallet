import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Copy, QrCode, Zap } from "lucide-react";
import { useCashuWallet } from "@/hooks/useCashuWallet";
import { useCashuStore } from "@/stores/cashuStore";
import {
  createLightningInvoice,
  mintTokensFromPaidInvoice,
  payMeltQuote,
  parseInvoiceAmount,
  createMeltQuote,
} from "@/lib/cashuLightning";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { MeltQuoteResponse, MintQuoteResponse, Proof } from "@cashu/cashu-ts";
import { CashuToken } from "@/lib/cashu";
import { NostrEvent } from "nostr-tools";
import QRCode from "react-qr-code";
import { set } from "date-fns";

interface TokenEvent {
  id: string;
  token: CashuToken;
  createdAt: number;
}

export function CashuWalletLightningCard() {
  const { user } = useCurrentUser();
  const {
    wallet,
    isLoading,
    createHistory,
    updateProofs,
    tokens = [],
  } = useCashuWallet();
  const cashuStore = useCashuStore();
  const [activeTab, setActiveTab] = useState("receive");

  const [receiveAmount, setReceiveAmount] = useState("");
  const [invoice, setInvoice] = useState("");
  const [currentMeltQuoteId, setcurrentMeltQuoteId] = useState("");
  const [paymentRequest, setPaymentRequest] = useState("");
  const [sendInvoice, setSendInvoice] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState<number | null>(null);
  const [invoiceFeeReserve, setInvoiceFeeReserve] = useState<number | null>(
    null
  );
  const [mintQuote, setMintQuote] = useState<MintQuoteResponse | null>(null);
  const [meltQuote, setMeltQuote] = useState<MeltQuoteResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Handle receive tab
  const handleCreateInvoice = async () => {
    if (!cashuStore.activeMintUrl) {
      setError(
        "No active mint selected. Please select a mint in your wallet settings."
      );
      return;
    }

    if (!receiveAmount || isNaN(parseInt(receiveAmount))) {
      setError("Please enter a valid amount");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      const amount = parseInt(receiveAmount);
      const invoiceData = await createLightningInvoice(
        cashuStore.activeMintUrl,
        amount
      );

      setInvoice(invoiceData.paymentRequest);
      setcurrentMeltQuoteId(invoiceData.quoteId);
      setPaymentRequest(invoiceData.paymentRequest);

      // Start polling for payment status
      checkPaymentStatus(cashuStore.activeMintUrl, invoiceData.quoteId, amount);
    } catch (error) {
      console.error("Error creating invoice:", error);
      setError(
        "Failed to create Lightning invoice: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Poll for payment status
  const checkPaymentStatus = async (
    mintUrl: string,
    quoteId: string,
    amount: number
  ) => {
    try {
      // Check if payment has been received
      const proofs = await mintTokensFromPaidInvoice(mintUrl, quoteId, amount);

      if (proofs.length > 0) {
        // update proofs
        await updateProofs({
          mintUrl,
          proofsToAdd: proofs,
          proofsToRemove: [],
        });

        // get token event
        const tokenEventId = cashuStore.getProofEventId(proofs[0]);

        // Create token in Nostr
        try {
          // Create history event if we got a token ID
          if (tokenEventId) {
            await createHistory({
              direction: "in",
              amount: amount.toString(),
              createdTokens: [tokenEventId],
            });
          }
        } catch (err) {
          console.error("Error creating token:", err);
        }

        setSuccess(`Received ${amount} sats via Lightning!`);
        setInvoice("");
        setcurrentMeltQuoteId("");
        setTimeout(() => setSuccess(null), 5000);
      } else {
        // If payment not received yet, check again in 5 seconds
        setTimeout(() => {
          if (currentMeltQuoteId === quoteId) {
            // Only continue if we're still waiting for this payment
            checkPaymentStatus(mintUrl, quoteId, amount);
          }
        }, 5000);
      }
    } catch (error) {
      // If it's not a "not paid yet" error, show the error
      if (
        !(error instanceof Error && error.message.includes("not been paid"))
      ) {
        console.error("Error checking payment status:", error);
        setError(
          "Failed to check payment status: " +
            (error instanceof Error ? error.message : String(error))
        );
      } else {
        // Keep polling if it's just not paid yet
        setTimeout(() => {
          if (currentMeltQuoteId === quoteId) {
            // Only continue if we're still waiting for this payment
            checkPaymentStatus(mintUrl, quoteId, amount);
          }
        }, 5000);
      }
    }
  };

  // Copy invoice to clipboard
  const copyInvoiceToClipboard = () => {
    navigator.clipboard.writeText(invoice);
    setSuccess("Invoice copied to clipboard");
    setTimeout(() => setSuccess(null), 3000);
  };

  // Handle send tab
  const handleInvoiceInput = async (value: string) => {
    if (!cashuStore.activeMintUrl) {
      setError(
        "No active mint selected. Please select a mint in your wallet settings."
      );
      return;
    }

    setSendInvoice(value);

    // Create melt quote
    const mintUrl = cashuStore.activeMintUrl;
    try {
      const meltQuote = await createMeltQuote(mintUrl, value);
      setcurrentMeltQuoteId(meltQuote.quote);
      console.log(meltQuote);

      // Parse amount from invoice
      setInvoiceAmount(meltQuote.amount);
      setInvoiceFeeReserve(meltQuote.fee_reserve);
    } catch (error) {
      console.error("Error creating melt quote:", error);
      setError(
        "Failed to create melt quote: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  // Start QR scanner
  const startQrScanner = () => {
    // This would typically invoke a QR scanner component
    // For now, we'll just show an alert
    alert("QR scanner not implemented in this example");
  };

  // Pay Lightning invoice
  const handlePayInvoice = async () => {
    if (!sendInvoice) {
      setError("Please enter a Lightning invoice");
      return;
    }

    if (!cashuStore.activeMintUrl) {
      setError(
        "No active mint selected. Please select a mint in your wallet settings."
      );
      return;
    }

    if (!invoiceAmount) {
      setError("Could not parse invoice amount");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Get active mint
      const mintUrl = cashuStore.activeMintUrl;

      // Select proofs to spend
      const selectedProofs = [...cashuStore.proofs];
      const totalProofsAmount = selectedProofs.reduce(
        (sum, p) => sum + p.amount,
        0
      );

      if (totalProofsAmount < invoiceAmount) {
        setError(
          `Insufficient balance: have ${totalProofsAmount} sats, need ${invoiceAmount} sats`
        );
        setIsProcessing(false);
        return;
      }

      // Pay the invoice
      const result = await payMeltQuote(
        mintUrl,
        currentMeltQuoteId,
        selectedProofs
      );

      if (result.success) {
        // Store the ids of proofs that were spent
        const spentProofIds = selectedProofs
          .map((p) => p.id || "")
          .filter((id) => !!id);

        // Remove spent proofs from the store
        await updateProofs({
          mintUrl,
          proofsToAdd: [...result.keep, ...result.change],
          proofsToRemove: selectedProofs,
        });

        // Create history event
        await createHistory({
          direction: "out",
          amount: invoiceAmount.toString(),
        });

        setSuccess(`Paid ${invoiceAmount} sats via Lightning!`);
        setSendInvoice("");
        setInvoiceAmount(null);
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (error) {
      console.error("Error paying invoice:", error);
      setError(
        "Failed to pay Lightning invoice: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lightning</CardTitle>
          <CardDescription>Loading wallet...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lightning</CardTitle>
          <CardDescription>Create a wallet to use Lightning</CardDescription>
        </CardHeader>
        <CardContent>
          {!user && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need to log in to use Lightning
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
        <CardTitle>Lightning</CardTitle>
        <CardDescription>Send and receive via Lightning</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="receive">Receive</TabsTrigger>
            <TabsTrigger value="send">Send</TabsTrigger>
          </TabsList>

          <TabsContent value="receive" className="space-y-4">
            {!invoice ? (
              // Show form to create invoice
              <>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (sats)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="100"
                    value={receiveAmount}
                    onChange={(e) => setReceiveAmount(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleCreateInvoice}
                  disabled={
                    isProcessing || !cashuStore.activeMintUrl || !receiveAmount
                  }
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {isProcessing
                    ? "Creating Invoice..."
                    : "Create Lightning Invoice"}
                </Button>
              </>
            ) : (
              // Show generated invoice
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-md flex items-center justify-center">
                  {/* Placeholder for QR code - in a real app, use a QR code library */}
                  <div className="border border-border w-48 h-48 flex items-center justify-center">
                    <QRCode value={invoice} size={180} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Lightning Invoice</Label>
                  <div className="relative">
                    <Input
                      readOnly
                      value={invoice}
                      className="pr-10 font-mono text-xs break-all"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={copyInvoiceToClipboard}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Waiting for payment...
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setInvoice("");
                    setcurrentMeltQuoteId("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="send" className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="invoice"
                  placeholder="Lightning invoice"
                  value={sendInvoice}
                  onChange={(e) => handleInvoiceInput(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={startQrScanner}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {invoiceAmount && (
              <div className="rounded-md border p-4">
                <p className="text-sm font-medium">Invoice Amount</p>
                <p className="text-2xl font-bold">
                  {invoiceAmount} sats
                  {invoiceFeeReserve && (
                    <>
                      <span className="text-xs font-bold pl-2 text-muted-foreground">
                        + max {invoiceFeeReserve} sats fee
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSendInvoice("");
                  setInvoiceAmount(null);
                  setInvoiceFeeReserve(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handlePayInvoice}
                disabled={isProcessing || !sendInvoice || !invoiceAmount}
              >
                {isProcessing ? "Processing..." : "Pay Invoice"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
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
