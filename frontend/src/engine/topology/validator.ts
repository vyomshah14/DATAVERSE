/**
 * Deterministic Topology Validation Engine for DATAVERSE.
 * Pure deterministic validation functions adhering to PRD v2.0 and Task 06A.
 */

import { TopologyErrorCode } from './types';
import type {
  Topology,
  TopologyNode,
  TopologyLink,
  ValidationResult,
  ValidationError,
  ServerConfiguration,
} from './types';
import {
  VALID_NODE_TYPES,
  VALID_NODE_STATUSES,
  VALID_LINK_STATUSES,
  TOPOLOGY_DEFAULTS,
} from './constants';

/**
 * Returns a canonical, order-independent representation of an undirected network link.
 * Prevents duplicate logical links between the same pair of nodes (e.g. A ↔ B and B ↔ A).
 */
export function getCanonicalLinkKey(sourceId: string, targetId: string): string {
  const [first, second] = [sourceId, targetId].sort();
  return `${first}---${second}`;
}

/**
 * Validates general structural and relational integrity of any DATAVERSE topology.
 */
export function validateTopology(topology: Topology): ValidationResult {
  const errors: ValidationError[] = [];

  if (!topology || !Array.isArray(topology.nodes) || !Array.isArray(topology.links)) {
    return {
      valid: false,
      errors: [
        {
          code: TopologyErrorCode.INVALID_NODE_TYPE,
          message: 'Topology must contain valid "nodes" and "links" arrays.',
        },
      ],
    };
  }

  const nodeMap = new Map<string, TopologyNode>();
  const seenNodeIds = new Set<string>();

  // 1. Node Validation
  for (const node of topology.nodes) {
    // 1.1 Node ID integrity & uniqueness
    if (!node.id || typeof node.id !== 'string' || node.id.trim() === '') {
      errors.push({
        code: TopologyErrorCode.DUPLICATE_NODE_ID,
        message: 'Node missing valid non-empty string identifier.',
      });
      continue;
    }

    if (seenNodeIds.has(node.id)) {
      errors.push({
        code: TopologyErrorCode.DUPLICATE_NODE_ID,
        message: `Duplicate node ID detected: '${node.id}'.`,
        nodeId: node.id,
      });
    } else {
      seenNodeIds.add(node.id);
      nodeMap.set(node.id, node);
    }

    // 1.2 Node Type
    if (!VALID_NODE_TYPES.includes(node.type)) {
      errors.push({
        code: TopologyErrorCode.INVALID_NODE_TYPE,
        message: `Node '${node.id}' has unsupported type '${node.type}'. Supported types: ${VALID_NODE_TYPES.join(', ')}.`,
        nodeId: node.id,
        field: 'type',
      });
    }

    // 1.3 Node Status
    if (!VALID_NODE_STATUSES.includes(node.status)) {
      errors.push({
        code: TopologyErrorCode.INVALID_NODE_STATUS,
        message: `Node '${node.id}' has invalid status '${node.status}'.`,
        nodeId: node.id,
        field: 'status',
      });
    }

    // 1.4 Server Compute Specs Validation
    if (node.type === 'server') {
      const config = (node.configuration || {}) as Partial<ServerConfiguration>;
      const vcpu = config.vcpu;
      const ramGb = config.ram_gb;

      if (
        typeof vcpu !== 'number' ||
        isNaN(vcpu) ||
        vcpu <= 0 ||
        typeof ramGb !== 'number' ||
        isNaN(ramGb) ||
        ramGb <= 0
      ) {
        errors.push({
          code: TopologyErrorCode.INVALID_SERVER_CONFIG,
          message: `Server '${node.id}' has invalid compute configuration. vCPU and RAM (GB) must be positive numbers.`,
          nodeId: node.id,
          field: 'configuration',
          details: { vcpu, ram_gb: ramGb },
        });
      }
    }
  }

  // 2. Parent-Child Relationship Validation
  for (const node of topology.nodes) {
    const parentId = node.parent_id ?? node.parentId;

    if (parentId !== undefined && parentId !== null && parentId !== '') {
      const parentNode = nodeMap.get(parentId);

      if (!parentNode) {
        errors.push({
          code: TopologyErrorCode.INVALID_PARENT_REFERENCE,
          message: `Node '${node.id}' references non-existent parent ID '${parentId}'.`,
          nodeId: node.id,
          field: 'parent_id',
        });
      } else {
        // Enforce PRD v2.0 Rule: Only servers may have a parent, and parent MUST be a rack
        if (node.type !== 'server') {
          errors.push({
            code: TopologyErrorCode.INVALID_PARENT_RELATIONSHIP,
            message: `Node '${node.id}' of type '${node.type}' cannot have a parent. Only servers may reside in parent containers.`,
            nodeId: node.id,
            field: 'parent_id',
          });
        } else if (parentNode.type !== 'rack') {
          errors.push({
            code: TopologyErrorCode.INVALID_PARENT_RELATIONSHIP,
            message: `Server '${node.id}' parent '${parentId}' must be of type 'rack', found '${parentNode.type}'.`,
            nodeId: node.id,
            field: 'parent_id',
          });
        }
      }
    }
  }

  // 3. Link Validation
  const seenLinkIds = new Set<string>();
  const seenConnections = new Set<string>();

  for (const link of topology.links) {
    // 3.1 Link ID integrity & uniqueness
    if (!link.id || typeof link.id !== 'string' || link.id.trim() === '') {
      errors.push({
        code: TopologyErrorCode.DUPLICATE_LINK_ID,
        message: 'Link missing valid non-empty string identifier.',
      });
      continue;
    }

    if (seenLinkIds.has(link.id)) {
      errors.push({
        code: TopologyErrorCode.DUPLICATE_LINK_ID,
        message: `Duplicate link ID detected: '${link.id}'.`,
        linkId: link.id,
      });
    } else {
      seenLinkIds.add(link.id);
    }

    const sourceId = link.source_id ?? link.sourceId;
    const targetId = link.target_id ?? link.targetId;

    // 3.2 Self-referencing link
    if (sourceId && targetId && sourceId === targetId) {
      errors.push({
        code: TopologyErrorCode.SELF_REFERENCING_LINK,
        message: `Link '${link.id}' connects node '${sourceId}' to itself. Self-referencing links are invalid.`,
        linkId: link.id,
      });
    }

    // 3.3 Link Endpoint Existence
    const sourceNode = sourceId ? nodeMap.get(sourceId) : undefined;
    const targetNode = targetId ? nodeMap.get(targetId) : undefined;

    if (!sourceNode) {
      errors.push({
        code: TopologyErrorCode.MISSING_LINK_ENDPOINT,
        message: `Link '${link.id}' references non-existent source node '${sourceId}'.`,
        linkId: link.id,
        field: 'source_id',
      });
    }

    if (!targetNode) {
      errors.push({
        code: TopologyErrorCode.MISSING_LINK_ENDPOINT,
        message: `Link '${link.id}' references non-existent target node '${targetId}'.`,
        linkId: link.id,
        field: 'target_id',
      });
    }

    // 3.4 Disallow Racks in network forwarding links (PRD v2.0 DECISION-001)
    if (sourceNode && sourceNode.type === 'rack') {
      errors.push({
        code: TopologyErrorCode.RACK_HAS_NETWORK_LINK,
        message: `Rack '${sourceId}' cannot be a network link endpoint in link '${link.id}'. Racks are spatial grouping containers, not forwarding devices.`,
        linkId: link.id,
        nodeId: sourceId,
      });
    }
    if (targetNode && targetNode.type === 'rack') {
      errors.push({
        code: TopologyErrorCode.RACK_HAS_NETWORK_LINK,
        message: `Rack '${targetId}' cannot be a network link endpoint in link '${link.id}'. Racks are spatial grouping containers, not forwarding devices.`,
        linkId: link.id,
        nodeId: targetId,
      });
    }

    // 3.5 Bidirectional duplicate link check
    if (sourceId && targetId && sourceId !== targetId) {
      const canonicalKey = getCanonicalLinkKey(sourceId, targetId);
      if (seenConnections.has(canonicalKey)) {
        errors.push({
          code: TopologyErrorCode.DUPLICATE_LINK_CONNECTION,
          message: `Duplicate link connection between '${sourceId}' and '${targetId}' in link '${link.id}'. Bidirectional links must only be declared once.`,
          linkId: link.id,
        });
      } else {
        seenConnections.add(canonicalKey);
      }
    }

    // 3.6 Bandwidth Validation
    const bandwidth = link.bandwidth_mbps ?? link.bandwidthMbps;
    if (typeof bandwidth !== 'number' || isNaN(bandwidth) || bandwidth <= 0) {
      errors.push({
        code: TopologyErrorCode.INVALID_BANDWIDTH,
        message: `Link '${link.id}' has invalid bandwidth '${bandwidth}'. Bandwidth must be a positive number.`,
        linkId: link.id,
        field: 'bandwidth_mbps',
      });
    }

    // 3.7 Latency Validation
    const latency = link.latency_ms ?? link.latencyMs;
    if (typeof latency !== 'number' || isNaN(latency) || latency < 0) {
      errors.push({
        code: TopologyErrorCode.INVALID_LATENCY,
        message: `Link '${link.id}' has invalid latency '${latency}'. Latency must be non-negative.`,
        linkId: link.id,
        field: 'latency_ms',
      });
    }

    // 3.8 Link Status Validation
    if (!VALID_LINK_STATUSES.includes(link.status)) {
      errors.push({
        code: TopologyErrorCode.INVALID_LINK_STATUS,
        message: `Link '${link.id}' has invalid status '${link.status}'.`,
        linkId: link.id,
        field: 'status',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates the strict starter topology invariants specified in PRD v2.0:
 * - 1 Router, 1 Core Switch, 2 Access Switches, 4 Racks, 12 Servers (20 total nodes).
 * - Exactly 3 servers grouped into each of the 4 racks via parent_id.
 * - 15 total links with required bandwidths:
 *   - Router ↔ Core (50 Mbps)
 *   - Core ↔ Access 01 (25 Mbps)
 *   - Core ↔ Access 02 (25 Mbps)
 *   - Access 01 ↔ 6 servers in Rack 01 & 02 (10 Mbps each)
 *   - Access 02 ↔ 6 servers in Rack 03 & 04 (10 Mbps each)
 * - Server default configurations: 8 vCPU, 16 GB RAM.
 */
export function validateStarterTopology(topology: Topology): ValidationResult {
  // First run universal structural validation
  const baseResult = validateTopology(topology);
  const errors: ValidationError[] = [...baseResult.errors];

  if (!baseResult.valid && errors.some((e) => e.code === TopologyErrorCode.DUPLICATE_NODE_ID)) {
    // If fundamental node ID corruption exists, return early to prevent downstream false positives
    return { valid: false, errors };
  }

  const nodes = topology.nodes || [];
  const links = topology.links || [];

  const routers = nodes.filter((n) => n.type === 'router');
  const coreSwitches = nodes.filter((n) => n.type === 'core_switch');
  const accessSwitches = nodes.filter((n) => n.type === 'access_switch');
  const racks = nodes.filter((n) => n.type === 'rack');
  const servers = nodes.filter((n) => n.type === 'server');

  // 1. Total & Component Node Counts
  if (nodes.length !== TOPOLOGY_DEFAULTS.STARTER_COUNTS.TOTAL_NODES) {
    errors.push({
      code: TopologyErrorCode.STARTER_NODE_COUNT_MISMATCH,
      message: `Starter topology expected ${TOPOLOGY_DEFAULTS.STARTER_COUNTS.TOTAL_NODES} total nodes, found ${nodes.length}.`,
    });
  }

  if (routers.length !== TOPOLOGY_DEFAULTS.STARTER_COUNTS.ROUTERS) {
    errors.push({
      code: TopologyErrorCode.STARTER_ROUTER_COUNT_MISMATCH,
      message: `Starter topology expected ${TOPOLOGY_DEFAULTS.STARTER_COUNTS.ROUTERS} router, found ${routers.length}.`,
    });
  }

  if (coreSwitches.length !== TOPOLOGY_DEFAULTS.STARTER_COUNTS.CORE_SWITCHES) {
    errors.push({
      code: TopologyErrorCode.STARTER_CORE_SWITCH_COUNT_MISMATCH,
      message: `Starter topology expected ${TOPOLOGY_DEFAULTS.STARTER_COUNTS.CORE_SWITCHES} core switch, found ${coreSwitches.length}.`,
    });
  }

  if (accessSwitches.length !== TOPOLOGY_DEFAULTS.STARTER_COUNTS.ACCESS_SWITCHES) {
    errors.push({
      code: TopologyErrorCode.STARTER_ACCESS_SWITCH_COUNT_MISMATCH,
      message: `Starter topology expected ${TOPOLOGY_DEFAULTS.STARTER_COUNTS.ACCESS_SWITCHES} access switches, found ${accessSwitches.length}.`,
    });
  }

  if (racks.length !== TOPOLOGY_DEFAULTS.STARTER_COUNTS.RACKS) {
    errors.push({
      code: TopologyErrorCode.STARTER_RACK_COUNT_MISMATCH,
      message: `Starter topology expected ${TOPOLOGY_DEFAULTS.STARTER_COUNTS.RACKS} racks, found ${racks.length}.`,
    });
  }

  if (servers.length !== TOPOLOGY_DEFAULTS.STARTER_COUNTS.SERVERS) {
    errors.push({
      code: TopologyErrorCode.STARTER_SERVER_COUNT_MISMATCH,
      message: `Starter topology expected ${TOPOLOGY_DEFAULTS.STARTER_COUNTS.SERVERS} application servers, found ${servers.length}.`,
    });
  }

  // 2. Server Distribution per Rack (exactly 3 servers per rack)
  const rackServerCounts = new Map<string, number>();
  for (const rack of racks) {
    rackServerCounts.set(rack.id, 0);
  }

  for (const server of servers) {
    const parentId = server.parent_id ?? server.parentId;
    if (parentId && rackServerCounts.has(parentId)) {
      rackServerCounts.set(parentId, (rackServerCounts.get(parentId) || 0) + 1);
    }
  }

  for (const [rackId, count] of rackServerCounts.entries()) {
    if (count !== TOPOLOGY_DEFAULTS.STARTER_COUNTS.SERVERS_PER_RACK) {
      errors.push({
        code: TopologyErrorCode.STARTER_SERVER_DISTRIBUTION_MISMATCH,
        message: `Rack '${rackId}' must contain exactly ${TOPOLOGY_DEFAULTS.STARTER_COUNTS.SERVERS_PER_RACK} servers, found ${count}.`,
        nodeId: rackId,
        details: { expected: TOPOLOGY_DEFAULTS.STARTER_COUNTS.SERVERS_PER_RACK, actual: count },
      });
    }
  }

  // 3. Link Count & Hierarchy
  if (links.length !== TOPOLOGY_DEFAULTS.STARTER_COUNTS.TOTAL_LINKS) {
    errors.push({
      code: TopologyErrorCode.STARTER_LINK_COUNT_MISMATCH,
      message: `Starter topology expected ${TOPOLOGY_DEFAULTS.STARTER_COUNTS.TOTAL_LINKS} links, found ${links.length}.`,
    });
  }

  // Build connection lookup for fast edge checking
  const connectionMap = new Map<string, TopologyLink>();
  for (const link of links) {
    const s = link.source_id ?? link.sourceId;
    const t = link.target_id ?? link.targetId;
    if (s && t) {
      connectionMap.set(getCanonicalLinkKey(s, t), link);
    }
  }

  // 3.1 Verify Router ↔ Core Switch link
  const edgeRouter = routers[0];
  const coreSwitch = coreSwitches[0];
  if (routers.length === 1 && coreSwitches.length === 1 && edgeRouter && coreSwitch) {
    const routerCoreKey = getCanonicalLinkKey(edgeRouter.id, coreSwitch.id);
    const routerCoreLink = connectionMap.get(routerCoreKey);
    if (!routerCoreLink) {
      errors.push({
        code: TopologyErrorCode.STARTER_MISSING_CONNECTION,
        message: `Missing required link between Router '${edgeRouter.id}' and Core Switch '${coreSwitch.id}'.`,
      });
    } else {
      const bw = routerCoreLink.bandwidth_mbps ?? routerCoreLink.bandwidthMbps;
      if (bw !== TOPOLOGY_DEFAULTS.BANDWIDTH_ROUTER_CORE_MBPS) {
        errors.push({
          code: TopologyErrorCode.STARTER_LINK_BANDWIDTH_MISMATCH,
          message: `Router-Core link '${routerCoreLink.id}' bandwidth must be ${TOPOLOGY_DEFAULTS.BANDWIDTH_ROUTER_CORE_MBPS} Mbps, found ${bw} Mbps.`,
          linkId: routerCoreLink.id,
        });
      }
    }
  }

  // 3.2 Verify Core Switch ↔ Access Switch links
  if (coreSwitches.length === 1 && coreSwitch) {
    for (const access of accessSwitches) {
      const coreAccessKey = getCanonicalLinkKey(coreSwitch.id, access.id);
      const coreAccessLink = connectionMap.get(coreAccessKey);
      if (!coreAccessLink) {
        errors.push({
          code: TopologyErrorCode.STARTER_MISSING_CONNECTION,
          message: `Missing required link between Core Switch '${coreSwitch.id}' and Access Switch '${access.id}'.`,
        });
      } else {
        const bw = coreAccessLink.bandwidth_mbps ?? coreAccessLink.bandwidthMbps;
        if (bw !== TOPOLOGY_DEFAULTS.BANDWIDTH_CORE_ACCESS_MBPS) {
          errors.push({
            code: TopologyErrorCode.STARTER_LINK_BANDWIDTH_MISMATCH,
            message: `Core-Access link '${coreAccessLink.id}' bandwidth must be ${TOPOLOGY_DEFAULTS.BANDWIDTH_CORE_ACCESS_MBPS} Mbps, found ${bw} Mbps.`,
            linkId: coreAccessLink.id,
          });
        }
      }
    }
  }

  // 3.3 Verify Server ↔ Access Switch links and bandwidth
  for (const server of servers) {
    const parentRackId = server.parent_id ?? server.parentId;
    const parentRack = racks.find((r) => r.id === parentRackId);
    const assignedSwitchId = (parentRack?.configuration as Record<string, unknown>)
      ?.assigned_access_switch_id as string;

    if (assignedSwitchId) {
      const serverAccessKey = getCanonicalLinkKey(assignedSwitchId, server.id);
      const serverLink = connectionMap.get(serverAccessKey);
      if (!serverLink) {
        errors.push({
          code: TopologyErrorCode.STARTER_MISSING_CONNECTION,
          message: `Missing required link between Access Switch '${assignedSwitchId}' and Server '${server.id}'.`,
        });
      } else {
        const bw = serverLink.bandwidth_mbps ?? serverLink.bandwidthMbps;
        if (bw !== TOPOLOGY_DEFAULTS.BANDWIDTH_ACCESS_SERVER_MBPS) {
          errors.push({
            code: TopologyErrorCode.STARTER_LINK_BANDWIDTH_MISMATCH,
            message: `Access-Server link '${serverLink.id}' bandwidth must be ${TOPOLOGY_DEFAULTS.BANDWIDTH_ACCESS_SERVER_MBPS} Mbps, found ${bw} Mbps.`,
            linkId: serverLink.id,
          });
        }
      }
    }
  }

  // 4. Server Hardware Configurations
  for (const server of servers) {
    const config = (server.configuration || {}) as Partial<ServerConfiguration>;
    if (
      config.vcpu !== TOPOLOGY_DEFAULTS.SERVER_VCPU ||
      config.ram_gb !== TOPOLOGY_DEFAULTS.SERVER_RAM_GB
    ) {
      errors.push({
        code: TopologyErrorCode.STARTER_SERVER_CONFIG_MISMATCH,
        message: `Server '${server.id}' hardware specs must match PRD defaults (${TOPOLOGY_DEFAULTS.SERVER_VCPU} vCPU, ${TOPOLOGY_DEFAULTS.SERVER_RAM_GB} GB RAM). Found: ${config.vcpu} vCPU, ${config.ram_gb} GB RAM.`,
        nodeId: server.id,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convenience boolean helper for general topology validity.
 */
export function isTopologyValid(topology: Topology): boolean {
  return validateTopology(topology).valid;
}

/**
 * Convenience boolean helper for starter topology validity.
 */
export function isStarterTopologyValid(topology: Topology): boolean {
  return validateStarterTopology(topology).valid;
}
