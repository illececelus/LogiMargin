'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import type { AuthState } from '@/types/auth';

export function useAuth(): AuthState & { signOut: () => Promise<void>; refresh: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, session: null, profile: null });

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) return null;
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, organization_id, role, phone, avatar_url, onboarding_completed, notification_prefs')
      .eq('id', user.id)
      .maybeSingle();
    return data ?? null;
  }, []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    if (!user || !data.session) {
      setState({ status: 'unauthenticated', user: null, session: null, profile: null });
      return;
    }
    setState({
      status: 'authenticated',
      user,
      session: data.session,
      profile: await loadProfile(user),
    });
  }, [loadProfile]);

  useEffect(() => {
    const supabase = createClient();
    refresh();
    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      const user = session?.user ?? null;
      if (!user || !session) {
        setState({ status: 'unauthenticated', user: null, session: null, profile: null });
        return;
      }
      loadProfile(user).then(profile => {
        setState({
          status: 'authenticated',
          user,
          session,
          profile,
        });
      });
    });
    return () => listener.subscription.unsubscribe();
  }, [loadProfile, refresh]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setState({ status: 'unauthenticated', user: null, session: null, profile: null });
  }

  return { ...state, signOut, refresh };
}
