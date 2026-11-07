/**
 * DATAVERSE Topology Data Models & Type Definitions.
 * Conforms to DATAVERSE PRD v2.0 and Day 3 Task 06A requirements.
 */

import type { VALID_NODE_TYPES, VALID_NODE_STATUSES, VALID_LINK_STATUSES } from './constants';

export type TopologyNodeType = (typeof VALID_NODE_TYPES)[number];
export type TopologyNodeStatus = (typeof VALID_NODE_STATUSES)[number];
export type TopologyLinkStatus = (typeof VALID_LINK_STATUSES)[number];

export type Position3D = [number, number, number];

/**
 * Server compute & memory configuration.
 */
export interface ServerConfiguration {
  vcpu: number;
  ram_gb: number;
  ram_mb?: number;
  storage_gb?: number;
  ip_address?: string;
  mac_address?: string;
}

/**
 * Network forwarding device (Router, Core Switch, Access Switch) configuration.
 */
export interface NetworkDeviceConfiguration {
  switching_capacity_gbps?: number;
  ports_count?: number;
  ip_address?: string;
  mac_address?: string;
  assigned_rack_ids?: string[];
}

/**
 * Physical server rack grouping configuration.
 */
export interface RackConfiguration {
  total_u: number;
  server_capacity?: number;
  assigned_access_switch_id?: string;
  server_ids?: string[];
}

export type NodeConfiguration =
  ServerConfiguration | NetworkDeviceConfiguration | RackConfiguration | Record<string, unknown>;

/**
 * Strongly typed Topology Node.
 * Supports snake_case and camelCase property access for parent references.
 */
export interface TopologyNode {
  id: string;
  type: TopologyNodeType;
  name: string;
  parent_id?: string | null;
  parentId?: string | null;
  status: TopologyNodeStatus;
  configuration: NodeConfiguration;
  position?: Position3D;
}

/**
 * Strongly typed Topology Link.
 * Represents bidirectional network connectivity between two forwarding nodes.
 * Supports snake_case and camelCase property access.
 */
export interface TopologyLink {
  id: string;
  source_id: string;
  target_id: string;
  sourceId?: string;
  targetId?: string;
  bandwidth_mbps: number;
  bandwidthMbps?: number;
  latency_ms: number;
  latencyMs?: number;
  status: TopologyLinkStatus;
}

/**
 * Complete Data Center Topology Graph representation.
 */
export interface Topology {
  nodes: TopologyNode[];
  links: TopologyLink[];
}

/**
 * Stable validation error codes for programmatic handling and logging.
 */
export const TopologyErrorCode = {
  // Operation & Mutation Error Codes (Task 06C)
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  LINK_NOT_FOUND: 'LINK_NOT_FOUND',
  INVALID_NODE_NAME: 'INVALID_NODE_NAME',
  RACK_CONTAINS_SERVERS: 'RACK_CONTAINS_SERVERS',
  CANNOT_REMOVE_CONTAINED_SERVER: 'CANNOT_REMOVE_CONTAINED_SERVER',
  OPERATION_FAILED: 'OPERATION_FAILED',

  // General Invariants
  DUPLICATE_NODE_ID: 'DUPLICATE_NODE_ID',
  DUPLICATE_LINK_ID: 'DUPLICATE_LINK_ID',
  DUPLICATE_LINK_CONNECTION: 'DUPLICATE_LINK_CONNECTION',
  SELF_REFERENCING_LINK: 'SELF_REFERENCING_LINK',
  MISSING_LINK_ENDPOINT: 'MISSING_LINK_ENDPOINT',
  INVALID_NODE_TYPE: 'INVALID_NODE_TYPE',
  INVALID_NODE_STATUS: 'INVALID_NODE_STATUS',
  INVALID_LINK_STATUS: 'INVALID_LINK_STATUS',
  INVALID_PARENT_REFERENCE: 'INVALID_PARENT_REFERENCE',
  INVALID_PARENT_RELATIONSHIP: 'INVALID_PARENT_RELATIONSHIP',
  RACK_HAS_NETWORK_LINK: 'RACK_HAS_NETWORK_LINK',
  INVALID_BANDWIDTH: 'INVALID_BANDWIDTH',
  INVALID_LATENCY: 'INVALID_LATENCY',
  INVALID_SERVER_CONFIG: 'INVALID_SERVER_CONFIG',

  // Starter Topology Specific Invariants
  STARTER_NODE_COUNT_MISMATCH: 'STARTER_NODE_COUNT_MISMATCH',
  STARTER_ROUTER_COUNT_MISMATCH: 'STARTER_ROUTER_COUNT_MISMATCH',
  STARTER_CORE_SWITCH_COUNT_MISMATCH: 'STARTER_CORE_SWITCH_COUNT_MISMATCH',
  STARTER_ACCESS_SWITCH_COUNT_MISMATCH: 'STARTER_ACCESS_SWITCH_COUNT_MISMATCH',
  STARTER_RACK_COUNT_MISMATCH: 'STARTER_RACK_COUNT_MISMATCH',
  STARTER_SERVER_COUNT_MISMATCH: 'STARTER_SERVER_COUNT_MISMATCH',
  STARTER_SERVER_DISTRIBUTION_MISMATCH: 'STARTER_SERVER_DISTRIBUTION_MISMATCH',
  STARTER_LINK_COUNT_MISMATCH: 'STARTER_LINK_COUNT_MISMATCH',
  STARTER_MISSING_CONNECTION: 'STARTER_MISSING_CONNECTION',
  STARTER_LINK_BANDWIDTH_MISMATCH: 'STARTER_LINK_BANDWIDTH_MISMATCH',
  STARTER_SERVER_CONFIG_MISMATCH: 'STARTER_SERVER_CONFIG_MISMATCH',
} as const;

export type TopologyValidationErrorCode =
  (typeof TopologyErrorCode)[keyof typeof TopologyErrorCode];

export interface ValidationError {
  code: TopologyValidationErrorCode;
  message: string;
  nodeId?: string;
  linkId?: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Operation parameter and result types for deterministic topology editing (Task 06C).
 */
export interface TopologyOperationSuccess {
  success: true;
  topology: Topology;
  affectedNodeIds: string[];
  affectedLinkIds: string[];
}

export interface TopologyOperationFailure {
  success: false;
  error: {
    code: TopologyValidationErrorCode;
    message: string;
    nodeId?: string;
    linkId?: string;
    field?: string;
    details?: Record<string, unknown>;
  };
  errors?: ValidationError[];
  topology: Topology;
}

export type TopologyOperationResult = TopologyOperationSuccess | TopologyOperationFailure;

export interface AddNodeParams {
  id: string;
  type: TopologyNodeType;
  name: string;
  parent_id?: string | null;
  parentId?: string | null;
  status?: TopologyNodeStatus;
  configuration?: NodeConfiguration;
  position?: Position3D;
}

export interface RemoveNodeOptions {
  cascadeChildren?: boolean;
}

export interface AddLinkParams {
  id: string;
  source_id: string;
  target_id: string;
  sourceId?: string;
  targetId?: string;
  bandwidth_mbps: number;
  bandwidthMbps?: number;
  latency_ms?: number;
  latencyMs?: number;
  status?: TopologyLinkStatus;
}

export interface UpdateLinkMetricsParams {
  bandwidth_mbps?: number;
  latency_ms?: number;
}
