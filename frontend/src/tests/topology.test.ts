/**
 * Comprehensive Vitest Unit Tests for DATAVERSE Topology Engine.
 * Tests starter topology generator, deterministic repeatability,
 * and pure deterministic validation engine under all edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  createStarterTopology,
  validateTopology,
  validateStarterTopology,
  isTopologyValid,
  isStarterTopologyValid,
  getCanonicalLinkKey,
  TopologyErrorCode,
  TOPOLOGY_DEFAULTS,
} from '../engine/topology';
import type { TopologyNodeType } from '../engine/topology';

describe('Starter Topology Generator', () => {
  it('generates the exact expected node and link counts per PRD v2.0', () => {
    const topology = createStarterTopology();

    expect(topology.nodes).toHaveLength(TOPOLOGY_DEFAULTS.STARTER_COUNTS.TOTAL_NODES); // 20
    expect(topology.links).toHaveLength(TOPOLOGY_DEFAULTS.STARTER_COUNTS.TOTAL_LINKS); // 15

    const routers = topology.nodes.filter((n) => n.type === 'router');
    const coreSwitches = topology.nodes.filter((n) => n.type === 'core_switch');
    const accessSwitches = topology.nodes.filter((n) => n.type === 'access_switch');
    const racks = topology.nodes.filter((n) => n.type === 'rack');
    const servers = topology.nodes.filter((n) => n.type === 'server');

    expect(routers).toHaveLength(1);
    expect(coreSwitches).toHaveLength(1);
    expect(accessSwitches).toHaveLength(2);
    expect(racks).toHaveLength(4);
    expect(servers).toHaveLength(12);
  });

  it('guarantees exactly 3 application servers per rack via parent_id grouping', () => {
    const topology = createStarterTopology();
    const racks = topology.nodes.filter((n) => n.type === 'rack');
    const servers = topology.nodes.filter((n) => n.type === 'server');

    for (const rack of racks) {
      const rackServers = servers.filter((s) => s.parent_id === rack.id || s.parentId === rack.id);
      expect(rackServers).toHaveLength(3);
    }
  });

  it('verifies racks act strictly as spatial containers without network links', () => {
    const topology = createStarterTopology();
    const rackIds = new Set(topology.nodes.filter((n) => n.type === 'rack').map((r) => r.id));

    // Confirm no link source or target is a rack
    for (const link of topology.links) {
      expect(rackIds.has(link.source_id)).toBe(false);
      expect(rackIds.has(link.target_id)).toBe(false);
    }
  });

  it('configures network link bandwidths according to PRD hierarchy', () => {
    const topology = createStarterTopology();

    // 1 Router-Core link: 50 Mbps
    const routerCore = topology.links.find(
      (l) =>
        (l.source_id === 'router-01' && l.target_id === 'core-switch-01') ||
        (l.source_id === 'core-switch-01' && l.target_id === 'router-01')
    );
    expect(routerCore).toBeDefined();
    expect(routerCore?.bandwidth_mbps).toBe(50);
    expect(routerCore?.latency_ms).toBe(1);

    // 2 Core-Access links: 25 Mbps each
    const coreAccessLinks = topology.links.filter(
      (l) => l.source_id === 'core-switch-01' && l.target_id.startsWith('access-switch')
    );
    expect(coreAccessLinks).toHaveLength(2);
    for (const link of coreAccessLinks) {
      expect(link.bandwidth_mbps).toBe(25);
      expect(link.latency_ms).toBe(1);
    }

    // 12 Access-Server links: 10 Mbps each
    const serverLinks = topology.links.filter((l) => l.target_id.startsWith('server-'));
    expect(serverLinks).toHaveLength(12);
    for (const link of serverLinks) {
      expect(link.bandwidth_mbps).toBe(10);
      expect(link.latency_ms).toBe(1);
    }
  });

  it('configures server hardware specifications with 8 vCPU and 16 GB RAM', () => {
    const topology = createStarterTopology();
    const servers = topology.nodes.filter((n) => n.type === 'server');

    for (const server of servers) {
      const config = server.configuration as { vcpu: number; ram_gb: number };
      expect(config.vcpu).toBe(8);
      expect(config.ram_gb).toBe(16);
    }
  });

  it('generates identical output across repeated invocations (deterministic)', () => {
    const t1 = createStarterTopology();
    const t2 = createStarterTopology();

    expect(JSON.stringify(t1)).toBe(JSON.stringify(t2));
  });

  it('passes starter topology validation cleanly with zero errors', () => {
    const topology = createStarterTopology();
    const res = validateStarterTopology(topology);

    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(isStarterTopologyValid(topology)).toBe(true);
    expect(isTopologyValid(topology)).toBe(true);
  });
});

describe('Topology Validation Engine — General Structural Invariants', () => {
  it('detects duplicate node IDs', () => {
    const topology = createStarterTopology();
    // Inject duplicate ID
    topology.nodes.push({
      id: 'server-01', // duplicate!
      type: 'server',
      name: 'Duplicate Server',
      parent_id: 'rack-01',
      status: 'online',
      configuration: { vcpu: 8, ram_gb: 16 },
    });

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.DUPLICATE_NODE_ID)).toBe(true);
  });

  it('detects duplicate link IDs', () => {
    const topology = createStarterTopology();
    // Inject duplicate link ID
    topology.links.push({
      id: 'link-router-core', // duplicate!
      source_id: 'core-switch-01',
      target_id: 'server-01',
      bandwidth_mbps: 10,
      latency_ms: 1,
      status: 'online',
    });

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.DUPLICATE_LINK_ID)).toBe(true);
  });

  it('detects duplicate bidirectional link connections', () => {
    const topology = createStarterTopology();
    // Add reversed link between router and core switch
    topology.links.push({
      id: 'link-core-router-reverse-dup',
      source_id: 'core-switch-01',
      target_id: 'router-01', // router-01 ↔ core-switch-01 already exists!
      bandwidth_mbps: 50,
      latency_ms: 1,
      status: 'online',
    });

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.DUPLICATE_LINK_CONNECTION)).toBe(
      true
    );
  });

  it('detects missing link endpoints', () => {
    const topology = createStarterTopology();
    topology.links.push({
      id: 'link-ghost-node',
      source_id: 'non-existent-node',
      target_id: 'core-switch-01',
      bandwidth_mbps: 10,
      latency_ms: 1,
      status: 'online',
    });

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.MISSING_LINK_ENDPOINT)).toBe(true);
  });

  it('detects self-referencing links', () => {
    const topology = createStarterTopology();
    topology.links.push({
      id: 'link-self-loop',
      source_id: 'core-switch-01',
      target_id: 'core-switch-01',
      bandwidth_mbps: 10,
      latency_ms: 1,
      status: 'online',
    });

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.SELF_REFERENCING_LINK)).toBe(true);
  });

  it('detects invalid node types', () => {
    const topology = createStarterTopology();
    topology.nodes.push({
      id: 'quantum-switch-01',
      type: 'quantum_switch' as unknown as TopologyNodeType, // invalid!
      name: 'Quantum Switch',
      parent_id: null,
      status: 'online',
      configuration: {},
    });

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.INVALID_NODE_TYPE)).toBe(true);
  });

  it('detects invalid parent references pointing to non-existent nodes', () => {
    const topology = createStarterTopology();
    topology.nodes.push({
      id: 'server-99',
      type: 'server',
      name: 'Orphan Server',
      parent_id: 'rack-ghost-99', // non-existent!
      status: 'online',
      configuration: { vcpu: 8, ram_gb: 16 },
    });

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.INVALID_PARENT_REFERENCE)).toBe(
      true
    );
  });

  it('detects invalid parent relationships (e.g. server parented by router)', () => {
    const topology = createStarterTopology();
    topology.nodes.push({
      id: 'server-invalid-parent',
      type: 'server',
      name: 'Wrong Parent Server',
      parent_id: 'router-01', // Router cannot be a parent container!
      status: 'online',
      configuration: { vcpu: 8, ram_gb: 16 },
    });

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.INVALID_PARENT_RELATIONSHIP)).toBe(
      true
    );
  });

  it('detects network links attempting to connect to a physical rack', () => {
    const topology = createStarterTopology();
    topology.links.push({
      id: 'link-invalid-rack-forwarding',
      source_id: 'access-switch-01',
      target_id: 'rack-01', // Racks cannot be link endpoints!
      bandwidth_mbps: 10,
      latency_ms: 1,
      status: 'online',
    });

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.RACK_HAS_NETWORK_LINK)).toBe(true);
  });

  it('detects invalid bandwidth or latency values', () => {
    const topology = createStarterTopology();
    topology.links.push({
      id: 'link-bad-metrics',
      source_id: 'access-switch-01',
      target_id: 'server-01',
      bandwidth_mbps: -50, // invalid!
      latency_ms: -1, // invalid!
      status: 'online',
    });

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.INVALID_BANDWIDTH)).toBe(true);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.INVALID_LATENCY)).toBe(true);
  });

  it('detects invalid server configuration (e.g. zero or negative vCPU/RAM)', () => {
    const topology = createStarterTopology();
    const server = topology.nodes.find((n) => n.id === 'server-01');
    if (server) {
      server.configuration = { vcpu: 0, ram_gb: -4 }; // invalid!
    }

    const res = validateTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.INVALID_SERVER_CONFIG)).toBe(true);
  });
});

describe('Topology Validation Engine — Starter Topology Specific Checks', () => {
  it('detects incorrect server distribution across racks', () => {
    const topology = createStarterTopology();
    // Move server-03 from rack-01 to rack-02 (making rack-01 have 2, and rack-02 have 4)
    const server3 = topology.nodes.find((n) => n.id === 'server-03');
    if (server3) {
      server3.parent_id = 'rack-02';
      server3.parentId = 'rack-02';
    }

    const res = validateStarterTopology(topology);
    expect(res.valid).toBe(false);
    expect(
      res.errors.some((e) => e.code === TopologyErrorCode.STARTER_SERVER_DISTRIBUTION_MISMATCH)
    ).toBe(true);
  });

  it('detects missing required network connections (e.g. missing Router-Core link)', () => {
    const topology = createStarterTopology();
    // Remove router-core link
    topology.links = topology.links.filter((l) => l.id !== 'link-router-core');

    const res = validateStarterTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.STARTER_MISSING_CONNECTION)).toBe(
      true
    );
  });

  it('detects missing Access-Server link for a server', () => {
    const topology = createStarterTopology();
    // Remove one access-server link
    topology.links = topology.links.filter((l) => l.id !== 'link-access-01-server-01');

    const res = validateStarterTopology(topology);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === TopologyErrorCode.STARTER_MISSING_CONNECTION)).toBe(
      true
    );
  });

  it('detects incorrect link bandwidth for starter hierarchy (e.g. Router-Core link at 10 Mbps)', () => {
    const topology = createStarterTopology();
    const routerCore = topology.links.find((l) => l.id === 'link-router-core');
    if (routerCore) {
      routerCore.bandwidth_mbps = 10; // should be 50!
      routerCore.bandwidthMbps = 10;
    }

    const res = validateStarterTopology(topology);
    expect(res.valid).toBe(false);
    expect(
      res.errors.some((e) => e.code === TopologyErrorCode.STARTER_LINK_BANDWIDTH_MISMATCH)
    ).toBe(true);
  });

  it('detects incorrect server hardware specs in starter topology (e.g. 4 vCPU instead of 8)', () => {
    const topology = createStarterTopology();
    const server = topology.nodes.find((n) => n.id === 'server-05');
    if (server) {
      server.configuration = { vcpu: 4, ram_gb: 16 };
    }

    const res = validateStarterTopology(topology);
    expect(res.valid).toBe(false);
    expect(
      res.errors.some((e) => e.code === TopologyErrorCode.STARTER_SERVER_CONFIG_MISMATCH)
    ).toBe(true);
  });

  it('canonical link key function correctly orders node pairs symmetrically', () => {
    expect(getCanonicalLinkKey('router-01', 'core-switch-01')).toBe(
      getCanonicalLinkKey('core-switch-01', 'router-01')
    );
    expect(getCanonicalLinkKey('node-b', 'node-a')).toBe('node-a---node-b');
  });
});
