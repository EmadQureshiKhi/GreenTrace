'use client';

import { Loader2, LogIn, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { evmChain } from '@/lib/chain-config';
import { errorMessage } from '@/lib/format';
import { hasWallet } from '@/lib/wallet';

/** Renders children only for a signed-in user with a linked wallet; otherwise explains the next step. */
export function WalletGate({ children, reason }: { children: ReactNode; reason: string }) {
  const { isAuthenticated, profile, openAuthModal, linkWallet } = useAuth();
  const [linking, setLinking] = useState(false);

  if (isAuthenticated && profile?.wallet_address) return <>{children}</>;

  const link = async () => {
    setLinking(true);
    try {
      await linkWallet();
      toast({ title: 'Wallet linked', description: 'Your wallet is now linked to your GreenTrace account.' });
    } catch (error) {
      toast({ title: 'Could not link wallet', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <Wallet className="h-8 w-8 text-muted-foreground" />
        <p className="max-w-md text-sm text-muted-foreground">
          {!isAuthenticated ? `Sign in to ${reason}.` : `Link a wallet on ${evmChain.name} to ${reason}.`}
        </p>
        {!isAuthenticated ? (
          <Button onClick={openAuthModal}>
            <LogIn className="mr-2 h-4 w-4" /> Sign in
          </Button>
        ) : hasWallet() ? (
          <Button onClick={link} disabled={linking}>
            {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
            Link MetaMask
          </Button>
        ) : (
          <Button asChild variant="outline">
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">Install MetaMask</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
