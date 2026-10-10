'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Landing page for email confirmation and Google sign-in. The Supabase client exchanges the code in the
// URL for a session automatically; we wait for it and return to the dashboard.
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') router.replace('/');
    });
    const timeout = setTimeout(() => router.replace('/'), 8000);
    return () => {
      data.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}
