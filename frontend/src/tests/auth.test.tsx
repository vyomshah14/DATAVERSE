import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthService } from '../services/authService';
import { useAuthStore } from '../features/auth/useAuthStore';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { LoginPage } from '../features/auth/LoginPage';
import { supabase } from '../services/supabase';

import type { User, Session, AuthError } from '@supabase/supabase-js';

// Mock Supabase Auth methods
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
  validateSupabaseConfig: vi
    .fn()
    .mockReturnValue({ isValid: true, hasUrl: true, hasAnonKey: true }),
  isSupabaseConfigured: true,
  getSupabaseConfig: vi
    .fn()
    .mockReturnValue({ url: 'https://test.supabase.co', anonKey: 'key', isConfigured: true }),
}));

describe('AuthService', () => {
  it('formats Supabase errors into human-readable strings', () => {
    expect(AuthService.formatAuthError(new Error('Invalid login credentials'))).toContain(
      'Invalid email or password'
    );
    expect(AuthService.formatAuthError(new Error('Email not confirmed'))).toContain(
      'has not been confirmed yet'
    );
    expect(AuthService.formatAuthError(new Error('User already registered'))).toContain(
      'already exists'
    );
    expect(
      AuthService.formatAuthError(new Error('Password should be at least 6 characters'))
    ).toContain('at least 6 characters');
    expect(AuthService.formatAuthError(new Error('rate limit exceeded'))).toContain(
      'Too many authentication attempts'
    );
    expect(
      AuthService.formatAuthError(new Error('NetworkError when attempting to fetch resource.'))
    ).toContain('Unable to reach the authentication service');
  });

  it('signs in user with credentials', async () => {
    const mockUser = { id: 'usr-1', email: 'op@dataverse.io' };
    const mockSession = { access_token: 'token-123', user: mockUser };
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: mockUser as unknown as User, session: mockSession as unknown as Session },
      error: null,
    });

    const result = await AuthService.signIn({ email: 'op@dataverse.io', password: 'password123' });
    expect(result.user?.email).toBe('op@dataverse.io');
    expect(result.session?.access_token).toBe('token-123');
  });

  it('detects email verification requirements on signup when session is null', async () => {
    const mockUser = { id: 'usr-2', email: 'new@dataverse.io', identities: [{ id: '1' }] };
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: { user: mockUser as unknown as User, session: null },
      error: null,
    });

    const result = await AuthService.signUp({ email: 'new@dataverse.io', password: 'password123' });
    expect(result.requiresEmailVerification).toBe(true);
    expect(result.session).toBeNull();
  });
});

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: false,
      error: null,
      successMessage: null,
    });
    vi.clearAllMocks();
  });

  it('logs in successfully and sets user state', async () => {
    const mockUser = { id: 'usr-1', email: 'op@dataverse.io' };
    const mockSession = { access_token: 'token-123', user: mockUser };
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: mockUser as unknown as User, session: mockSession as unknown as Session },
      error: null,
    });

    const success = await useAuthStore.getState().login('op@dataverse.io', 'pass12345');
    expect(success).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe('op@dataverse.io');
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('handles login errors and updates error state', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        message: 'Invalid login credentials',
        name: 'AuthError',
        status: 400,
      } as unknown as AuthError,
    });

    const success = await useAuthStore.getState().login('op@dataverse.io', 'wrongpass');
    expect(success).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().error).toContain('Invalid email or password');
  });

  it('logs out and clears user state', async () => {
    useAuthStore.setState({
      user: { id: 'usr-1', email: 'op@dataverse.io' } as unknown as User,
      isAuthenticated: true,
    });
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null });

    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('ProtectedRoute', () => {
  it('renders loading state without flicker when isInitializing is true', () => {
    useAuthStore.setState({ isInitializing: true, isAuthenticated: false });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>SECURE_DASHBOARD_CONTENT</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Restoring Operator Session/i)).toBeInTheDocument();
    expect(screen.queryByText('SECURE_DASHBOARD_CONTENT')).not.toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated and not initializing', () => {
    useAuthStore.setState({ isInitializing: false, isAuthenticated: false });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>LOGIN_PAGE_CONTENT</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>SECURE_DASHBOARD_CONTENT</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('LOGIN_PAGE_CONTENT')).toBeInTheDocument();
    expect(screen.queryByText('SECURE_DASHBOARD_CONTENT')).not.toBeInTheDocument();
  });

  it('renders protected content when authenticated', () => {
    useAuthStore.setState({
      isInitializing: false,
      isAuthenticated: true,
      user: { id: 'usr-1', email: 'op@dataverse.io' } as unknown as User,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>SECURE_DASHBOARD_CONTENT</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('SECURE_DASHBOARD_CONTENT')).toBeInTheDocument();
  });
});

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      isInitializing: false,
      isLoading: false,
      error: null,
      successMessage: null,
    });
  });

  it('renders login tab by default with email and password fields', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Operator Sign In/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('operator@codeversetech.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Authenticate Console/i })).toBeInTheDocument();
  });

  it('switches to Create Account tab and shows confirm password', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(screen.getByRole('button', { name: /Provision Operator Account/i })).toBeInTheDocument();
    expect(screen.getByText(/Confirm Security Passkey/i)).toBeInTheDocument();
  });

  it('validates password mismatch on registration', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    fireEvent.change(screen.getByPlaceholderText('operator@codeversetech.com'), {
      target: { value: 'op@test.com' },
    });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••••••');
    fireEvent.change(passwordInputs[0]!, { target: { value: 'password123' } });
    fireEvent.change(passwordInputs[1]!, { target: { value: 'mismatch456' } });

    fireEvent.click(screen.getByRole('button', { name: /Provision Operator Account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
  });
});
