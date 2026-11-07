/**
 * Supabase Client Configuration & Initialization.
 * Reads environment variables from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * Never exposes hardcoded credentials.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const isConfigured = Boolean(
    url && anonKey && !url.includes('your-project-id') && !anonKey.includes('placeholder')
  );

  return {
    url,
    anonKey,
    isConfigured,
  };
}
