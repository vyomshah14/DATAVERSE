import { create } from 'zustand';

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'stopped';

export interface TelemetrySummary {
  activeRacks: number;
  totalServers: number;
  networkThroughputMbps: number;
  maxBandwidthMbps: number;
  avgLatencyMs: number;
  activeRequestsPerSec: number;
  systemHealthPercent: number;
}

interface SimulationState {
  currentTick: number;
  status: SimulationStatus;
  selectedNodeId: string | null;
  seed: string;
  telemetry: TelemetrySummary;
  activeWorkspace: string;
  // Actions
  setTick: (tick: number) => void;
  setStatus: (status: SimulationStatus) => void;
  setSelectedNodeId: (id: string | null) => void;
  setActiveWorkspace: (workspace: string) => void;
  resetSimulation: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  currentTick: 0,
  status: 'idle',
  selectedNodeId: null,
  seed: '0x4f3a9b1c7e8d2f10',
  activeWorkspace: 'US-East Production (DC-01)',
  telemetry: {
    activeRacks: 4,
    totalServers: 16,
    networkThroughputMbps: 42.5,
    maxBandwidthMbps: 85.0,
    avgLatencyMs: 1.18,
    activeRequestsPerSec: 128,
    systemHealthPercent: 99.98,
  },
  setTick: (tick) => set({ currentTick: tick }),
  setStatus: (status) => set({ status }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  resetSimulation: () =>
    set({
      currentTick: 0,
      status: 'idle',
      selectedNodeId: null,
    }),
}));
