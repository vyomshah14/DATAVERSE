/**
 * DATAVERSE Topology Constants & PRD v2.0 Defaults.
 * Reference: PRD v2.0 & DECISION-001, DECISION-002.
 */

export const TOPOLOGY_DEFAULTS = {
  // Network Link Bandwidth Defaults (DECISION-002)
  BANDWIDTH_ROUTER_CORE_MBPS: 50,
  BANDWIDTH_CORE_ACCESS_MBPS: 25,
  BANDWIDTH_ACCESS_SERVER_MBPS: 10,

  // Latency
  BASE_LINK_LATENCY_MS: 1,

  // Compute Resources (PRD Section 4)
  SERVER_VCPU: 8,
  SERVER_RAM_GB: 16,
  SERVER_RAM_MB: 16384,

  // Physical Rack Attributes (DECISION-001)
  RACK_TOTAL_U: 42,
  RACK_DEFAULT_SERVERS: 3,

  // Starter Topology Invariant Counts (Task 06A)
  STARTER_COUNTS: {
    ROUTERS: 1,
    CORE_SWITCHES: 1,
    ACCESS_SWITCHES: 2,
    RACKS: 4,
    SERVERS: 12,
    SERVERS_PER_RACK: 3,
    TOTAL_NODES: 20,
    TOTAL_LINKS: 15,
  },
} as const;

export const VALID_NODE_TYPES = [
  'router',
  'core_switch',
  'access_switch',
  'rack',
  'server',
] as const;

export const VALID_NODE_STATUSES = ['online', 'degraded', 'offline', 'rebooting'] as const;

export const VALID_LINK_STATUSES = ['online', 'degraded', 'severed'] as const;
