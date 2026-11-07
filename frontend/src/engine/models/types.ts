/**
 * Core Data Models & Type Definitions for DATAVERSE Simulation Engine.
 * Strict conformance to PRD v2.0 and DECISIONS.md.
 */

export * from '../topology';

export type NodeType = 'router' | 'core_switch' | 'access_switch' | 'server';

export type NodeStatus = 'online' | 'degraded' | 'offline' | 'rebooting';

export interface HardwareSpecs {
  cpuCores: number;
  cpuFrequencyGhz: number;
  memoryMb: number;
  storageMb: number;
}

export interface NetworkNode {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  parentId?: string; // Physical rack parent (does not forward traffic)
  ipAddress: string;
  macAddress: string;
  specs: HardwareSpecs;
  currentCpuLoad: number; // 0.0 to 1.0
  currentMemoryAllocatedMb: number;
}

export interface NetworkLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  bandwidthMbps: number; // Defaults: Router-Core 50, Core-Access 25, Access-Server 10
  latencyMs: number; // Base default: 1ms
  packetLossRate: number; // 0.0 to 1.0
  activeBufferBytes: number;
  maxBufferBytes: number;
  isSevered: boolean;
}

export interface PhysicalRack {
  id: string;
  name: string;
  totalU: number; // Typically 42U
  position: [number, number, number]; // Physical 3D coordinates
  nodeIds: string[]; // Child hardware blades (spatial grouping only)
}

/**
 * Total ordering invariant: ordered by (tick, action_seq).
 * Conforms to DECISIONS.md #004.
 */
export interface SimulationAction {
  tick: number;
  actionSeq: number;
  type:
    | 'CRASH_NODE'
    | 'REBOOT_NODE'
    | 'SEVER_LINK'
    | 'RESTORE_LINK'
    | 'SET_LATENCY'
    | 'INJECT_TRAFFIC_BURST';
  targetId: string;
  payload?: Record<string, unknown>;
}

export interface SimulationCheckpoint {
  checkpointId: string;
  simulationId: string;
  tick: number;
  prngStateHex: string;
  checksumSha256: string; // RFC 8785 canonical bytes hash
  nodes: NetworkNode[];
  links: NetworkLink[];
  createdAt: string;
}
