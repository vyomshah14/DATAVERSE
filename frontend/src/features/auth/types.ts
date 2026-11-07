export type UserRole = 'admin' | 'operator' | 'viewer';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

export type AuthMode = 'supabase' | 'demo';

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  authMode: AuthMode;
  isAuthModalOpen: boolean;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, role?: UserRole) => Promise<boolean>;
  loginAsDemo: (role?: UserRole) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  clearError: () => void;
}
