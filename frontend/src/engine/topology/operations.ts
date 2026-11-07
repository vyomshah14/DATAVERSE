/**
 * Pure Deterministic Topology Editing Operations for DATAVERSE.
 * Adheres strictly to PRD v2.0, DECISION-001, and DECISION-002.
 *
 * All operations:
 * - Are pure functions: they never mutate input topologies.
 * - Return structured results (TopologyOperationResult) with stable error codes.
 * - Enforce all architectural invariants (e.g. Racks are spatial containers, not forwarding devices).
 * - Maintain deterministic repeatability: identical inputs yield identical outputs without Math.random() or timestamps.
 */

import { TopologyErrorCode } from './types';
import type {
  Topology,
  TopologyNode,
  TopologyNodeStatus,
  TopologyLinkStatus,
  TopologyOperationResult,
  AddNodeParams,
  RemoveNodeOptions,
  AddLinkParams,
  UpdateLinkMetricsParams,
  NodeConfiguration,
  ServerConfiguration,
  Position3D,
} from './types';
import {
  VALID_NODE_TYPES,
  VALID_NODE_STATUSES,
  VALID_LINK_STATUSES,
  TOPOLOGY_DEFAULTS,
} from './constants';
import { validateTopology, getCanonicalLinkKey } from './validator';

/**
 * Creates a clean, deep copy of a topology without mutating original references.
 */
export function cloneTopology(topology: Topology): Topology {
  return {
    nodes: (topology.nodes || []).map((n) => ({
      ...n,
      position: n.position ? ([...n.position] as Position3D) : undefined,
      configuration:
        typeof n.configuration === 'object' && n.configuration !== null
          ? JSON.parse(JSON.stringify(n.configuration))
          : n.configuration,
    })),
    links: (topology.links || []).map((l) => ({ ...l })),
  };
}

/**
 * Renames an existing hardware node.
 * Preserves node ID, configuration, links, and operational status.
 */
export function renameNode(
  topology: Topology,
  nodeId: string,
  newName: string
): TopologyOperationResult {
  if (!nodeId || typeof nodeId !== 'string' || nodeId.trim() === '') {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.NODE_NOT_FOUND,
        message: 'Invalid node identifier provided.',
      },
      topology,
    };
  }

  if (!newName || typeof newName !== 'string' || newName.trim() === '') {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_NODE_NAME,
        message: 'Node name must be a valid non-empty string.',
        nodeId,
        field: 'name',
      },
      topology,
    };
  }

  const trimmedName = newName.trim();
  if (trimmedName.length > 100) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_NODE_NAME,
        message: 'Node name cannot exceed 100 characters.',
        nodeId,
        field: 'name',
      },
      topology,
    };
  }

  const targetNode = topology.nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.NODE_NOT_FOUND,
        message: `Node '${nodeId}' not found in topology graph.`,
        nodeId,
      },
      topology,
    };
  }

  const newTopology = cloneTopology(topology);
  const clonedTarget = newTopology.nodes.find((n) => n.id === nodeId)!;
  clonedTarget.name = trimmedName;

  const validation = validateTopology(newTopology);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: validation.errors[0]?.code ?? TopologyErrorCode.OPERATION_FAILED,
        message: validation.errors[0]?.message ?? 'Topology validation failed after rename.',
      },
      errors: validation.errors,
      topology,
    };
  }

  return {
    success: true,
    topology: newTopology,
    affectedNodeIds: [nodeId],
    affectedLinkIds: [],
  };
}

/**
 * Adds a new supported hardware node to the topology using an approved template.
 * Supported types: 'server', 'rack', 'access_switch', 'core_switch', 'router'.
 */
export function addNode(topology: Topology, params: AddNodeParams): TopologyOperationResult {
  if (!params.id || typeof params.id !== 'string' || params.id.trim() === '') {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.DUPLICATE_NODE_ID,
        message: 'Node ID must be a valid non-empty string.',
      },
      topology,
    };
  }

  const cleanId = params.id.trim();

  // Check duplicate ID
  if (topology.nodes.some((n) => n.id === cleanId)) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.DUPLICATE_NODE_ID,
        message: `Node with ID '${cleanId}' already exists in topology.`,
        nodeId: cleanId,
      },
      topology,
    };
  }

  // Check valid type
  if (!VALID_NODE_TYPES.includes(params.type)) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_NODE_TYPE,
        message: `Unsupported node type '${params.type}'. Supported types: ${VALID_NODE_TYPES.join(', ')}.`,
        nodeId: cleanId,
        field: 'type',
      },
      topology,
    };
  }

  // Check valid name
  if (!params.name || typeof params.name !== 'string' || params.name.trim() === '') {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_NODE_NAME,
        message: 'Node name must be a valid non-empty string.',
        nodeId: cleanId,
        field: 'name',
      },
      topology,
    };
  }

  // Parent relationship rules
  const parentId = params.parent_id ?? params.parentId ?? null;
  if (params.type === 'server') {
    if (!parentId) {
      return {
        success: false,
        error: {
          code: TopologyErrorCode.INVALID_PARENT_REFERENCE,
          message: `Server '${cleanId}' must declare a valid parent rack ID.`,
          nodeId: cleanId,
          field: 'parent_id',
        },
        topology,
      };
    }

    const parentNode = topology.nodes.find((n) => n.id === parentId);
    if (!parentNode) {
      return {
        success: false,
        error: {
          code: TopologyErrorCode.INVALID_PARENT_REFERENCE,
          message: `Server '${cleanId}' references non-existent parent ID '${parentId}'.`,
          nodeId: cleanId,
          field: 'parent_id',
        },
        topology,
      };
    }

    if (parentNode.type !== 'rack') {
      return {
        success: false,
        error: {
          code: TopologyErrorCode.INVALID_PARENT_RELATIONSHIP,
          message: `Server '${cleanId}' parent '${parentId}' must be of type 'rack', found '${parentNode.type}'.`,
          nodeId: cleanId,
          field: 'parent_id',
        },
        topology,
      };
    }
  } else if (parentId !== null && parentId !== undefined && parentId !== '') {
    // Non-servers cannot have a parent
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_PARENT_RELATIONSHIP,
        message: `Node '${cleanId}' of type '${params.type}' cannot have a parent container.`,
        nodeId: cleanId,
        field: 'parent_id',
      },
      topology,
    };
  }

  // Compute config defaults / validation
  let config: NodeConfiguration = params.configuration ?? {};
  if (params.type === 'server') {
    const srvConfig = (config as Partial<ServerConfiguration>) || {};
    const vcpu = srvConfig.vcpu ?? TOPOLOGY_DEFAULTS.SERVER_VCPU;
    const ramGb = srvConfig.ram_gb ?? TOPOLOGY_DEFAULTS.SERVER_RAM_GB;

    if (typeof vcpu !== 'number' || isNaN(vcpu) || vcpu <= 0) {
      return {
        success: false,
        error: {
          code: TopologyErrorCode.INVALID_SERVER_CONFIG,
          message: `Server '${cleanId}' vCPU must be a positive number.`,
          nodeId: cleanId,
          field: 'configuration.vcpu',
        },
        topology,
      };
    }

    if (typeof ramGb !== 'number' || isNaN(ramGb) || ramGb <= 0) {
      return {
        success: false,
        error: {
          code: TopologyErrorCode.INVALID_SERVER_CONFIG,
          message: `Server '${cleanId}' RAM (GB) must be a positive number.`,
          nodeId: cleanId,
          field: 'configuration.ram_gb',
        },
        topology,
      };
    }

    config = {
      vcpu,
      ram_gb: ramGb,
      ram_mb: ramGb * 1024,
      storage_gb: srvConfig.storage_gb ?? 256,
      ip_address: srvConfig.ip_address,
      mac_address: srvConfig.mac_address,
    };
  } else if (params.type === 'rack') {
    config = {
      total_u: TOPOLOGY_DEFAULTS.RACK_TOTAL_U,
      server_capacity: TOPOLOGY_DEFAULTS.RACK_DEFAULT_SERVERS,
      ...config,
    };
  }

  const newNode: TopologyNode = {
    id: cleanId,
    type: params.type,
    name: params.name.trim(),
    parent_id: parentId,
    parentId,
    status: params.status ?? 'online',
    configuration: config,
    position: params.position,
  };

  const newTopology = cloneTopology(topology);
  newTopology.nodes.push(newNode);

  const validation = validateTopology(newTopology);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: validation.errors[0]?.code ?? TopologyErrorCode.OPERATION_FAILED,
        message: validation.errors[0]?.message ?? 'Topology validation failed after adding node.',
      },
      errors: validation.errors,
      topology,
    };
  }

  return {
    success: true,
    topology: newTopology,
    affectedNodeIds: [cleanId],
    affectedLinkIds: [],
  };
}

/**
 * Removes an existing hardware node with safe cascading of dependent links and child relationships.
 * If removing a Rack:
 * - If cascadeChildren is true: removes contained servers and their links.
 * - If cascadeChildren is false and servers exist: safely rejects with RACK_CONTAINS_SERVERS.
 */
export function removeNode(
  topology: Topology,
  nodeId: string,
  options: RemoveNodeOptions = {}
): TopologyOperationResult {
  if (!nodeId || typeof nodeId !== 'string') {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.NODE_NOT_FOUND,
        message: 'Invalid node identifier provided.',
      },
      topology,
    };
  }

  const targetNode = topology.nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.NODE_NOT_FOUND,
        message: `Node '${nodeId}' not found in topology graph.`,
        nodeId,
      },
      topology,
    };
  }

  // Find child servers if this node is a rack
  const childServers =
    targetNode.type === 'rack'
      ? topology.nodes.filter((n) => n.parent_id === nodeId || n.parentId === nodeId)
      : [];

  if (childServers.length > 0 && !options.cascadeChildren) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.RACK_CONTAINS_SERVERS,
        message: `Cannot remove rack '${nodeId}' because it contains ${childServers.length} server blades. Reassign or remove servers first, or pass cascadeChildren: true.`,
        nodeId,
        details: { childServerIds: childServers.map((s) => s.id) },
      },
      topology,
    };
  }

  const nodesToRemove = new Set<string>([nodeId]);
  if (options.cascadeChildren) {
    for (const child of childServers) {
      nodesToRemove.add(child.id);
    }
  }

  // Identify all dependent links that must be cascade-removed to prevent dangling endpoints
  const affectedLinkIds: string[] = [];
  const survivingLinks = topology.links.filter((l) => {
    const src = l.source_id ?? l.sourceId ?? '';
    const tgt = l.target_id ?? l.targetId ?? '';
    if (nodesToRemove.has(src) || nodesToRemove.has(tgt)) {
      affectedLinkIds.push(l.id);
      return false;
    }
    return true;
  });

  const survivingNodes = topology.nodes.filter((n) => !nodesToRemove.has(n.id));

  const newTopology: Topology = {
    nodes: survivingNodes.map((n) => ({
      ...n,
      position: n.position ? ([...n.position] as Position3D) : undefined,
      configuration:
        typeof n.configuration === 'object' && n.configuration !== null
          ? JSON.parse(JSON.stringify(n.configuration))
          : n.configuration,
    })),
    links: survivingLinks.map((l) => ({ ...l })),
  };

  const validation = validateTopology(newTopology);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: validation.errors[0]?.code ?? TopologyErrorCode.OPERATION_FAILED,
        message: validation.errors[0]?.message ?? 'Topology validation failed after removing node.',
      },
      errors: validation.errors,
      topology,
    };
  }

  return {
    success: true,
    topology: newTopology,
    affectedNodeIds: Array.from(nodesToRemove),
    affectedLinkIds,
  };
}

/**
 * Updates configuration fields on an existing node.
 */
export function updateNodeConfiguration(
  topology: Topology,
  nodeId: string,
  configUpdate: Partial<NodeConfiguration>
): TopologyOperationResult {
  const targetNode = topology.nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.NODE_NOT_FOUND,
        message: `Node '${nodeId}' not found in topology graph.`,
        nodeId,
      },
      topology,
    };
  }

  // Server compute config validation
  if (targetNode.type === 'server') {
    const srvUpdate = configUpdate as Partial<ServerConfiguration>;
    if (
      srvUpdate.vcpu !== undefined &&
      (typeof srvUpdate.vcpu !== 'number' || srvUpdate.vcpu <= 0)
    ) {
      return {
        success: false,
        error: {
          code: TopologyErrorCode.INVALID_SERVER_CONFIG,
          message: `Server '${nodeId}' vCPU must be a positive number.`,
          nodeId,
          field: 'vcpu',
        },
        topology,
      };
    }
    if (
      srvUpdate.ram_gb !== undefined &&
      (typeof srvUpdate.ram_gb !== 'number' || srvUpdate.ram_gb <= 0)
    ) {
      return {
        success: false,
        error: {
          code: TopologyErrorCode.INVALID_SERVER_CONFIG,
          message: `Server '${nodeId}' RAM (GB) must be a positive number.`,
          nodeId,
          field: 'ram_gb',
        },
        topology,
      };
    }
  }

  const newTopology = cloneTopology(topology);
  const target = newTopology.nodes.find((n) => n.id === nodeId)!;
  const existingConfig = (target.configuration || {}) as Record<string, unknown>;

  target.configuration = {
    ...existingConfig,
    ...configUpdate,
  };

  // If server ram_gb was updated, sync ram_mb
  if (target.type === 'server' && (configUpdate as Partial<ServerConfiguration>).ram_gb) {
    (target.configuration as ServerConfiguration).ram_mb =
      (configUpdate as Partial<ServerConfiguration>).ram_gb! * 1024;
  }

  const validation = validateTopology(newTopology);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: validation.errors[0]?.code ?? TopologyErrorCode.OPERATION_FAILED,
        message: validation.errors[0]?.message ?? 'Topology validation failed after config update.',
      },
      errors: validation.errors,
      topology,
    };
  }

  return {
    success: true,
    topology: newTopology,
    affectedNodeIds: [nodeId],
    affectedLinkIds: [],
  };
}

/**
 * Updates bandwidth and/or latency metrics on an existing network link.
 */
export function updateLinkMetrics(
  topology: Topology,
  linkId: string,
  updates: UpdateLinkMetricsParams
): TopologyOperationResult {
  const targetLink = topology.links.find((l) => l.id === linkId);
  if (!targetLink) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.LINK_NOT_FOUND,
        message: `Link '${linkId}' not found in topology graph.`,
        linkId,
      },
      topology,
    };
  }

  if (updates.bandwidth_mbps !== undefined) {
    if (
      typeof updates.bandwidth_mbps !== 'number' ||
      isNaN(updates.bandwidth_mbps) ||
      updates.bandwidth_mbps <= 0
    ) {
      return {
        success: false,
        error: {
          code: TopologyErrorCode.INVALID_BANDWIDTH,
          message: `Bandwidth must be a positive number, received '${updates.bandwidth_mbps}'.`,
          linkId,
          field: 'bandwidth_mbps',
        },
        topology,
      };
    }
  }

  if (updates.latency_ms !== undefined) {
    if (
      typeof updates.latency_ms !== 'number' ||
      isNaN(updates.latency_ms) ||
      updates.latency_ms < 0
    ) {
      return {
        success: false,
        error: {
          code: TopologyErrorCode.INVALID_LATENCY,
          message: `Latency must be a non-negative number, received '${updates.latency_ms}'.`,
          linkId,
          field: 'latency_ms',
        },
        topology,
      };
    }
  }

  const newTopology = cloneTopology(topology);
  const target = newTopology.links.find((l) => l.id === linkId)!;

  if (updates.bandwidth_mbps !== undefined) {
    target.bandwidth_mbps = updates.bandwidth_mbps;
    target.bandwidthMbps = updates.bandwidth_mbps;
  }

  if (updates.latency_ms !== undefined) {
    target.latency_ms = updates.latency_ms;
    target.latencyMs = updates.latency_ms;
  }

  const validation = validateTopology(newTopology);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: validation.errors[0]?.code ?? TopologyErrorCode.OPERATION_FAILED,
        message: validation.errors[0]?.message ?? 'Topology validation failed after link update.',
      },
      errors: validation.errors,
      topology,
    };
  }

  return {
    success: true,
    topology: newTopology,
    affectedNodeIds: [],
    affectedLinkIds: [linkId],
  };
}

/**
 * Changes a node's operational status.
 * Permitted statuses: 'online', 'degraded', 'offline', 'rebooting'.
 */
export function updateNodeStatus(
  topology: Topology,
  nodeId: string,
  newStatus: TopologyNodeStatus
): TopologyOperationResult {
  const targetNode = topology.nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.NODE_NOT_FOUND,
        message: `Node '${nodeId}' not found in topology graph.`,
        nodeId,
      },
      topology,
    };
  }

  if (!VALID_NODE_STATUSES.includes(newStatus)) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_NODE_STATUS,
        message: `Invalid node status '${newStatus}'. Permitted statuses: ${VALID_NODE_STATUSES.join(', ')}.`,
        nodeId,
        field: 'status',
      },
      topology,
    };
  }

  const newTopology = cloneTopology(topology);
  const target = newTopology.nodes.find((n) => n.id === nodeId)!;
  target.status = newStatus;

  const validation = validateTopology(newTopology);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: validation.errors[0]?.code ?? TopologyErrorCode.OPERATION_FAILED,
        message: validation.errors[0]?.message ?? 'Topology validation failed after status change.',
      },
      errors: validation.errors,
      topology,
    };
  }

  return {
    success: true,
    topology: newTopology,
    affectedNodeIds: [nodeId],
    affectedLinkIds: [],
  };
}

/**
 * Changes a network link's operational status.
 * Permitted statuses: 'online', 'degraded', 'severed'.
 */
export function updateLinkStatus(
  topology: Topology,
  linkId: string,
  newStatus: TopologyLinkStatus
): TopologyOperationResult {
  const targetLink = topology.links.find((l) => l.id === linkId);
  if (!targetLink) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.LINK_NOT_FOUND,
        message: `Link '${linkId}' not found in topology graph.`,
        linkId,
      },
      topology,
    };
  }

  if (!VALID_LINK_STATUSES.includes(newStatus)) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_LINK_STATUS,
        message: `Invalid link status '${newStatus}'. Permitted statuses: ${VALID_LINK_STATUSES.join(', ')}.`,
        linkId,
        field: 'status',
      },
      topology,
    };
  }

  const newTopology = cloneTopology(topology);
  const target = newTopology.links.find((l) => l.id === linkId)!;
  target.status = newStatus;

  const validation = validateTopology(newTopology);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: validation.errors[0]?.code ?? TopologyErrorCode.OPERATION_FAILED,
        message:
          validation.errors[0]?.message ?? 'Topology validation failed after link status update.',
      },
      errors: validation.errors,
      topology,
    };
  }

  return {
    success: true,
    topology: newTopology,
    affectedNodeIds: [],
    affectedLinkIds: [linkId],
  };
}

/**
 * Adds a new network forwarding link between two network devices or servers.
 * Enforces PRD v2.0 invariants:
 * - Neither endpoint may be a physical Rack (DECISION-001).
 * - No self-referencing links.
 * - No duplicate bidirectional links between the same pair of nodes.
 */
export function addLink(topology: Topology, params: AddLinkParams): TopologyOperationResult {
  if (!params.id || typeof params.id !== 'string' || params.id.trim() === '') {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.DUPLICATE_LINK_ID,
        message: 'Link ID must be a valid non-empty string.',
      },
      topology,
    };
  }

  const cleanLinkId = params.id.trim();

  // Check duplicate link ID
  if (topology.links.some((l) => l.id === cleanLinkId)) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.DUPLICATE_LINK_ID,
        message: `Link with ID '${cleanLinkId}' already exists in topology.`,
        linkId: cleanLinkId,
      },
      topology,
    };
  }

  const sourceId = (params.source_id ?? params.sourceId ?? '').trim();
  const targetId = (params.target_id ?? params.targetId ?? '').trim();

  if (sourceId === targetId) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.SELF_REFERENCING_LINK,
        message: `Link '${cleanLinkId}' connects node '${sourceId}' to itself. Self-referencing links are invalid.`,
        linkId: cleanLinkId,
      },
      topology,
    };
  }

  const sourceNode = topology.nodes.find((n) => n.id === sourceId);
  const targetNode = topology.nodes.find((n) => n.id === targetId);

  if (!sourceNode) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.MISSING_LINK_ENDPOINT,
        message: `Source node '${sourceId}' does not exist in topology graph.`,
        linkId: cleanLinkId,
        field: 'source_id',
      },
      topology,
    };
  }

  if (!targetNode) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.MISSING_LINK_ENDPOINT,
        message: `Target node '${targetId}' does not exist in topology graph.`,
        linkId: cleanLinkId,
        field: 'target_id',
      },
      topology,
    };
  }

  // Disallow Racks in network links (PRD v2.0 DECISION-001)
  if (sourceNode.type === 'rack') {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.RACK_HAS_NETWORK_LINK,
        message: `Rack '${sourceId}' cannot be a network link endpoint. Racks are spatial containers, not forwarding devices.`,
        linkId: cleanLinkId,
        nodeId: sourceId,
      },
      topology,
    };
  }

  if (targetNode.type === 'rack') {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.RACK_HAS_NETWORK_LINK,
        message: `Rack '${targetId}' cannot be a network link endpoint. Racks are spatial containers, not forwarding devices.`,
        linkId: cleanLinkId,
        nodeId: targetId,
      },
      topology,
    };
  }

  // Check duplicate bidirectional connection
  const newCanonicalKey = getCanonicalLinkKey(sourceId, targetId);
  for (const existingLink of topology.links) {
    const exSrc = existingLink.source_id ?? existingLink.sourceId ?? '';
    const exTgt = existingLink.target_id ?? existingLink.targetId ?? '';
    if (getCanonicalLinkKey(exSrc, exTgt) === newCanonicalKey) {
      return {
        success: false,
        error: {
          code: TopologyErrorCode.DUPLICATE_LINK_CONNECTION,
          message: `A network link between '${sourceId}' and '${targetId}' already exists (${existingLink.id}).`,
          linkId: cleanLinkId,
        },
        topology,
      };
    }
  }

  const bw = params.bandwidth_mbps ?? params.bandwidthMbps;
  if (typeof bw !== 'number' || isNaN(bw) || bw <= 0) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_BANDWIDTH,
        message: `Bandwidth must be a positive number, received '${bw}'.`,
        linkId: cleanLinkId,
        field: 'bandwidth_mbps',
      },
      topology,
    };
  }

  const lat = params.latency_ms ?? params.latencyMs ?? TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS;
  if (typeof lat !== 'number' || isNaN(lat) || lat < 0) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_LATENCY,
        message: `Latency must be a non-negative number, received '${lat}'.`,
        linkId: cleanLinkId,
        field: 'latency_ms',
      },
      topology,
    };
  }

  const newLink = {
    id: cleanLinkId,
    source_id: sourceId,
    target_id: targetId,
    sourceId,
    targetId,
    bandwidth_mbps: bw,
    bandwidthMbps: bw,
    latency_ms: lat,
    latencyMs: lat,
    status: params.status ?? 'online',
  };

  const newTopology = cloneTopology(topology);
  newTopology.links.push(newLink);

  const validation = validateTopology(newTopology);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: validation.errors[0]?.code ?? TopologyErrorCode.OPERATION_FAILED,
        message: validation.errors[0]?.message ?? 'Topology validation failed after adding link.',
      },
      errors: validation.errors,
      topology,
    };
  }

  return {
    success: true,
    topology: newTopology,
    affectedNodeIds: [sourceId, targetId],
    affectedLinkIds: [cleanLinkId],
  };
}

/**
 * Removes an existing network link.
 */
export function removeLink(topology: Topology, linkId: string): TopologyOperationResult {
  const targetLink = topology.links.find((l) => l.id === linkId);
  if (!targetLink) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.LINK_NOT_FOUND,
        message: `Link '${linkId}' not found in topology graph.`,
        linkId,
      },
      topology,
    };
  }

  const newTopology = cloneTopology(topology);
  newTopology.links = newTopology.links.filter((l) => l.id !== linkId);

  const validation = validateTopology(newTopology);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: validation.errors[0]?.code ?? TopologyErrorCode.OPERATION_FAILED,
        message: validation.errors[0]?.message ?? 'Topology validation failed after removing link.',
      },
      errors: validation.errors,
      topology,
    };
  }

  return {
    success: true,
    topology: newTopology,
    affectedNodeIds: [
      targetLink.source_id ?? targetLink.sourceId ?? '',
      targetLink.target_id ?? targetLink.targetId ?? '',
    ].filter(Boolean),
    affectedLinkIds: [linkId],
  };
}

/**
 * Reassigns an existing server blade to a different physical rack.
 */
export function reassignServerParent(
  topology: Topology,
  serverId: string,
  newRackId: string
): TopologyOperationResult {
  const targetServer = topology.nodes.find((n) => n.id === serverId);
  if (!targetServer) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.NODE_NOT_FOUND,
        message: `Server '${serverId}' not found in topology graph.`,
        nodeId: serverId,
      },
      topology,
    };
  }

  if (targetServer.type !== 'server') {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_PARENT_RELATIONSHIP,
        message: `Node '${serverId}' is of type '${targetServer.type}'. Only servers may have parent racks.`,
        nodeId: serverId,
      },
      topology,
    };
  }

  const newRack = topology.nodes.find((n) => n.id === newRackId);
  if (!newRack) {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_PARENT_REFERENCE,
        message: `Target rack '${newRackId}' not found in topology graph.`,
        nodeId: serverId,
        field: 'parent_id',
      },
      topology,
    };
  }

  if (newRack.type !== 'rack') {
    return {
      success: false,
      error: {
        code: TopologyErrorCode.INVALID_PARENT_RELATIONSHIP,
        message: `Target node '${newRackId}' is of type '${newRack.type}'. Server parent must be a rack.`,
        nodeId: serverId,
        field: 'parent_id',
      },
      topology,
    };
  }

  const newTopology = cloneTopology(topology);
  const clonedServer = newTopology.nodes.find((n) => n.id === serverId)!;
  clonedServer.parent_id = newRackId;
  clonedServer.parentId = newRackId;

  // Optionally align position X with new rack if defined
  if (newRack.position && clonedServer.position) {
    clonedServer.position[0] = newRack.position[0];
  }

  const validation = validateTopology(newTopology);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: validation.errors[0]?.code ?? TopologyErrorCode.OPERATION_FAILED,
        message:
          validation.errors[0]?.message ?? 'Topology validation failed after server reassignment.',
      },
      errors: validation.errors,
      topology,
    };
  }

  return {
    success: true,
    topology: newTopology,
    affectedNodeIds: [serverId, newRackId],
    affectedLinkIds: [],
  };
}
