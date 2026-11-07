import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeInspector } from '../three/ui/NodeInspector';
import { createStarterTopology } from '../engine/topology';
import { useSimulationStore } from '../store/useSimulationStore';
import { CommandCenterView } from '../features/simulation/CommandCenterView';

// Mock DataCenterViewport inside CommandCenterView tests
vi.mock('../three/scene/DataCenterViewport', () => ({
  DataCenterViewport: () => (
    <div data-testid="datacenter-viewport-mock">3D Data Center Viewport</div>
  ),
}));

describe('3D Topology Scene Structure & Node Mapping', () => {
  const topology = createStarterTopology();

  it('provides defined 3D positions for all 20 nodes', () => {
    expect(topology.nodes).toHaveLength(20);
    for (const node of topology.nodes) {
      expect(node.position).toBeDefined();
      expect(node.position).toHaveLength(3);
      expect(node.position?.every((coord) => typeof coord === 'number')).toBe(true);
    }
  });

  it('guarantees every logical link has valid source and target 3D coordinates', () => {
    const nodeMap = new Map(topology.nodes.map((n) => [n.id, n]));

    expect(topology.links).toHaveLength(15);
    for (const link of topology.links) {
      const src = nodeMap.get(link.source_id);
      const tgt = nodeMap.get(link.target_id);

      expect(src).toBeDefined();
      expect(tgt).toBeDefined();
      expect(src?.position).toBeDefined();
      expect(tgt?.position).toBeDefined();
    }
  });

  it('verifies that no network links connect to rack nodes', () => {
    const rackIds = new Set(topology.nodes.filter((n) => n.type === 'rack').map((n) => n.id));

    for (const link of topology.links) {
      expect(rackIds.has(link.source_id)).toBe(false);
      expect(rackIds.has(link.target_id)).toBe(false);
    }
  });

  it('verifies server blade placement: 3 servers per rack within physical rack volume', () => {
    const racks = topology.nodes.filter((n) => n.type === 'rack');
    const servers = topology.nodes.filter((n) => n.type === 'server');

    expect(racks).toHaveLength(4);
    expect(servers).toHaveLength(12);

    for (const rack of racks) {
      const mountedServers = servers.filter((s) => s.parent_id === rack.id);
      expect(mountedServers).toHaveLength(3);

      // Verify server X matches rack X
      const rackX = rack.position?.[0];
      for (const srv of mountedServers) {
        expect(srv.position?.[0]).toBe(rackX);
        // Verify server height is inside rack vertical height (0 to 3.6m)
        const srvY = srv.position?.[1] ?? 0;
        expect(srvY).toBeGreaterThan(0);
        expect(srvY).toBeLessThan(3.6);
      }
    }
  });
});

describe('3D NodeInspector HUD Component', () => {
  const topology = createStarterTopology();
  const serverNode = topology.nodes.find((n) => n.id === 'server-01')!;
  const routerNode = topology.nodes.find((n) => n.id === 'router-01')!;
  const rackNode = topology.nodes.find((n) => n.id === 'rack-01')!;

  it('renders server node details, hardware configuration, and connected link', () => {
    const handleClose = vi.fn();
    const handleSelectNode = vi.fn();

    render(
      <NodeInspector
        selectedNode={serverNode}
        allNodes={topology.nodes}
        allLinks={topology.links}
        onClose={handleClose}
        onSelectNode={handleSelectNode}
      />
    );

    expect(screen.getByText('Application Server 01')).toBeInTheDocument();
    expect(screen.getByText('server-01')).toBeInTheDocument();
    expect(screen.getByText('COMPUTE BLADE')).toBeInTheDocument();
    expect(screen.getByText('8 Cores')).toBeInTheDocument();
    expect(screen.getByText('16 GB')).toBeInTheDocument();
    expect(screen.getByText('256 GB NVMe')).toBeInTheDocument();
    expect(screen.getByText('ONLINE')).toBeInTheDocument();

    // Connected link to access switch
    expect(screen.getByText('↔ access-switch-01')).toBeInTheDocument();
    expect(screen.getByText('10 Mbps')).toBeInTheDocument();

    // Close button triggers onClose
    const closeBtn = screen.getByTitle('Deselect Node');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders router node details and 50 Mbps uplink connection', () => {
    render(
      <NodeInspector
        selectedNode={routerNode}
        allNodes={topology.nodes}
        allLinks={topology.links}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Edge Gateway Router 01')).toBeInTheDocument();
    expect(screen.getByText('EDGE ROUTER')).toBeInTheDocument();
    expect(screen.getByText('100 Gbps')).toBeInTheDocument();
    expect(screen.getByText('↔ core-switch-01')).toBeInTheDocument();
    expect(screen.getByText('50 Mbps')).toBeInTheDocument();
  });

  it('renders rack node details and lists mounted server blades', () => {
    const handleSelectNode = vi.fn();

    render(
      <NodeInspector
        selectedNode={rackNode}
        allNodes={topology.nodes}
        allLinks={topology.links}
        onClose={vi.fn()}
        onSelectNode={handleSelectNode}
      />
    );

    expect(screen.getByText('Server Rack A1')).toBeInTheDocument();
    expect(screen.getByText('SERVER RACK (42U)')).toBeInTheDocument();
    expect(screen.getByText('42U')).toBeInTheDocument();
    expect(screen.getByText('No direct network links (Spatial container)')).toBeInTheDocument();

    // Racks contain server buttons
    expect(screen.getByText('server-01')).toBeInTheDocument();
    expect(screen.getByText('server-02')).toBeInTheDocument();
    expect(screen.getByText('server-03')).toBeInTheDocument();

    fireEvent.click(screen.getByText('server-02'));
    expect(handleSelectNode).toHaveBeenCalledWith('server-02');
  });

  it('returns null when selectedNode is null', () => {
    const { container } = render(
      <NodeInspector
        selectedNode={null}
        allNodes={topology.nodes}
        allLinks={topology.links}
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe('CommandCenterView Selection Sync', () => {
  beforeEach(() => {
    useSimulationStore.setState({ selectedNodeId: null });
  });

  it('renders default PRD Network Hierarchy when no node is selected', () => {
    render(<CommandCenterView />);

    expect(screen.getByText('Network Topology Hierarchy')).toBeInTheDocument();
    expect(screen.getByText('PRD Invariant')).toBeInTheDocument();
    expect(screen.getByText('50 Mbps link default')).toBeInTheDocument();
  });

  it('synchronizes and displays selected node details when selectedNodeId is set', () => {
    useSimulationStore.setState({ selectedNodeId: 'server-04' });

    render(<CommandCenterView />);

    expect(screen.getByText('Node Details: server-04')).toBeInTheDocument();
    expect(screen.getAllByText('Application Server 04').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('rack-02').length).toBeGreaterThanOrEqual(1);

    // Clicking clear deselects node
    const clearBtn = screen.getByTitle('Deselect Node');
    fireEvent.click(clearBtn);

    expect(useSimulationStore.getState().selectedNodeId).toBeNull();
  });
});
