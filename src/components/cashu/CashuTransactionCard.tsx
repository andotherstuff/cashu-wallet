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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  QrCode,
  Scan,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCashuToken } from "@/hooks/useCashuToken";
import QRCode from "react-qr-code";

export function CashuTransactionCard() {
  const { user } = useCurrentUser();
  const { wallet } = useCashuWallet();
  const {
    generateToken,
    receiveToken,
    isLoading,
    error: hookError,
  } = useCashuToken();

  const [activeTab, setActiveTab] = useState("receive");
  const [selectedMint, setSelectedMint] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Set the first mint as default when wallet loads
  if (wallet && wallet.mints && wallet.mints.length > 0 && !selectedMint) {
    setSelectedMint(wallet.mints[0]);
  }

  const handleGenerateToken = async () => {
    if (!selectedMint) {
      setError("Please select a mint");
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
      const token = await generateToken(selectedMint, amountValue);

      setGeneratedToken(token);
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
                  <Label htmlFor="mint">Mint</Label>
                  <Select value={selectedMint} onValueChange={setSelectedMint}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a mint" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallet.mints &&
                        wallet.mints.map((mint) => (
                          <SelectItem key={mint} value={mint}>
                            {mint}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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

                <Button
                  className="w-full"
                  onClick={handleGenerateToken}
                  disabled={!selectedMint || !amount || !user || isLoading}
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
              <Label htmlFor="token">Token</Label>
              <div className="relative">
                <Input
                  id="token"
                  placeholder="Paste Cashu token here"
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
      </CardContent>
    </Card>
  );
}
