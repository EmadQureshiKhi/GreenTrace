'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Coins, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { chainConfig } from '@/lib/chain-config';
import { errorMessage } from '@/lib/format';
import type { Profile } from '@/lib/types';

const FAUCET_URL = 'https://portal.hedera.com/faucet';

/**
 * Testnet only: a one-time grant of test HBAR from the GreenTrace treasury to the linked wallet, so anyone can
 * try buying and retiring credits with a fresh MetaMask. Falls back to the public faucet once used.
 */
export function TestHbarButton({ size = 'sm', className }: { size?: 'sm' | 'default'; className?: string }) {
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (chainConfig.network !== 'testnet' || !profile?.wallet_address) return null;

  if (profile.test_hbar_granted_at) {
    return (
      <Button asChild variant="outline" size={size} className={className}>
        <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
          Get more testnet HBAR <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </a>
      </Button>
    );
  }

  const claim = async () => {
    setBusy(true);
    try {
      const result = await api<{ txId: string; hbar: number; profile: Profile }>('/api/wallet/test-hbar', { method: 'POST' });
      toast({ title: `${result.hbar} test HBAR sent`, description: 'Your wallet can now buy and retire credits on testnet.' });
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['wallet'] }), 6000);
    } catch (error) {
      toast({ title: 'Could not send test HBAR', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size={size} onClick={claim} disabled={busy} className={className}>
      {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Coins className="mr-1.5 h-3.5 w-3.5" />}
      Get 25 test HBAR
    </Button>
  );
}
