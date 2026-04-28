'use client';
import { useEffect, useState } from 'react';
import { ensureClientSession } from '@/lib/supabase-auth';
import { isSupabaseClientConfigured } from '@/lib/supabase';

type SupabaseAuthState =
  | { status: 'unconfigured'; error: null }
  | { status: 'loading'; error: null }
  | { status: 'ready'; error: null }
  | { status: 'error'; error: string };

export function useSupabaseAuth() {
  const [state, setState] = useState<SupabaseAuthState>(() =>
    isSupabaseClientConfigured
      ? { status: 'loading', error: null }
      : { status: 'unconfigured', error: null }
  );

  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseClientConfigured) {
      setState({ status: 'unconfigured', error: null });
      return;
    }

    ensureClientSession()
      .then(() => {
        if (!cancelled) setState({ status: 'ready', error: null });
      })
      .catch(error => {
        if (!cancelled) {
          setState({
            status: 'error',
            error: error instanceof Error ? error.message : 'Supabase authentication failed',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
