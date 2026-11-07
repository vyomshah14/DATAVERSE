import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { AuthService } from '../../services/authService';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  successMessage: string | null;

  // Actions
  initialize: () => Promise<void>;
  cleanup: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  clearSuccessMessage: () => void;
}

// Module-level reference to prevent duplicate listener registrations
let unsubscribeAuthListener: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true,
  error: null,
  successMessage: null,

  clearError: () => set({ error: null }),
  clearSuccessMessage: () => set({ successMessage: null }),

  initialize: async () => {
    // Prevent duplicate listener registrations
    if (unsubscribeAuthListener) {
      return;
    }

    try {
      // 1. Subscribe to auth events (SIGN_IN, SIGN_OUT, TOKEN_REFRESHED)
      unsubscribeAuthListener = AuthService.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user ?? null,
          isAuthenticated: Boolean(session?.user),
          isInitializing: false,
        });
      });

      // 2. Fetch existing session from Supabase storage
      const session = await AuthService.getSession();
      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: Boolean(session?.user),
        isInitializing: false,
      });
    } catch (err: unknown) {
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isInitializing: false,
        error: AuthService.formatAuthError(err),
      });
    }
  },

  cleanup: () => {
    if (unsubscribeAuthListener) {
      unsubscribeAuthListener();
      unsubscribeAuthListener = null;
    }
  },

  login: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null, successMessage: null });

    try {
      const { user, session } = await AuthService.signIn({ email, password });
      set({
        user,
        session,
        isAuthenticated: Boolean(user),
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      const formatted = AuthService.formatAuthError(err);
      set({
        isLoading: false,
        error: formatted,
      });
      return false;
    }
  },

  signUp: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null, successMessage: null });

    try {
      const { user, session, requiresEmailVerification } = await AuthService.signUp({
        email,
        password,
      });

      if (requiresEmailVerification) {
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
          successMessage:
            'Registration successful! Please check your email to confirm your account before signing in.',
        });
        return true;
      }

      set({
        user,
        session,
        isAuthenticated: Boolean(user && session),
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      const formatted = AuthService.formatAuthError(err);
      set({
        isLoading: false,
        error: formatted,
      });
      return false;
    }
  },

  logout: async (): Promise<void> => {
    set({ isLoading: true });
    try {
      await AuthService.signOut();
    } catch {
      // Proceed with local state clearing even if remote signOut fails
    } finally {
      get().cleanup();
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        successMessage: null,
      });
      // Re-initialize listener for future sessions
      get().initialize();
    }
  },
}));

if (typeof window !== 'undefined') {
  (window as unknown as { useAuthStore: typeof useAuthStore }).useAuthStore = useAuthStore;
}
