import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginArea } from "@/components/auth/LoginArea";
import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LoginArea />
        </div>
        
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">NIP-60 Cashu Wallet</CardTitle>
            <CardDescription>
              A Nostr-based ecash wallet that follows you across applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This wallet implements NIP-60, storing your Cashu tokens encrypted on Nostr relays.
              Your wallet data is accessible from any compatible application.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link to="/wallet">
                <Wallet className="mr-2 h-4 w-4" />
                Open Wallet
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Index;
