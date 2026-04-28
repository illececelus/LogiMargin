import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export async function getServerSupabase() {
  return createClient(await cookies());
}

export async function getServerUser() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: data.user, error };
}

export async function requireServerUser() {
  const { supabase, user, error } = await getServerUser();
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  return { supabase, user };
}

export const getAuthenticatedUser = requireServerUser;
