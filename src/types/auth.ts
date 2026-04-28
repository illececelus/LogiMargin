import type { Session, User } from '@supabase/supabase-js';

export type OrgRole = 'owner' | 'admin' | 'dispatcher' | 'driver' | 'accountant';

export interface Profile {
  id: string;
  organization_id: string | null;
  role: OrgRole;
  company: string | null;
  phone: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
}

export type AuthUser = User;
export type AuthSession = Session;

export type AuthState =
  | { status: 'loading'; user: null; session: null; profile: null }
  | { status: 'unauthenticated'; user: null; session: null; profile: null }
  | { status: 'authenticated'; user: AuthUser; session: AuthSession; profile: Profile | null };

