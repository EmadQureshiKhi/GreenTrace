'use client';

import { Leaf, LogIn } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

/** Shows children to signed-in users and a sign-in prompt to everyone else. */
export function AuthGuard({ children, title = 'Sign in to continue' }: { children: ReactNode; title?: string }) {
  const { isAuthenticated, isLoading, openAuthModal } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Leaf className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="text-muted-foreground">Your inventories, certificates and orders are private to your account.</p>
          <Button onClick={openAuthModal}>
            <LogIn className="mr-2 h-4 w-4" /> Sign in
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
