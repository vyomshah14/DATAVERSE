/**
 * Deterministic Starter Topology Generator for DATAVERSE.
 * Adheres strictly to PRD v2.0, DECISION-001, and DECISION-002.
 *
 * Invariant Specification:
 * - 1 Edge Router (router-01)
 * - 1 Core Switch (core-switch-01)
 * - 2 Access Switches (access-switch-01, access-switch-02)
 * - 4 Physical Racks (rack-01 through rack-04)
 * - 12 Application Servers (server-01 through server-12, exactly 3 per rack)
 *
 * Network Hierarchy:
 * - 1 x Router ↔ Core Switch link (50 Mbps, 1 ms)
 * - 2 x Core Switch ↔ Access Switch links (25 Mbps, 1 ms)
 * - 12 x Access Switch ↔ Server links (10 Mbps, 1 ms)
 * Total: 20 Nodes, 15 Links.
 */

import type { Topology, TopologyNode, TopologyLink } from './types';
import { TOPOLOGY_DEFAULTS } from './constants';

export function createStarterTopology(): Topology {
  const nodes: TopologyNode[] = [];
  const links: TopologyLink[] = [];

  // 1. Edge Router
  nodes.push({
    id: 'router-01',
    type: 'router',
    name: 'Edge Gateway Router 01',
    parent_id: null,
    parentId: null,
    status: 'online',
    position: [0, 3, -6],
    configuration: {
      switching_capacity_gbps: 100,
      ip_address: '10.0.0.1',
      mac_address: '02:00:00:00:00:01',
    },
  });

  // 2. Core Distribution Switch
  nodes.push({
    id: 'core-switch-01',
    type: 'core_switch',
    name: 'Core Distribution Switch 01',
    parent_id: null,
    parentId: null,
    status: 'online',
    position: [0, 2, -3.5],
    configuration: {
      switching_capacity_gbps: 80,
      ip_address: '10.0.1.1',
      mac_address: '02:00:00:00:01:01',
    },
  });

  // 3. Access Switches (Pod-A and Pod-B)
  nodes.push({
    id: 'access-switch-01',
    type: 'access_switch',
    name: 'Access Switch Pod-A',
    parent_id: null,
    parentId: null,
    status: 'online',
    position: [-3, 1.5, -1.5],
    configuration: {
      switching_capacity_gbps: 40,
      assigned_rack_ids: ['rack-01', 'rack-02'],
      ip_address: '10.0.2.1',
      mac_address: '02:00:00:00:02:01',
    },
  });

  nodes.push({
    id: 'access-switch-02',
    type: 'access_switch',
    name: 'Access Switch Pod-B',
    parent_id: null,
    parentId: null,
    status: 'online',
    position: [3, 1.5, -1.5],
    configuration: {
      switching_capacity_gbps: 40,
      assigned_rack_ids: ['rack-03', 'rack-04'],
      ip_address: '10.0.3.1',
      mac_address: '02:00:00:00:03:01',
    },
  });

  // 4. Physical Racks (Spatial grouping containers; never forward network traffic)
  const rackConfigs = [
    { id: 'rack-01', name: 'Server Rack A1', switchId: 'access-switch-01', x: -4.5 },
    { id: 'rack-02', name: 'Server Rack A2', switchId: 'access-switch-01', x: -1.5 },
    { id: 'rack-03', name: 'Server Rack B1', switchId: 'access-switch-02', x: 1.5 },
    { id: 'rack-04', name: 'Server Rack B2', switchId: 'access-switch-02', x: 4.5 },
  ];

  for (const rc of rackConfigs) {
    nodes.push({
      id: rc.id,
      type: 'rack',
      name: rc.name,
      parent_id: null,
      parentId: null,
      status: 'online',
      position: [rc.x, 0, 1.5],
      configuration: {
        total_u: TOPOLOGY_DEFAULTS.RACK_TOTAL_U,
        server_capacity: TOPOLOGY_DEFAULTS.RACK_DEFAULT_SERVERS,
        assigned_access_switch_id: rc.switchId,
      },
    });
  }

  // 5. Application Servers (12 servers, distributed 3 per rack)
  for (let i = 1; i <= 12; i++) {
    const serverNum = String(i).padStart(2, '0');
    const rackIdx = Math.floor((i - 1) / 3) + 1; // 1, 2, 3, or 4
    const rackId = `rack-0${rackIdx}`;
    const serverSlot = ((i - 1) % 3) + 1; // 1, 2, or 3 within rack
    const rackConfig = rackConfigs[rackIdx - 1];
    const posX = rackConfig ? rackConfig.x : (rackIdx - 2.5) * 3.0;

    nodes.push({
      id: `server-${serverNum}`,
      type: 'server',
      name: `Application Server ${serverNum}`,
      parent_id: rackId,
      parentId: rackId,
      status: 'online',
      position: [posX, 0.5 + 0.6 * serverSlot, 1.5],
      configuration: {
        vcpu: TOPOLOGY_DEFAULTS.SERVER_VCPU,
        ram_gb: TOPOLOGY_DEFAULTS.SERVER_RAM_GB,
        ram_mb: TOPOLOGY_DEFAULTS.SERVER_RAM_MB,
        storage_gb: 256,
        ip_address: `10.0.${10 + rackIdx}.${10 + serverSlot}`,
        mac_address: `02:00:00:10:${String(rackIdx).padStart(2, '0')}:${serverNum}`,
      },
    });
  }

  // 6. Network Links

  // 6.1 Router ↔ Core Switch
  links.push({
    id: 'link-router-core',
    source_id: 'router-01',
    target_id: 'core-switch-01',
    sourceId: 'router-01',
    targetId: 'core-switch-01',
    bandwidth_mbps: TOPOLOGY_DEFAULTS.BANDWIDTH_ROUTER_CORE_MBPS,
    bandwidthMbps: TOPOLOGY_DEFAULTS.BANDWIDTH_ROUTER_CORE_MBPS,
    latency_ms: TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS,
    latencyMs: TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS,
    status: 'online',
  });

  // 6.2 Core Switch ↔ Access Switch 01
  links.push({
    id: 'link-core-access-01',
    source_id: 'core-switch-01',
    target_id: 'access-switch-01',
    sourceId: 'core-switch-01',
    targetId: 'access-switch-01',
    bandwidth_mbps: TOPOLOGY_DEFAULTS.BANDWIDTH_CORE_ACCESS_MBPS,
    bandwidthMbps: TOPOLOGY_DEFAULTS.BANDWIDTH_CORE_ACCESS_MBPS,
    latency_ms: TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS,
    latencyMs: TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS,
    status: 'online',
  });

  // 6.3 Core Switch ↔ Access Switch 02
  links.push({
    id: 'link-core-access-02',
    source_id: 'core-switch-01',
    target_id: 'access-switch-02',
    sourceId: 'core-switch-01',
    targetId: 'access-switch-02',
    bandwidth_mbps: TOPOLOGY_DEFAULTS.BANDWIDTH_CORE_ACCESS_MBPS,
    bandwidthMbps: TOPOLOGY_DEFAULTS.BANDWIDTH_CORE_ACCESS_MBPS,
    latency_ms: TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS,
    latencyMs: TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS,
    status: 'online',
  });

  // 6.4 Access Switch 01 ↔ Servers in Rack 1 & Rack 2 (servers 1 through 6)
  for (let i = 1; i <= 6; i++) {
    const serverNum = String(i).padStart(2, '0');
    links.push({
      id: `link-access-01-server-${serverNum}`,
      source_id: 'access-switch-01',
      target_id: `server-${serverNum}`,
      sourceId: 'access-switch-01',
      targetId: `server-${serverNum}`,
      bandwidth_mbps: TOPOLOGY_DEFAULTS.BANDWIDTH_ACCESS_SERVER_MBPS,
      bandwidthMbps: TOPOLOGY_DEFAULTS.BANDWIDTH_ACCESS_SERVER_MBPS,
      latency_ms: TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS,
      latencyMs: TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS,
      status: 'online',
    });
  }

  // 6.5 Access Switch 02 ↔ Servers in Rack 3 & Rack 4 (servers 7 through 12)
  for (let i = 7; i <= 12; i++) {
    const serverNum = String(i).padStart(2, '0');
    links.push({
      id: `link-access-02-server-${serverNum}`,
      source_id: 'access-switch-02',
      target_id: `server-${serverNum}`,
      sourceId: 'access-switch-02',
      targetId: `server-${serverNum}`,
      bandwidth_mbps: TOPOLOGY_DEFAULTS.BANDWIDTH_ACCESS_SERVER_MBPS,
      bandwidthMbps: TOPOLOGY_DEFAULTS.BANDWIDTH_ACCESS_SERVER_MBPS,
      latency_ms: TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS,
      latencyMs: TOPOLOGY_DEFAULTS.BASE_LINK_LATENCY_MS,
      status: 'online',
    });
  }

  return { nodes, links };
}
