'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';

function SupabaseAuthBootstrap({ children }: { children: ReactNode }) {
  useSupabaseAuth();
  return children;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthBootstrap>{children}</SupabaseAuthBootstrap>
    </QueryClientProvider>
  );
}
