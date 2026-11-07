import React, { useMemo } from 'react';
import type { Topology, TopologyNode } from '../../engine/topology/types';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  Server,
  Network,
  Radio,
  Activity,
  Layers,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  X,
  ExternalLink,
  HardDrive,
  AlertOctagon,
  ArrowRightLeft,
} from 'lucide-react';

interface TopologyInspectorProps {
  topology: Topology;
  selectedNodeId?: string | null;
  selectedLinkId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  onSelectLink?: (linkId: string | null) => void;
  className?: string;
}

export const TopologyInspector: React.FC<TopologyInspectorProps> = ({
  topology,
  selectedNodeId: propSelectedNodeId,
  selectedLinkId: propSelectedLinkId,
  onSelectNode: propOnSelectNode,
  onSelectLink: propOnSelectLink,
  className = '',
}) => {
  // Store synchronization
  const storeSelectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const storeSelectedLinkId = useSimulationStore((state) => state.selectedLinkId);
  const storeSetSelectedNodeId = useSimulationStore((state) => state.setSelectedNodeId);
  const storeSetSelectedLinkId = useSimulationStore((state) => state.setSelectedLinkId);

  const activeNodeId = propSelectedNodeId !== undefined ? propSelectedNodeId : storeSelectedNodeId;
  const activeLinkId = propSelectedLinkId !== undefined ? propSelectedLinkId : storeSelectedLinkId;

  const handleSelectNode = (id: string | null) => {
    if (propOnSelectNode) {
      propOnSelectNode(id);
    } else {
      storeSetSelectedNodeId(id);
    }
  };

  const handleSelectLink = (id: string | null) => {
    if (propOnSelectLink) {
      propOnSelectLink(id);
    } else {
      storeSetSelectedLinkId(id);
    }
  };

  // Node Map for fast ID lookups
  const nodeMap = useMemo(() => {
    const map = new Map<string, TopologyNode>();
    if (topology?.nodes) {
      for (const n of topology.nodes) {
        map.set(n.id, n);
      }
    }
    return map;
  }, [topology]);

  // Selected Node lookup
  const selectedNode = activeNodeId ? nodeMap.get(activeNodeId) : null;
  const isNodeMissing = Boolean(activeNodeId && !selectedNode);

  // Selected Link lookup
  const selectedLink = useMemo(() => {
    if (!activeLinkId || !topology?.links) return null;
    return (
      topology.links.find(
        (l) => l.id === activeLinkId || l.id.toLowerCase() === activeLinkId.toLowerCase()
      ) || null
    );
  }, [activeLinkId, topology]);

  const isLinkMissing = Boolean(activeLinkId && !selectedLink);

  // Connected links for the selected node
  const connectedLinks = useMemo(() => {
    if (!selectedNode || !topology?.links) return [];
    return topology.links.filter((l) => {
      const src = l.source_id || l.sourceId || '';
      const tgt = l.target_id || l.targetId || '';
      return src === selectedNode.id || tgt === selectedNode.id;
    });
  }, [selectedNode, topology]);

  // Child servers for a rack node
  const childServers = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'rack' || !topology?.nodes) return [];
    return topology.nodes.filter(
      (n) => n.parent_id === selectedNode.id || n.parentId === selectedNode.id
    );
  }, [selectedNode, topology]);

  // Helper for type badges
  const getNodeTypeBadge = (type: string) => {
    switch (type) {
      case 'router':
        return {
          label: 'EDGE ROUTER',
          bg: 'bg-cyan-950/80',
          text: 'text-cyan-300',
          border: 'border-cyan-700/60',
          icon: Radio,
        };
      case 'core_switch':
        return {
          label: 'CORE SWITCH',
          bg: 'bg-purple-950/80',
          text: 'text-purple-300',
          border: 'border-purple-700/60',
          icon: Network,
        };
      case 'access_switch':
        return {
          label: 'ACCESS SWITCH',
          bg: 'bg-sky-950/80',
          text: 'text-sky-300',
          border: 'border-sky-700/60',
          icon: Activity,
        };
      case 'rack':
        return {
          label: 'SERVER RACK (42U)',
          bg: 'bg-slate-900/80',
          text: 'text-slate-300',
          border: 'border-slate-700/60',
          icon: Layers,
        };
      case 'server':
        return {
          label: 'COMPUTE BLADE',
          bg: 'bg-emerald-950/80',
          text: 'text-emerald-300',
          border: 'border-emerald-700/60',
          icon: Server,
        };
      default:
        return {
          label: type.toUpperCase(),
          bg: 'bg-slate-900',
          text: 'text-slate-400',
          border: 'border-slate-700',
          icon: Cpu,
        };
    }
  };

  const renderStatus = (status?: string) => {
    const s = (status || 'UNKNOWN').toLowerCase();
    switch (s) {
      case 'online':
        return (
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ONLINE
          </span>
        );
      case 'degraded':
        return (
          <span className="flex items-center gap-1.5 text-amber-400 font-semibold font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            DEGRADED
          </span>
        );
      case 'offline':
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 text-rose-400 font-semibold font-mono">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            {s.toUpperCase()}
          </span>
        );
      case 'maintenance':
      case 'congested':
        return (
          <span className="flex items-center gap-1.5 text-sky-400 font-semibold font-mono">
            <Wrench className="w-3.5 h-3.5 text-sky-400" />
            {s.toUpperCase()}
          </span>
        );
      default:
        return <span className="text-slate-400 font-mono uppercase">{status || 'N/A'}</span>;
    }
  };

  // Safe config extractor avoiding crash on null/undefined
  const config = useMemo(() => {
    if (
      !selectedNode ||
      typeof selectedNode.configuration !== 'object' ||
      !selectedNode.configuration
    ) {
      return {} as Record<string, unknown>;
    }
    return selectedNode.configuration as Record<string, unknown>;
  }, [selectedNode]);

  // 1. EMPTY TOPOLOGY STATE
  if (!topology || !topology.nodes || topology.nodes.length === 0) {
    return (
      <div
        className={`p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center font-mono ${className}`}
        role="region"
        aria-label="Topology Inspector Empty"
      >
        <AlertOctagon className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-80" />
        <h3 className="text-sm font-semibold text-white mb-1">Topology Graph is Empty</h3>
        <p className="text-xs text-slate-400">
          No hardware nodes or network links available to inspect.
        </p>
      </div>
    );
  }

  // 2. INVALID / MISSING SELECTED NODE ERROR STATE
  if (isNodeMissing) {
    return (
      <div
        className={`p-5 rounded-xl bg-slate-900/40 border border-rose-900/50 backdrop-blur-md font-mono ${className}`}
        role="alert"
        aria-label="Node Not Found Error"
      >
        <div className="flex items-center justify-between pb-3 border-b border-rose-900/40 mb-3">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>NODE NOT FOUND</span>
          </div>
          <button
            onClick={() => handleSelectNode(null)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Clear Selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-slate-300 mb-2">
          Node ID{' '}
          <code className="text-rose-300 font-semibold px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40">
            "{activeNodeId}"
          </code>{' '}
          does not exist in the current topology specification.
        </p>
        <p className="text-[11px] text-slate-400 mb-4">
          The node may have been removed or an invalid identifier was provided.
        </p>
        <button
          onClick={() => handleSelectNode(null)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
        >
          Reset Selection
        </button>
      </div>
    );
  }

  // 3. INVALID / MISSING SELECTED LINK ERROR STATE
  if (isLinkMissing) {
    return (
      <div
        className={`p-5 rounded-xl bg-slate-900/40 border border-rose-900/50 backdrop-blur-md font-mono ${className}`}
        role="alert"
        aria-label="Link Not Found Error"
      >
        <div className="flex items-center justify-between pb-3 border-b border-rose-900/40 mb-3">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>LINK NOT FOUND</span>
          </div>
          <button
            onClick={() => handleSelectLink(null)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Clear Selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-slate-300 mb-2">
          Link ID{' '}
          <code className="text-rose-300 font-semibold px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40">
            "{activeLinkId}"
          </code>{' '}
          was not found in the topology graph.
        </p>
        <button
          onClick={() => handleSelectLink(null)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
        >
          Reset Selection
        </button>
      </div>
    );
  }

  // 4. SELECTED LINK VIEW
  if (selectedLink) {
    const srcId = selectedLink.source_id || selectedLink.sourceId || '';
    const tgtId = selectedLink.target_id || selectedLink.targetId || '';
    const bw = selectedLink.bandwidth_mbps ?? selectedLink.bandwidthMbps ?? 'N/A';
    const lat = selectedLink.latency_ms ?? selectedLink.latencyMs ?? 'N/A';
    const srcNode = nodeMap.get(srcId);
    const tgtNode = nodeMap.get(tgtId);

    return (
      <div
        className={`bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md text-xs font-mono ${className}`}
        role="region"
        aria-label={`Link Inspector: ${selectedLink.id}`}
      >
        {/* Link Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-300">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-sm">{selectedLink.id}</h3>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                  NETWORK LINK
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Bidirectional Network Channel</p>
            </div>
          </div>
          <button
            onClick={() => handleSelectLink(null)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Deselect Link"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Link Attributes */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[11px]">STATUS</span>
            {renderStatus(selectedLink.status)}
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[11px]">BANDWIDTH</span>
            <span className="text-cyan-300 font-semibold">{bw} Mbps</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[11px]">PROPAGATION LATENCY</span>
            <span className="text-purple-300 font-semibold">{lat} ms</span>
          </div>
        </div>

        {/* Endpoint Navigation */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Connected Endpoints
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSelectNode(srcId)}
              className="p-2 rounded bg-slate-950/70 border border-slate-800 hover:border-cyan-500/60 text-left transition-colors group"
            >
              <span className="text-[9px] text-slate-400 block">SOURCE NODE</span>
              <span className="text-cyan-300 font-semibold group-hover:underline truncate block">
                {srcNode?.name || srcId}
              </span>
              <span className="text-[9px] text-slate-400 truncate block">({srcId})</span>
            </button>
            <button
              onClick={() => handleSelectNode(tgtId)}
              className="p-2 rounded bg-slate-950/70 border border-slate-800 hover:border-cyan-500/60 text-left transition-colors group"
            >
              <span className="text-[9px] text-slate-400 block">TARGET NODE</span>
              <span className="text-cyan-300 font-semibold group-hover:underline truncate block">
                {tgtNode?.name || tgtId}
              </span>
              <span className="text-[9px] text-slate-400 truncate block">({tgtId})</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. NO SELECTION EMPTY STATE
  if (!selectedNode) {
    return (
      <div
        className={`bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md flex flex-col justify-between text-xs font-mono ${className}`}
        role="region"
        aria-label="Network Topology Hierarchy"
      >
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Network Topology Hierarchy
              </h2>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
              PRD Invariant
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            Select any node or cable link from the 2D tree or 3D viewport to inspect its live
            properties and logical links.
          </p>

          <div className="space-y-2 font-mono text-xs mb-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-cyan-300 font-semibold">Router</span>
              <span className="text-slate-400 text-[11px]">50 Mbps link default</span>
            </div>
            <div className="text-center text-slate-400 text-[10px]">↓ 1ms latency</div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-violet-300 font-semibold">Core Switch</span>
              <span className="text-slate-400 text-[11px]">25 Mbps link default</span>
            </div>
            <div className="text-center text-slate-400 text-[10px]">↓ 1ms latency</div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-blue-300 font-semibold">2x Access Switches</span>
              <span className="text-slate-400 text-[11px]">10 Mbps link default</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
              <span className="text-[9px] text-slate-400 block">TOTAL HARDWARE</span>
              <span className="text-white font-bold">{topology.nodes.length} Nodes</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">4 Tiers • 4 Racks</span>
            </div>
            <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
              <span className="text-[9px] text-slate-400 block">NETWORK LINKS</span>
              <span className="text-cyan-400 font-bold">{topology.links.length} Links</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">15 Bidirectional</span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 pt-2.5 border-t border-slate-800/60 mt-3">
          Note: Racks are spatial grouping objects and do not forward traffic.
        </div>
      </div>
    );
  }

  // 6. POPULATED NODE INSPECTION
  const badge = getNodeTypeBadge(selectedNode.type);
  const Icon = badge.icon;
  const parentRackId = selectedNode.parent_id || selectedNode.parentId;

  return (
    <div
      className={`bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md text-xs font-mono space-y-3.5 ${className}`}
      role="region"
      aria-label={`Node Inspector: ${selectedNode.name}`}
    >
      {/* Node Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg border ${badge.bg} ${badge.border}`}>
            <Icon className={`w-4 h-4 ${badge.text}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                Node Details: {selectedNode.id}
              </h2>
            </div>
            <h3 className="font-semibold text-white text-sm leading-tight mt-0.5">
              {selectedNode.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${badge.bg} ${badge.text} ${badge.border}`}
              >
                {badge.label}
              </span>
              <span className="text-[10px] text-slate-400">ID: {selectedNode.id}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => handleSelectNode(null)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Deselect Node"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Common Properties */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Core Identification
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400">STATUS</span>
            {renderStatus(selectedNode.status)}
          </div>
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400">TYPE</span>
            <span className="text-white font-semibold uppercase">{selectedNode.type}</span>
          </div>
        </div>

        {/* Parent ID if applicable */}
        {parentRackId && (
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">PARENT RACK</span>
            <button
              onClick={() => handleSelectNode(parentRackId as string)}
              className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>{parentRackId}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* 3D Coordinates */}
        {selectedNode.position && (
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span>3D POSITION [X, Y, Z]</span>
            <span className="text-slate-300 font-mono">
              [{selectedNode.position.map((p) => p.toFixed(1)).join(', ')}]
            </span>
          </div>
        )}
      </div>

      {/* Hardware & Config Specifications */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Hardware & Network Configuration
        </div>

        {/* 1. SERVER CONFIG */}
        {selectedNode.type === 'server' && (
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[9px]">vCPU</span>
              <span className="text-cyan-300 font-bold text-sm">
                {String(config.vcpu ?? 'N/A')} Cores
              </span>
            </div>
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[9px]">RAM</span>
              <span className="text-purple-300 font-bold text-sm">
                {String(config.ram_gb ?? 'N/A')} GB
              </span>
            </div>
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800 col-span-2 flex items-center justify-between">
              <span className="text-slate-400 text-[10px]">LOCAL STORAGE</span>
              <span className="text-slate-200 font-semibold">
                {String(config.storage_gb ?? 'N/A')} GB NVMe
              </span>
            </div>
          </div>
        )}

        {/* 2. NETWORK DEVICE CONFIG */}
        {(selectedNode.type === 'router' ||
          selectedNode.type === 'core_switch' ||
          selectedNode.type === 'access_switch') && (
          <div className="space-y-1.5 text-[11px]">
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">SWITCHING CAPACITY</span>
              <span className="text-cyan-300 font-bold text-sm">
                {String(config.switching_capacity_gbps ?? 'N/A')} Gbps
              </span>
            </div>
            {Array.isArray(config.assigned_rack_ids) && (
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[10px] block mb-1">
                  ASSIGNED SERVER RACKS:
                </span>
                <div className="flex flex-wrap gap-1">
                  {config.assigned_rack_ids.map((rackId) => (
                    <button
                      key={String(rackId)}
                      onClick={() => handleSelectNode(String(rackId))}
                      className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700 text-[10px] transition-colors"
                    >
                      {String(rackId)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. RACK CONFIG & CHILD SERVERS */}
        {selectedNode.type === 'rack' && (
          <div className="space-y-2 text-[11px]">
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 block text-[9px]">TOTAL UNITS</span>
                <span className="text-cyan-300 font-bold text-sm">
                  {String(config.total_u ?? '42')}U
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 block text-[9px]">SERVER CAPACITY</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {childServers.length} / {String(config.server_capacity ?? '3')}
                </span>
              </div>
            </div>

            {/* Spatial Notice */}
            <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 italic">
              Spatial Grouping Container: Physical racks house compute blades and do not forward
              network traffic.
            </div>

            {/* Child Server Blades List */}
            <div>
              <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                Mounted Compute Blades ({childServers.length}):
              </span>
              <div className="space-y-1">
                {childServers.map((server) => (
                  <button
                    key={server.id}
                    onClick={() => handleSelectNode(server.id)}
                    className="w-full flex items-center justify-between p-1.5 rounded bg-slate-950/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/60 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3 h-3 text-emerald-400" />
                      <span className="text-white group-hover:text-emerald-300 font-semibold text-[11px]">
                        {server.name}
                      </span>
                    </div>
                    <span className="text-slate-400 text-[10px]">({server.id}) →</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* IP & MAC Addressing */}
        {(Boolean(config.ip_address) || Boolean(config.mac_address)) && (
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800 space-y-1 text-[10px]">
            {Boolean(config.ip_address) && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">IP ADDRESS</span>
                <span className="text-cyan-300 font-semibold">{String(config.ip_address)}</span>
              </div>
            )}
            {Boolean(config.mac_address) && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">MAC ADDRESS</span>
                <span className="text-slate-300 truncate max-w-[150px]">
                  {String(config.mac_address)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connected Logical Links */}
      {selectedNode.type !== 'rack' && (
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Connected Links ({connectedLinks.length})</span>
            <HardDrive className="w-3 h-3 text-cyan-400" />
          </div>

          {connectedLinks.length === 0 ? (
            <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 italic text-center">
              No direct logical links configured.
            </div>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {connectedLinks.map((link) => {
                const src = link.source_id || link.sourceId || '';
                const tgt = link.target_id || link.targetId || '';
                const peerId = src === selectedNode.id ? tgt : src;
                const peerNode = nodeMap.get(peerId);
                const bw = link.bandwidth_mbps ?? link.bandwidthMbps ?? 'N/A';
                const lat = link.latency_ms ?? link.latencyMs ?? 'N/A';

                return (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-[10px]"
                  >
                    <button
                      onClick={() => handleSelectNode(peerId)}
                      className="text-cyan-300 hover:text-cyan-200 hover:underline font-semibold flex items-center gap-1 truncate max-w-[140px]"
                      title={`Inspect ${peerId}`}
                    >
                      <span>↔ {peerNode ? peerNode.name : peerId}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectLink(link.id)}
                        className="text-emerald-400 font-semibold hover:underline"
                        title="Inspect Link"
                      >
                        {bw} Mbps
                      </button>
                      <span className="text-slate-400">{lat}ms</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
