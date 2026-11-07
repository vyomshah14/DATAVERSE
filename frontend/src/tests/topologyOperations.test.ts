import { describe, it, expect } from 'vitest';
import {
  cloneTopology,
  renameNode,
  addNode,
  removeNode,
  updateNodeConfiguration,
  updateLinkMetrics,
  updateNodeStatus,
  updateLinkStatus,
  addLink,
  removeLink,
  reassignServerParent,
} from '../engine/topology/operations';
import { createStarterTopology } from '../engine/topology/starter';
import { isTopologyValid } from '../engine/topology/validator';
import { TopologyErrorCode } from '../engine/topology/types';
import type {
  Topology,
  TopologyNodeType,
  TopologyNodeStatus,
  TopologyLinkStatus,
  ServerConfiguration,
  NetworkDeviceConfiguration,
} from '../engine/topology/types';

describe('Topology Editing Operations — Immutability & Cloning', () => {
  it('deep clones a topology without sharing nested mutable references', () => {
    const original = createStarterTopology();
    const cloned = cloneTopology(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.nodes).not.toBe(original.nodes);
    expect(cloned.links).not.toBe(original.links);

    // Mutating cloned object must not affect original
    cloned.nodes[0]!.name = 'Modified Name';
    expect(original.nodes[0]!.name).not.toBe('Modified Name');
  });
});

describe('Operation: renameNode', () => {
  it('successfully renames an existing node and preserves other properties', () => {
    const topology = createStarterTopology();
    const result = renameNode(topology, 'router-01', 'Core Gateway Alpha');

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.affectedNodeIds).toEqual(['router-01']);
    const renamed = result.topology.nodes.find((n) => n.id === 'router-01');
    expect(renamed?.name).toBe('Core Gateway Alpha');
    expect(renamed?.type).toBe('router');
    expect(renamed?.status).toBe('online');
    expect(isTopologyValid(result.topology)).toBe(true);

    // Original remains unmutated
    expect(topology.nodes.find((n) => n.id === 'router-01')?.name).toBe('Edge Gateway Router 01');
  });

  it('rejects empty or whitespace-only names', () => {
    const topology = createStarterTopology();
    const result = renameNode(topology, 'router-01', '   ');

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_NODE_NAME);
    expect(result.topology).toBe(topology);
  });

  it('rejects names exceeding 100 characters', () => {
    const topology = createStarterTopology();
    const longName = 'A'.repeat(101);
    const result = renameNode(topology, 'router-01', longName);

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_NODE_NAME);
  });

  it('returns NODE_NOT_FOUND when node does not exist', () => {
    const topology = createStarterTopology();
    const result = renameNode(topology, 'ghost-node-99', 'Ghost Appliance');

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.NODE_NOT_FOUND);
  });
});

describe('Operation: addNode', () => {
  it('successfully adds a valid compute server with an existing parent rack', () => {
    const topology = createStarterTopology();
    const result = addNode(topology, {
      id: 'server-13',
      type: 'server',
      name: 'Application Server 13',
      parentId: 'rack-01',
      configuration: {
        vcpu: 8,
        ram_gb: 16,
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.affectedNodeIds).toEqual(['server-13']);
    expect(result.topology.nodes).toHaveLength(21);
    const added = result.topology.nodes.find((n) => n.id === 'server-13');
    expect(added?.name).toBe('Application Server 13');
    expect(added?.parent_id).toBe('rack-01');
    expect(added?.status).toBe('online');
    expect(isTopologyValid(result.topology)).toBe(true);
  });

  it('successfully adds a new physical rack enclosure', () => {
    const topology = createStarterTopology();
    const result = addNode(topology, {
      id: 'rack-05',
      type: 'rack',
      name: 'Server Rack C1',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.topology.nodes).toHaveLength(21);
    const rack = result.topology.nodes.find((n) => n.id === 'rack-05');
    expect(rack?.type).toBe('rack');
    expect(rack?.parent_id).toBeNull();
    expect(isTopologyValid(result.topology)).toBe(true);
  });

  it('rejects duplicate node IDs', () => {
    const topology = createStarterTopology();
    const result = addNode(topology, {
      id: 'server-01',
      type: 'server',
      name: 'Duplicate Server',
      parentId: 'rack-01',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.DUPLICATE_NODE_ID);
    expect(topology.nodes).toHaveLength(20);
  });

  it('rejects unsupported node types', () => {
    const topology = createStarterTopology();
    const result = addNode(topology, {
      id: 'firewall-01',
      type: 'firewall' as unknown as TopologyNodeType,
      name: 'Perimeter Firewall',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_NODE_TYPE);
  });

  it('rejects servers referencing non-existent parent racks', () => {
    const topology = createStarterTopology();
    const result = addNode(topology, {
      id: 'server-13',
      type: 'server',
      name: 'Orphan Server',
      parentId: 'rack-99',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_PARENT_REFERENCE);
  });

  it('rejects servers referencing non-rack parents (e.g. router)', () => {
    const topology = createStarterTopology();
    const result = addNode(topology, {
      id: 'server-13',
      type: 'server',
      name: 'Misparented Server',
      parentId: 'router-01',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_PARENT_RELATIONSHIP);
  });

  it('rejects non-server nodes specifying a parent container', () => {
    const topology = createStarterTopology();
    const result = addNode(topology, {
      id: 'switch-sub',
      type: 'access_switch',
      name: 'Sub Switch',
      parentId: 'rack-01',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_PARENT_RELATIONSHIP);
  });

  it('rejects servers with invalid non-positive vCPU or RAM', () => {
    const topology = createStarterTopology();
    const result = addNode(topology, {
      id: 'server-bad-cpu',
      type: 'server',
      name: 'Zero CPU Server',
      parentId: 'rack-01',
      configuration: {
        vcpu: 0,
        ram_gb: 16,
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_SERVER_CONFIG);
  });
});

describe('Operation: removeNode', () => {
  it('safely removes a server node and cascade-removes its connected network link', () => {
    const topology = createStarterTopology();
    const result = removeNode(topology, 'server-01');

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.affectedNodeIds).toEqual(['server-01']);
    expect(result.affectedLinkIds).toContain('link-access-01-server-01');
    expect(result.topology.nodes).toHaveLength(19);
    expect(result.topology.links).toHaveLength(14);

    // Guaranteed zero dangling links
    expect(isTopologyValid(result.topology)).toBe(true);
    expect(result.topology.links.some((l) => l.target_id === 'server-01')).toBe(false);

    // Original unchanged
    expect(topology.nodes).toHaveLength(20);
    expect(topology.links).toHaveLength(15);
  });

  it('rejects removing a rack with contained servers when cascadeChildren is false', () => {
    const topology = createStarterTopology();
    const result = removeNode(topology, 'rack-01', { cascadeChildren: false });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.RACK_CONTAINS_SERVERS);
    expect(result.topology).toBe(topology);
  });

  it('cascade-removes a rack and its 3 child servers and links when cascadeChildren is true', () => {
    const topology = createStarterTopology();
    const result = removeNode(topology, 'rack-01', { cascadeChildren: true });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Rack-01 + Server-01, 02, 03 removed = 4 nodes removed
    expect(result.affectedNodeIds).toHaveLength(4);
    expect(result.affectedNodeIds).toContain('rack-01');
    expect(result.affectedNodeIds).toContain('server-01');
    expect(result.affectedNodeIds).toContain('server-02');
    expect(result.affectedNodeIds).toContain('server-03');

    // 3 server links cascade-removed
    expect(result.affectedLinkIds).toHaveLength(3);
    expect(result.topology.nodes).toHaveLength(16);
    expect(result.topology.links).toHaveLength(12);

    expect(isTopologyValid(result.topology)).toBe(true);
  });

  it('returns NODE_NOT_FOUND when removing a non-existent node', () => {
    const topology = createStarterTopology();
    const result = removeNode(topology, 'non-existent-device');

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.NODE_NOT_FOUND);
  });
});

describe('Operation: updateNodeConfiguration', () => {
  it('updates compute server vCPU, RAM, and automatically synchronizes ram_mb', () => {
    const topology = createStarterTopology();
    const result = updateNodeConfiguration(topology, 'server-01', {
      vcpu: 16,
      ram_gb: 32,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const updated = result.topology.nodes.find((n) => n.id === 'server-01');
    const config = updated?.configuration as ServerConfiguration;
    expect(config.vcpu).toBe(16);
    expect(config.ram_gb).toBe(32);
    expect(config.ram_mb).toBe(32768);
    expect(isTopologyValid(result.topology)).toBe(true);
  });

  it('rejects invalid non-positive compute values', () => {
    const topology = createStarterTopology();
    const result = updateNodeConfiguration(topology, 'server-01', {
      vcpu: -4,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_SERVER_CONFIG);
  });

  it('updates network appliance switching capacity', () => {
    const topology = createStarterTopology();
    const result = updateNodeConfiguration(topology, 'core-switch-01', {
      switching_capacity_gbps: 160,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const updated = result.topology.nodes.find((n) => n.id === 'core-switch-01');
    const config = updated?.configuration as NetworkDeviceConfiguration;
    expect(config.switching_capacity_gbps).toBe(160);
  });
});

describe('Operation: updateLinkMetrics', () => {
  it('updates link bandwidth and latency within documented constraints', () => {
    const topology = createStarterTopology();
    const result = updateLinkMetrics(topology, 'link-router-core', {
      bandwidth_mbps: 100,
      latency_ms: 2.5,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const link = result.topology.links.find((l) => l.id === 'link-router-core');
    expect(link?.bandwidth_mbps).toBe(100);
    expect(link?.bandwidthMbps).toBe(100);
    expect(link?.latency_ms).toBe(2.5);
    expect(link?.latencyMs).toBe(2.5);
    expect(isTopologyValid(result.topology)).toBe(true);
  });

  it('rejects non-positive bandwidth', () => {
    const topology = createStarterTopology();
    const result = updateLinkMetrics(topology, 'link-router-core', {
      bandwidth_mbps: 0,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_BANDWIDTH);
  });

  it('rejects negative latency', () => {
    const topology = createStarterTopology();
    const result = updateLinkMetrics(topology, 'link-router-core', {
      latency_ms: -1,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_LATENCY);
  });

  it('returns LINK_NOT_FOUND for non-existent link', () => {
    const topology = createStarterTopology();
    const result = updateLinkMetrics(topology, 'unknown-link-id', {
      bandwidth_mbps: 20,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.LINK_NOT_FOUND);
  });
});

describe('Operation: updateNodeStatus & updateLinkStatus', () => {
  it('updates node operational status across valid states', () => {
    const topology = createStarterTopology();
    const degResult = updateNodeStatus(topology, 'server-02', 'degraded');
    expect(degResult.success).toBe(true);
    expect(degResult.topology.nodes.find((n) => n.id === 'server-02')?.status).toBe('degraded');

    const offResult = updateNodeStatus(degResult.topology, 'server-02', 'offline');
    expect(offResult.success).toBe(true);
    expect(offResult.topology.nodes.find((n) => n.id === 'server-02')?.status).toBe('offline');
  });

  it('rejects invalid node status strings', () => {
    const topology = createStarterTopology();
    const result = updateNodeStatus(
      topology,
      'server-02',
      'exploded' as unknown as TopologyNodeStatus
    );

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_NODE_STATUS);
  });

  it('updates link status to severed or degraded', () => {
    const topology = createStarterTopology();
    const result = updateLinkStatus(topology, 'link-router-core', 'severed');

    expect(result.success).toBe(true);
    if (!result.success) return;

    const link = result.topology.links.find((l) => l.id === 'link-router-core');
    expect(link?.status).toBe('severed');
  });

  it('rejects invalid link status', () => {
    const topology = createStarterTopology();
    const result = updateLinkStatus(
      topology,
      'link-router-core',
      'invalid_status' as unknown as TopologyLinkStatus
    );

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_LINK_STATUS);
  });
});

describe('Operation: addLink & removeLink', () => {
  it('successfully creates a valid network link between switches', () => {
    const topology = createStarterTopology();
    const result = addLink(topology, {
      id: 'link-access-mesh',
      source_id: 'access-switch-01',
      target_id: 'access-switch-02',
      bandwidth_mbps: 20,
      latency_ms: 1,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.topology.links).toHaveLength(16);
    expect(isTopologyValid(result.topology)).toBe(true);
  });

  it('rejects adding a network link connected to a physical rack', () => {
    const topology = createStarterTopology();
    const result = addLink(topology, {
      id: 'link-invalid-rack',
      source_id: 'access-switch-01',
      target_id: 'rack-01',
      bandwidth_mbps: 10,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.RACK_HAS_NETWORK_LINK);
  });

  it('rejects duplicate parallel links between the same pair of nodes', () => {
    const topology = createStarterTopology();
    // Router and Core already have link-router-core
    const result = addLink(topology, {
      id: 'link-router-core-duplicate',
      source_id: 'core-switch-01',
      target_id: 'router-01',
      bandwidth_mbps: 50,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.DUPLICATE_LINK_CONNECTION);
  });

  it('rejects self-referencing links', () => {
    const topology = createStarterTopology();
    const result = addLink(topology, {
      id: 'link-self',
      source_id: 'access-switch-01',
      target_id: 'access-switch-01',
      bandwidth_mbps: 10,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.SELF_REFERENCING_LINK);
  });

  it('safely removes a link without affecting node endpoints', () => {
    const topology = createStarterTopology();
    const result = removeLink(topology, 'link-router-core');

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.topology.links).toHaveLength(14);
    expect(result.topology.nodes).toHaveLength(20);
    expect(result.topology.links.some((l) => l.id === 'link-router-core')).toBe(false);
  });
});

describe('Operation: reassignServerParent', () => {
  it('successfully moves a server blade to a different physical rack', () => {
    const topology = createStarterTopology();
    // Move server-01 from rack-01 to rack-02
    const result = reassignServerParent(topology, 'server-01', 'rack-02');

    expect(result.success).toBe(true);
    if (!result.success) return;

    const srv = result.topology.nodes.find((n) => n.id === 'server-01');
    expect(srv?.parent_id).toBe('rack-02');
    expect(srv?.parentId).toBe('rack-02');
    expect(isTopologyValid(result.topology)).toBe(true);
  });

  it('rejects reassigning to a non-existent rack', () => {
    const topology = createStarterTopology();
    const result = reassignServerParent(topology, 'server-01', 'rack-99');

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_PARENT_REFERENCE);
  });

  it('rejects reassigning to a non-rack device (e.g. core switch)', () => {
    const topology = createStarterTopology();
    const result = reassignServerParent(topology, 'server-01', 'core-switch-01');

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe(TopologyErrorCode.INVALID_PARENT_RELATIONSHIP);
  });
});

describe('Deterministic Repeated Execution', () => {
  it('produces bit-for-bit identical outputs when executing identical operations consecutively', () => {
    const topology = createStarterTopology();

    const runs: Topology[] = [];
    for (let i = 0; i < 5; i++) {
      const res1 = renameNode(topology, 'server-01', 'App Server Primed');
      if (!res1.success) throw new Error('Op 1 failed');
      const res2 = updateNodeConfiguration(res1.topology, 'server-01', { vcpu: 16 });
      if (!res2.success) throw new Error('Op 2 failed');
      const res3 = updateLinkMetrics(res2.topology, 'link-router-core', { bandwidth_mbps: 75 });
      if (!res3.success) throw new Error('Op 3 failed');
      runs.push(res3.topology);
    }

    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]).toEqual(runs[0]);
    }
  });
});
