import { isSupabaseClientConfigured, supabase, createServerClient } from '@/lib/supabase';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export async function getSupabaseAccessToken() {
  if (!isSupabaseClientConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSupabaseAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = await getSupabaseAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function ensureSupabaseSession() {
  if (!isSupabaseClientConfigured) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

export async function ensureClientSession() {
  const user = await ensureSupabaseSession();
  if (!user) return null;

  await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' });
  return user;
}

export async function getCurrentSupabaseUser() {
  const user = await ensureSupabaseSession();
  if (!user) throw new Error('Supabase is not configured');
  return user;
}

export async function getBearerUser(db: SupabaseClient, req: Request): Promise<User | null> {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const { data, error } = await db.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function getAuthenticatedUser(db: SupabaseClient, req: Request) {
  return getBearerUser(db, req);
}

export async function getServerUser(db: SupabaseClient, req: Request) {
  const user = await getBearerUser(db, req);
  return user ? { user, error: null } : { user: null, error: new Error('Not authenticated') };
}

export async function requireBearerUser(req: Request, db = createServerClient()) {
  const user = await getBearerUser(db, req);
  if (!user) {
    throw new Error('Not authenticated');
  }
  return { db, user };
}
