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
  Clock,
  Copy,
  QrCode,
  Scan,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCashuToken } from "@/hooks/useCashuToken";
import QRCode from "react-qr-code";
import { useCashuStore } from "@/stores/cashuStore";
import { useCashuHistory } from "@/hooks/useCashuHistory";
import { useTransactionHistoryStore } from "@/stores/transactionHistoryStore";
import { format } from "date-fns";
import { getEncodedTokenV4 } from "@cashu/cashu-ts";

export function CashuTokenCard() {
  const { user } = useCurrentUser();
  const { wallet } = useCashuWallet();
  const cashuStore = useCashuStore();
  const {
    history,
    isLoading: historyLoading,
    createHistory,
  } = useCashuHistory();
  const transactionHistoryStore = useTransactionHistoryStore();
  const {
    sendToken,
    receiveToken,
    isLoading,
    error: hookError,
  } = useCashuToken();

  const [activeTab, setActiveTab] = useState("receive");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Get recent transactions (last 3)
  const recentTransactions = transactionHistoryStore
    .getHistoryEntries()
    .slice(0, 3);

  const handlesendToken = async () => {
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

    try {
      setError(null);
      setSuccess(null);
      setGeneratedToken("");

      const amountValue = parseInt(amount);
      const proofs = await sendToken(cashuStore.activeMintUrl, amountValue);
      const token = getEncodedTokenV4({
        mint: cashuStore.activeMintUrl,
        proofs: proofs.map((p) => ({
          id: p.id || "",
          amount: p.amount,
          secret: p.secret || "",
          C: p.C || "",
        })),
      });

      setGeneratedToken(token as string);
      setSuccess(`Token generated for ${amountValue} sats`);
    } catch (error) {
      console.error("Error generating token:", error);
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleReceiveToken = async () => {
    if (!token) {
      setError("Please enter a token");
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const proofs = await receiveToken(token);

      const totalAmount = proofs.reduce((sum, p) => sum + p.amount, 0);

      setSuccess(`Received ${totalAmount} sats successfully!`);
      setToken("");
    } catch (error) {
      console.error("Error receiving token:", error);
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  const copyTokenToClipboard = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setSuccess("Token copied to clipboard");
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const startQrScanner = () => {
    // This would typically invoke a QR scanner component
    // For now, we'll just show an alert
    alert("QR scanner not implemented in this example");
  };

  if (!wallet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Send & Receive</CardTitle>
          <CardDescription>Create a wallet first</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send & Receive</CardTitle>
        <CardDescription>Transfer Cashu tokens</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="receive">
              <ArrowDownLeft className="h-4 w-4 mr-2" />
              Receive
            </TabsTrigger>
            <TabsTrigger value="send">
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Send
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="space-y-4 mt-4">
            {!generatedToken ? (
              <>
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

                <Button
                  className="w-full"
                  onClick={handlesendToken}
                  disabled={
                    !cashuStore.activeMintUrl || !amount || !user || isLoading
                  }
                >
                  {isLoading ? "Generating..." : "Generate Token"}
                </Button>
              </>
            ) : (
              // Show the generated token
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-md flex items-center justify-center">
                  <div className="border border-border p-2 bg-white">
                    <QRCode value={generatedToken} size={180} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Token</Label>
                  <div className="relative">
                    <Input
                      readOnly
                      value={generatedToken}
                      className="pr-10 font-mono text-xs break-all"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={copyTokenToClipboard}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setGeneratedToken("");
                    setAmount("");
                  }}
                >
                  Generate Another Token
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="receive" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="token"
                  placeholder="Cashu token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={startQrScanner}
                >
                  <Scan className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleReceiveToken}
              disabled={!token || !user || isLoading}
            >
              {isLoading ? "Processing..." : "Redeem Token"}
            </Button>
          </TabsContent>
        </Tabs>

        {(error || hookError) && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || hookError}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mt-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Recent Transactions section */}
        {/* {recentTransactions.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center mb-3">
              <Clock className="h-4 w-4 mr-2" />
              <h3 className="text-sm font-medium">Recent Transactions</h3>
            </div>
            <div className="space-y-3">
              {recentTransactions.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center">
                    {entry.direction === "in" ? (
                      <ArrowDownLeft className="h-3 w-3 mr-2 text-green-600" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3 mr-2 text-red-600" />
                    )}
                    <span>
                      {entry.direction === "in" ? "Received" : "Sent"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        entry.direction === "in"
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {entry.direction === "in" ? "+" : "-"}
                      {entry.amount} sats
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.timestamp &&
                        format(new Date(entry.timestamp * 1000), "MMM d")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )} */}
      </CardContent>
    </Card>
  );
}
