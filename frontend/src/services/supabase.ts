import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * DATAVERSE Centralized Supabase Client
 *
 * Reads configuration from Vite environment variables:
 * - VITE_SUPABASE_URL: Project REST / API endpoint URL
 * - VITE_SUPABASE_ANON_KEY: Public anonymous key (or new publishable key format VITE_SUPABASE_PUBLISHABLE_KEY)
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface SupabaseConfigValidation {
  isValid: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  error?: string;
}

/**
 * Validates whether the required Supabase environment variables are present and populated.
 */
export function validateSupabaseConfig(): SupabaseConfigValidation {
  const hasUrl = Boolean(
    supabaseUrl &&
    supabaseUrl !== 'https://your-project-id.supabase.co' &&
    !supabaseUrl.includes('placeholder')
  );
  const hasAnonKey = Boolean(
    supabaseAnonKey &&
    supabaseAnonKey !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-placeholder' &&
    !supabaseAnonKey.includes('placeholder')
  );

  if (!hasUrl && !hasAnonKey) {
    return {
      isValid: false,
      hasUrl: false,
      hasAnonKey: false,
      error:
        'Missing Supabase credentials: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured. ' +
        'Please copy .env.example to .env and provide your Supabase project keys.',
    };
  }

  if (!hasUrl) {
    return {
      isValid: false,
      hasUrl: false,
      hasAnonKey: true,
      error:
        'Missing VITE_SUPABASE_URL in environment configuration. ' +
        'Please define VITE_SUPABASE_URL in your .env file.',
    };
  }

  if (!hasAnonKey) {
    return {
      isValid: false,
      hasUrl: true,
      hasAnonKey: false,
      error:
        'Missing VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in environment configuration. ' +
        'Please define VITE_SUPABASE_ANON_KEY in your .env file.',
    };
  }

  return {
    isValid: true,
    hasUrl: true,
    hasAnonKey: true,
  };
}

const configValidation = validateSupabaseConfig();

export const isSupabaseConfigured = configValidation.isValid;

if (!isSupabaseConfigured) {
  // Output a clear, non-blocking diagnostic message in the console
  console.warn(`[DATAVERSE Supabase Configuration] ${configValidation.error}`);
}

/**
 * Centralized Supabase client instance.
 * Safe fallback placeholder URL is used when unconfigured to prevent module-evaluation crashes during build or initial setup.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder-dataverse.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export function getSupabaseConfig() {
  return {
    url: supabaseUrl || '',
    anonKey: supabaseAnonKey || '',
    isConfigured: isSupabaseConfigured,
  };
}
