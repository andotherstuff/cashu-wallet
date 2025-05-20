import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCashuWallet } from '@/hooks/useCashuWallet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function CashuTransactionCard() {
  const { user } = useCurrentUser();
  const { wallet, tokens } = useCashuWallet();
  const [activeTab, setActiveTab] = useState('receive');
  const [selectedMint, setSelectedMint] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Set the first mint as default when wallet loads
  if (wallet && wallet.mints && wallet.mints.length > 0 && !selectedMint) {
    setSelectedMint(wallet.mints[0]);
  }

  const handleReceive = () => {
    // This would typically involve generating a token from the mint
    // For now, we'll just show a placeholder message
    setError('Mint integration not implemented yet');
  };

  const handleSend = () => {
    // This would typically involve parsing the token and sending it
    // For now, we'll just show a placeholder message
    setError('Token sending not implemented yet');
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
          
          <TabsContent value="receive" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="mint">Mint</Label>
              <Select value={selectedMint} onValueChange={setSelectedMint}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a mint" />
                </SelectTrigger>
                <SelectContent>
                  {wallet.mints && wallet.mints.map((mint) => (
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
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Button 
              className="w-full" 
              onClick={handleReceive}
              disabled={!selectedMint || !amount || !user}
            >
              Generate Token
            </Button>
          </TabsContent>
          
          <TabsContent value="send" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="token">Token</Label>
              <Input
                id="token"
                placeholder="Paste Cashu token here"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Button 
              className="w-full" 
              onClick={handleSend}
              disabled={!token || !user}
            >
              Redeem Token
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}