import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { App } from '../app/App';

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

describe('DATAVERSE Application Shell', () => {
  it('renders application header brand and version indicator', () => {
    render(<App />);
    expect(screen.getByText('DATAVERSE')).toBeInTheDocument();
    expect(screen.getByText('3D LIVING DATA CENTER SIMULATOR')).toBeInTheDocument();
  });

  it('renders operations navigation sidebar items', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /Command Center/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Data Centers/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Simulations/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Monitoring/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Incidents/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
  });

  it('renders command center live telemetry cards and viewport', () => {
    render(<App />);
    expect(screen.getByText('ACTIVE HARDWARE')).toBeInTheDocument();
    expect(screen.getByText('THROUGHPUT')).toBeInTheDocument();
    expect(screen.getByText('NETWORK LATENCY')).toBeInTheDocument();
    expect(screen.getByTestId('datacenter-viewport-mock')).toBeInTheDocument();
  });
});
