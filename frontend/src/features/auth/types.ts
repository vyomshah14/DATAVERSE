import type { User, Session } from '@supabase/supabase-js';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface UserSessionProfile {
  id: string;
  email: string;
  displayName: string;
}

export type { User, Session };
