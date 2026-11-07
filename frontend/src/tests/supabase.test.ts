import { describe, it, expect } from 'vitest';
import {
  supabase,
  validateSupabaseConfig,
  getSupabaseConfig,
  isSupabaseConfigured,
} from '../services/supabase';

describe('Supabase Client Service', () => {
  it('instantiates the centralized supabase client without throwing', () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
    expect(supabase.auth).toBeDefined();
  });

  it('validates environment configuration and provides diagnostic messages', () => {
    const validation = validateSupabaseConfig();
    expect(typeof validation.isValid).toBe('boolean');
    expect(typeof validation.hasUrl).toBe('boolean');
    expect(typeof validation.hasAnonKey).toBe('boolean');

    if (!validation.isValid) {
      expect(typeof validation.error).toBe('string');
      expect(validation.error!.length).toBeGreaterThan(0);
    }
  });

  it('exports configuration getter matching current configuration state', () => {
    const config = getSupabaseConfig();
    expect(config).toBeDefined();
    expect(typeof config.url).toBe('string');
    expect(typeof config.anonKey).toBe('string');
    expect(config.isConfigured).toBe(isSupabaseConfigured);
  });
});
