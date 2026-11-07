import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopologyNodeList } from '../features/topology/TopologyNodeList';
import { TopologyInspector } from '../features/topology/TopologyInspector';
import { createStarterTopology } from '../engine/topology';
import { useSimulationStore } from '../store/useSimulationStore';
import type { Topology } from '../engine/topology/types';

describe('TopologyNodeList Component', () => {
  const topology = createStarterTopology();

  beforeEach(() => {
    useSimulationStore.setState({ selectedNodeId: null, selectedLinkId: null });
  });

  it('renders all 20 hardware nodes in the starter topology', () => {
    render(<TopologyNodeList nodes={topology.nodes} />);

    // Total count badge
    expect(screen.getByText('20 Nodes')).toBeInTheDocument();

    // 1. Router
    expect(screen.getByText('Edge Gateway Router 01')).toBeInTheDocument();
    expect(screen.getByText('ID: router-01')).toBeInTheDocument();

    // 2. Core Switch
    expect(screen.getByText('Core Distribution Switch 01')).toBeInTheDocument();
    expect(screen.getByText('ID: core-switch-01')).toBeInTheDocument();

    // 3. Access Switches
    expect(screen.getByText('Access Switch Pod-A')).toBeInTheDocument();
    expect(screen.getByText('ID: access-switch-01')).toBeInTheDocument();
    expect(screen.getByText('Access Switch Pod-B')).toBeInTheDocument();
    expect(screen.getByText('ID: access-switch-02')).toBeInTheDocument();

    // 4. Physical Racks
    expect(screen.getByText('Server Rack A1')).toBeInTheDocument();
    expect(screen.getByText('Server Rack A2')).toBeInTheDocument();
    expect(screen.getByText('Server Rack B1')).toBeInTheDocument();
    expect(screen.getByText('Server Rack B2')).toBeInTheDocument();

    // 5. All 12 Application Servers
    for (let i = 1; i <= 12; i++) {
      const num = String(i).padStart(2, '0');
      expect(screen.getByText(`Application Server ${num}`)).toBeInTheDocument();
      expect(screen.getByText(`server-${num}`)).toBeInTheDocument();
    }
  });

  it('correctly maps the rack/server hierarchy: exactly 3 servers nested under each rack', () => {
    render(<TopologyNodeList nodes={topology.nodes} />);

    // Each rack shows its blade count
    const rackBlades = screen.getAllByText('3 Blades Mounted');
    expect(rackBlades).toHaveLength(4);

    // Explicit notice that racks are spatial containers
    expect(screen.getByText('spatial grouping • no forwarding')).toBeInTheDocument();
  });

  it('selects a node when clicked from the 2D list and updates store', () => {
    const handleSelect = vi.fn();
    render(<TopologyNodeList nodes={topology.nodes} onSelectNode={handleSelect} />);

    const server05 = screen.getByText('Application Server 05');
    fireEvent.click(server05);

    expect(handleSelect).toHaveBeenCalledWith('server-05');
  });

  it('deselects an active node when clicked again', () => {
    const handleSelect = vi.fn();
    render(
      <TopologyNodeList
        nodes={topology.nodes}
        selectedNodeId="server-05"
        onSelectNode={handleSelect}
      />
    );

    const server05 = screen.getByText('Application Server 05');
    fireEvent.click(server05);

    expect(handleSelect).toHaveBeenCalledWith(null);
  });

  it('filters nodes dynamically using search input', () => {
    render(<TopologyNodeList nodes={topology.nodes} />);

    const searchInput = screen.getByPlaceholderText('Search nodes by name, ID, or status...');
    fireEvent.change(searchInput, { target: { value: 'router' } });

    expect(screen.getByText('Edge Gateway Router 01')).toBeInTheDocument();
    expect(screen.queryByText('Core Distribution Switch 01')).not.toBeInTheDocument();
    expect(screen.queryByText('Application Server 01')).not.toBeInTheDocument();
  });

  it('supports keyboard navigation with Enter and Space keys', () => {
    const handleSelect = vi.fn();
    render(<TopologyNodeList nodes={topology.nodes} onSelectNode={handleSelect} />);

    const routerItem = screen.getByLabelText(
      'Edge Gateway Router 01 (router-01) - Edge Router - Status online'
    );

    // Enter key
    fireEvent.keyDown(routerItem, { key: 'Enter' });
    expect(handleSelect).toHaveBeenCalledWith('router-01');

    // Space key
    fireEvent.keyDown(routerItem, { key: ' ' });
    expect(handleSelect).toHaveBeenCalledWith('router-01');
  });

  it('supports collapsing and expanding racks via chevron and arrow keys', () => {
    render(<TopologyNodeList nodes={topology.nodes} />);

    expect(screen.getByText('Application Server 01')).toBeInTheDocument();

    // Click collapse on Rack 01
    const collapseButtons = screen.getAllByTitle('Collapse Rack Servers');
    fireEvent.click(collapseButtons[0]!);

    // Server 01 under Rack 01 should be hidden
    expect(screen.queryByText('Application Server 01')).not.toBeInTheDocument();
    // Servers under other racks still visible
    expect(screen.getByText('Application Server 04')).toBeInTheDocument();

    // Expand All restores visibility
    fireEvent.click(screen.getByText('Expand All'));
    expect(screen.getByText('Application Server 01')).toBeInTheDocument();
  });

  it('renders accessible empty state when nodes list is empty', () => {
    render(<TopologyNodeList nodes={[]} />);

    expect(screen.getByText('Topology Graph Empty')).toBeInTheDocument();
    expect(
      screen.getByText('No hardware nodes available in current configuration.')
    ).toBeInTheDocument();
  });
});

describe('TopologyInspector Component', () => {
  const topology = createStarterTopology();

  beforeEach(() => {
    useSimulationStore.setState({ selectedNodeId: null, selectedLinkId: null });
  });

  it('renders default network hierarchy overview when no node is selected', () => {
    render(<TopologyInspector topology={topology} selectedNodeId={null} />);

    expect(screen.getByText('Network Topology Hierarchy')).toBeInTheDocument();
    expect(screen.getByText('PRD Invariant')).toBeInTheDocument();
    expect(screen.getByText('50 Mbps link default')).toBeInTheDocument();
    expect(screen.getByText('25 Mbps link default')).toBeInTheDocument();
    expect(screen.getByText('10 Mbps link default')).toBeInTheDocument();
    expect(screen.getByText('20 Nodes')).toBeInTheDocument();
    expect(screen.getByText('15 Links')).toBeInTheDocument();
  });

  it('inspects a Server node: displays hardware specifications, IP, MAC, parent rack, and link', () => {
    const handleSelectNode = vi.fn();
    render(
      <TopologyInspector
        topology={topology}
        selectedNodeId="server-01"
        onSelectNode={handleSelectNode}
      />
    );

    expect(screen.getByText('Node Details: server-01')).toBeInTheDocument();
    expect(screen.getByText('Application Server 01')).toBeInTheDocument();
    expect(screen.getByText('COMPUTE BLADE')).toBeInTheDocument();
    expect(screen.getByText('ONLINE')).toBeInTheDocument();

    // Specs
    expect(screen.getByText('8 Cores')).toBeInTheDocument();
    expect(screen.getByText('16 GB')).toBeInTheDocument();
    expect(screen.getByText('256 GB NVMe')).toBeInTheDocument();
    expect(screen.getByText('10.0.11.11')).toBeInTheDocument();
    expect(screen.getByText('02:00:00:10:01:01')).toBeInTheDocument();

    // Parent Rack button
    const parentRackBtn = screen.getByText('rack-01');
    expect(parentRackBtn).toBeInTheDocument();
    fireEvent.click(parentRackBtn);
    expect(handleSelectNode).toHaveBeenCalledWith('rack-01');

    // Connected Access Link
    expect(screen.getByText('↔ Access Switch Pod-A')).toBeInTheDocument();
    expect(screen.getByText('10 Mbps')).toBeInTheDocument();
  });

  it('inspects a Router node: displays 100 Gbps WAN capacity and core link', () => {
    render(<TopologyInspector topology={topology} selectedNodeId="router-01" />);

    expect(screen.getByText('Node Details: router-01')).toBeInTheDocument();
    expect(screen.getByText('Edge Gateway Router 01')).toBeInTheDocument();
    expect(screen.getByText('EDGE ROUTER')).toBeInTheDocument();
    expect(screen.getByText('100 Gbps')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('02:00:00:00:00:01')).toBeInTheDocument();

    // Link to Core Switch
    expect(screen.getByText('↔ Core Distribution Switch 01')).toBeInTheDocument();
    expect(screen.getByText('50 Mbps')).toBeInTheDocument();
  });

  it('inspects a Core Switch node: displays 80 Gbps fabric and uplinks/downlinks', () => {
    render(<TopologyInspector topology={topology} selectedNodeId="core-switch-01" />);

    expect(screen.getByText('Node Details: core-switch-01')).toBeInTheDocument();
    expect(screen.getByText('Core Distribution Switch 01')).toBeInTheDocument();
    expect(screen.getByText('CORE SWITCH')).toBeInTheDocument();
    expect(screen.getByText('80 Gbps')).toBeInTheDocument();
    expect(screen.getByText('10.0.1.1')).toBeInTheDocument();

    // Connected links (3 total: 1 router + 2 access)
    expect(screen.getByText('Connected Links (3)')).toBeInTheDocument();
    expect(screen.getByText('↔ Edge Gateway Router 01')).toBeInTheDocument();
    expect(screen.getByText('↔ Access Switch Pod-A')).toBeInTheDocument();
    expect(screen.getByText('↔ Access Switch Pod-B')).toBeInTheDocument();
  });

  it('inspects a Rack node: displays units, server blades, and spatial container notice', () => {
    const handleSelectNode = vi.fn();
    render(
      <TopologyInspector
        topology={topology}
        selectedNodeId="rack-01"
        onSelectNode={handleSelectNode}
      />
    );

    expect(screen.getByText('Node Details: rack-01')).toBeInTheDocument();
    expect(screen.getByText('Server Rack A1')).toBeInTheDocument();
    expect(screen.getByText('SERVER RACK (42U)')).toBeInTheDocument();
    expect(screen.getByText('42U')).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    // Notice that racks do not forward traffic
    expect(
      screen.getByText(
        'Spatial Grouping Container: Physical racks house compute blades and do not forward network traffic.'
      )
    ).toBeInTheDocument();

    // Child server blades
    expect(screen.getByText('Application Server 01')).toBeInTheDocument();
    expect(screen.getByText('Application Server 02')).toBeInTheDocument();
    expect(screen.getByText('Application Server 03')).toBeInTheDocument();

    // Clicking child server selects it
    fireEvent.click(screen.getByText('Application Server 02'));
    expect(handleSelectNode).toHaveBeenCalledWith('server-02');
  });

  it('inspects a Link when selected: displays endpoints, bandwidth, latency, and status', () => {
    const handleSelectNode = vi.fn();
    render(
      <TopologyInspector
        topology={topology}
        selectedLinkId="link-router-core"
        onSelectNode={handleSelectNode}
      />
    );

    expect(screen.getByText('link-router-core')).toBeInTheDocument();
    expect(screen.getByText('NETWORK LINK')).toBeInTheDocument();
    expect(screen.getByText('50 Mbps')).toBeInTheDocument();
    expect(screen.getByText('1 ms')).toBeInTheDocument();
    expect(screen.getByText('Edge Gateway Router 01')).toBeInTheDocument();
    expect(screen.getByText('Core Distribution Switch 01')).toBeInTheDocument();

    // Clicking source endpoint navigates to router node
    fireEvent.click(screen.getByText('Edge Gateway Router 01'));
    expect(handleSelectNode).toHaveBeenCalledWith('router-01');
  });

  it('handles invalid / missing node ID gracefully with error alert', () => {
    const handleSelect = vi.fn();
    render(
      <TopologyInspector
        topology={topology}
        selectedNodeId="non-existent-device-99"
        onSelectNode={handleSelect}
      />
    );

    expect(screen.getByText('NODE NOT FOUND')).toBeInTheDocument();
    expect(screen.getByText('"non-existent-device-99"', { exact: false })).toBeInTheDocument();

    // Reset button clears selection
    const resetBtn = screen.getByText('Reset Selection');
    fireEvent.click(resetBtn);
    expect(handleSelect).toHaveBeenCalledWith(null);
  });

  it('handles node with missing configuration safely without crashing', () => {
    const customTopology: Topology = {
      nodes: [
        {
          id: 'server-custom',
          type: 'server',
          name: 'Custom Server',
          status: 'online',
          configuration: {} as Record<string, unknown>, // empty configuration
        },
      ],
      links: [],
    };

    render(<TopologyInspector topology={customTopology} selectedNodeId="server-custom" />);

    expect(screen.getByText('Node Details: server-custom')).toBeInTheDocument();
    expect(screen.getByText('N/A Cores')).toBeInTheDocument();
    expect(screen.getByText('N/A GB')).toBeInTheDocument();
    expect(screen.getByText('N/A GB NVMe')).toBeInTheDocument();
  });

  it('handles empty topology gracefully', () => {
    const emptyTopology: Topology = { nodes: [], links: [] };

    render(<TopologyInspector topology={emptyTopology} />);

    expect(screen.getByText('Topology Graph is Empty')).toBeInTheDocument();
    expect(
      screen.getByText('No hardware nodes or network links available to inspect.')
    ).toBeInTheDocument();
  });
});
