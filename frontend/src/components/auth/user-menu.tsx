'use client';

import { Check, Copy, ExternalLink, Loader2, LogOut, Unlink, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TestHbarButton } from '@/components/wallet/test-hbar-button';
import { useWalletStatus } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { evmChain, hashscanUrl } from '@/lib/chain-config';
import { errorMessage, shortHash } from '@/lib/format';
import { hasWallet } from '@/lib/wallet';

export function UserMenu() {
  const { user, profile, signOut, linkWallet, unlinkWallet } = useAuth();
  const { data: wallet } = useWalletStatus();
  const [linking, setLinking] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!user) return null;
  const name = profile?.display_name || user.email || 'Account';
  const initials = name
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const link = async () => {
    setLinking(true);
    try {
      await linkWallet();
      toast({ title: 'Wallet linked' });
    } catch (error) {
      toast({ title: 'Could not link wallet', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  const copy = () => {
    if (!profile?.wallet_address) return;
    navigator.clipboard.writeText(profile.wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex h-10 items-center gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials || 'U'}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm font-medium lg:inline">{name}</span>
          {profile?.wallet_address && <span className="hidden h-2 w-2 rounded-full bg-emerald-500 lg:inline" title="Wallet linked" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="space-y-0.5">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
          {profile?.organization && <div className="truncate text-xs font-normal text-muted-foreground">{profile.organization}</div>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {profile?.wallet_address ? (
          <div className="space-y-2 px-2 py-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4" /> {shortHash(profile.wallet_address)}
              </span>
              <button onClick={copy} className="text-muted-foreground hover:text-foreground" aria-label="Copy wallet address">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {!profile.test_hbar_granted_at && <TestHbarButton className="w-full" />}
            {wallet?.accountId ? (
              <a href={hashscanUrl('account', wallet.accountId)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Hedera account {wallet.accountId} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No {evmChain.name} account yet. It is created when the address first receives HBAR.
              </p>
            )}
            {wallet && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-md bg-muted px-2 py-1.5">
                  <div className="text-xs text-muted-foreground">HBAR</div>
                  <div className="font-semibold">{wallet.hbar.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                </div>
                <div className="rounded-md bg-muted px-2 py-1.5">
                  <div className="text-xs text-muted-foreground">CO2e credits</div>
                  <div className="font-semibold">{wallet.co2e.toLocaleString()} t</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-2 py-1.5">
            <Button size="sm" className="w-full" onClick={link} disabled={linking || !hasWallet()}>
              {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
              {hasWallet() ? 'Link MetaMask' : 'MetaMask not detected'}
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">Needed to buy and retire credits on {evmChain.name}.</p>
          </div>
        )}

        <DropdownMenuSeparator />
        {profile?.wallet_address && (
          <DropdownMenuItem onClick={() => unlinkWallet().catch((e) => toast({ title: 'Could not unlink', description: errorMessage(e), variant: 'destructive' }))}>
            <Unlink className="mr-2 h-4 w-4" /> Unlink wallet
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
