import { create } from 'zustand';
import type { AuthState, UserProfile, UserRole } from './types';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';

const DEMO_USER: UserProfile = {
  id: 'usr_demo_4f3a9b1c',
  email: 'vyomshah2021@gmail.com',
  displayName: 'vyomshah',
  role: 'admin',
  createdAt: '2026-11-07T08:00:00Z',
};

export const useAuthStore = create<AuthState>((set) => ({
  user: DEMO_USER, // Default to demo session for instant local readiness
  token: 'demo-bearer-token-signed-local',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  authMode: 'demo',
  isAuthModalOpen: false,

  openAuthModal: () => set({ isAuthModalOpen: true, error: null }),
  closeAuthModal: () => set({ isAuthModalOpen: false, error: null }),
  clearError: () => set({ error: null }),

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    if (!isSupabaseConfigured || !supabase) {
      // Offline/Dev fallback mode
      if (password.length < 6) {
        set({
          isLoading: false,
          error: 'Password must be at least 6 characters in development mode.',
        });
        return false;
      }

      const role: UserRole = email.includes('admin')
        ? 'admin'
        : email.includes('operator')
          ? 'operator'
          : 'viewer';

      const userProfile: UserProfile = {
        id: `usr_${Math.random().toString(36).substring(2, 10)}`,
        email,
        displayName: email.split('@')[0] || 'Operator',
        role,
        createdAt: new Date().toISOString(),
      };

      set({
        user: userProfile,
        token: `dev-token-${userProfile.id}`,
        isAuthenticated: true,
        isLoading: false,
        authMode: 'demo',
        isAuthModalOpen: false,
        error: null,
      });
      return true;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        return false;
      }

      if (data.user && data.session) {
        const metadataRole = (data.user.user_metadata?.role as UserRole) || 'operator';
        const userProfile: UserProfile = {
          id: data.user.id,
          email: data.user.email || email,
          displayName:
            data.user.user_metadata?.full_name ||
            (data.user.email ? data.user.email.split('@')[0] : 'Operator'),
          role: metadataRole,
          createdAt: data.user.created_at,
        };

        set({
          user: userProfile,
          token: data.session.access_token,
          isAuthenticated: true,
          isLoading: false,
          authMode: 'supabase',
          isAuthModalOpen: false,
          error: null,
        });
        return true;
      }

      set({ isLoading: false, error: 'Authentication failed: No session returned.' });
      return false;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown authentication error';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  signUp: async (email: string, password: string, role: UserRole = 'operator') => {
    set({ isLoading: true, error: null });

    if (!isSupabaseConfigured || !supabase) {
      if (password.length < 6) {
        set({
          isLoading: false,
          error: 'Password must be at least 6 characters.',
        });
        return false;
      }

      const userProfile: UserProfile = {
        id: `usr_${Math.random().toString(36).substring(2, 10)}`,
        email,
        displayName: email.split('@')[0] || 'Operator',
        role,
        createdAt: new Date().toISOString(),
      };

      set({
        user: userProfile,
        token: `dev-token-${userProfile.id}`,
        isAuthenticated: true,
        isLoading: false,
        authMode: 'demo',
        isAuthModalOpen: false,
        error: null,
      });
      return true;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            full_name: email.split('@')[0],
          },
        },
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        return false;
      }

      if (data.user) {
        const userProfile: UserProfile = {
          id: data.user.id,
          email: data.user.email || email,
          displayName: email.split('@')[0] || 'Operator',
          role,
          createdAt: data.user.created_at,
        };

        set({
          user: userProfile,
          token: data.session?.access_token || null,
          isAuthenticated: Boolean(data.session),
          isLoading: false,
          authMode: 'supabase',
          isAuthModalOpen: false,
          error: null,
        });
        return true;
      }

      set({ isLoading: false, error: 'Sign up failed.' });
      return false;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown registration error';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  loginAsDemo: (role: UserRole = 'admin') => {
    set({
      user: {
        ...DEMO_USER,
        role,
      },
      token: `demo-bearer-token-${role}`,
      isAuthenticated: true,
      authMode: 'demo',
      isAuthModalOpen: false,
      error: null,
    });
  },

  logout: async () => {
    set({ isLoading: true });
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Continue clearing state even if remote signout fails
      }
    }

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  checkSession: async () => {
    if (!isSupabaseConfigured || !supabase) {
      // Retain current session or default demo
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (data.session && data.session.user) {
        const user = data.session.user;
        const role = (user.user_metadata?.role as UserRole) || 'operator';
        set({
          user: {
            id: user.id,
            email: user.email || '',
            displayName:
              user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Operator'),
            role,
            createdAt: user.created_at,
          },
          token: data.session.access_token,
          isAuthenticated: true,
          authMode: 'supabase',
        });
      }
    } catch {
      // In case network is down
    }
  },
}));
