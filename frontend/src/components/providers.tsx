'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/contexts/auth-context';
import { DataPersistenceProvider } from '@/contexts/DataPersistenceContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataPersistenceProvider>{children}</DataPersistenceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
