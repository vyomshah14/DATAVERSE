import { supabase } from './supabase';
import type { Session, User, AuthError } from '@supabase/supabase-js';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpResult {
  user: User | null;
  session: Session | null;
  requiresEmailVerification: boolean;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
}

/**
 * Centralized Authentication Service.
 * Encapsulates direct interaction with Supabase Auth,
 * transforms errors into user-friendly messages,
 * and detects email confirmation requirements.
 */
export class AuthService {
  /**
   * Format Supabase AuthError messages into user-friendly notifications.
   */
  public static formatAuthError(error: AuthError | Error | unknown): string {
    if (!error) return 'An unexpected authentication error occurred.';
    const message = (error as Error).message || String(error);

    if (message.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please verify your credentials and try again.';
    }
    if (message.includes('Email not confirmed')) {
      return 'Your email address has not been confirmed yet. Please check your inbox for the confirmation link.';
    }
    if (message.includes('User already registered') || message.includes('already registered')) {
      return 'An account with this email address already exists. Please sign in instead.';
    }
    if (message.includes('Password should be at least')) {
      return 'Password must be at least 6 characters long.';
    }
    if (message.includes('rate limit') || message.includes('Too many requests')) {
      return 'Too many authentication attempts. Please wait a moment before trying again.';
    }
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return 'Unable to reach the authentication service. Please check your network connection.';
    }

    return message;
  }

  /**
   * Authenticate an existing operator with email and password.
   */
  public static async signIn({ email, password }: AuthCredentials): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error(this.formatAuthError(error));
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  /**
   * Register a new operator account with email and password.
   * Detects whether email confirmation is required by project policy.
   */
  public static async signUp({ email, password }: AuthCredentials): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: email.split('@')[0],
        },
      },
    });

    if (error) {
      throw new Error(this.formatAuthError(error));
    }

    // In Supabase, if email confirmation is required, session is null
    const requiresEmailVerification = Boolean(
      data.user && !data.session && (data.user.identities?.length ?? 0) > 0
    );

    return {
      user: data.user,
      session: data.session,
      requiresEmailVerification,
    };
  }

  /**
   * Terminate the active user session.
   */
  public static async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(this.formatAuthError(error));
    }
  }

  /**
   * Fetch the current active session.
   */
  public static async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(this.formatAuthError(error));
    }
    return data.session;
  }

  /**
   * Subscribe to Supabase auth state changes.
   * Returns an unsubscribe callback for proper cleanup.
   */
  public static onAuthStateChange(
    callback: (event: string, session: Session | null) => void
  ): () => void {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }
}
