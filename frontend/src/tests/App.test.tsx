import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { App } from '../app/App';
import { useAuthStore } from '../features/auth/useAuthStore';
import { supabase } from '../services/supabase';

import type { User, Session } from '@supabase/supabase-js';

// Mock WebGL canvas viewport in headless test environment
vi.mock('../three/scene/DataCenterViewport', () => ({
  DataCenterViewport: () => (
    <div data-testid="datacenter-viewport-mock">3D LIVING DC VIEWPORT MOCK (HEADLESS TEST)</div>
  ),
}));

// Mock Recharts ResponsiveContainer to avoid 0 width/height in jsdom
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

// Mock Supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn(),
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

describe('DATAVERSE Application Shell', () => {
  const mockUser = {
    id: 'usr-1',
    email: 'vyomshah2021@gmail.com',
    user_metadata: { display_name: 'vyomshah' },
  };
  const mockSession = {
    access_token: 'test-token',
    user: mockUser,
  };

  beforeEach(() => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession as unknown as Session },
      error: null,
    });

    useAuthStore.setState({
      isAuthenticated: true,
      isInitializing: false,
      user: mockUser as unknown as User,
      session: mockSession as unknown as Session,
    });
  });

  it('renders application header brand and version indicator', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('DATAVERSE')).toBeInTheDocument();
    expect(screen.getByText(/3D LIVING DATA CENTER SIMULATOR/i)).toBeInTheDocument();
  });

  it('renders operations navigation sidebar items', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByRole('link', { name: /Command Center/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Data Centers/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Simulations/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Monitoring/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Incidents/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
  });

  it('renders command center live telemetry cards and viewport', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('ACTIVE HARDWARE')).toBeInTheDocument();
    expect(screen.getByText('THROUGHPUT')).toBeInTheDocument();
    expect(screen.getByText('NETWORK LATENCY')).toBeInTheDocument();
    expect(screen.getByTestId('datacenter-viewport-mock')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to the login route', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    useAuthStore.setState({
      isAuthenticated: false,
      isInitializing: false,
      user: null,
      session: null,
    });

    await act(async () => {
      render(<App />);
    });
    expect(screen.getByRole('button', { name: /Operator Sign In/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Authenticate Console/i })).toBeInTheDocument();
  });
});
