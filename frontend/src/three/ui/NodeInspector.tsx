import React, { useState } from 'react';
import type { TopologyNode, TopologyLink } from '../../engine/topology/types';
import {
  Server,
  Network,
  Cpu,
  Layers,
  Activity,
  X,
  HardDrive,
  Radio,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface NodeInspectorProps {
  selectedNode: TopologyNode | null;
  allNodes: TopologyNode[];
  allLinks: TopologyLink[];
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  selectedNode,
  allNodes,
  allLinks,
  onClose,
  onSelectNode,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!selectedNode) return null;

  // Find connected links
  const connectedLinks = allLinks.filter(
    (l) =>
      l.source_id === selectedNode.id ||
      l.target_id === selectedNode.id ||
      l.sourceId === selectedNode.id ||
      l.targetId === selectedNode.id
  );

  // If rack, find contained servers
  const containedServers =
    selectedNode.type === 'rack'
      ? allNodes.filter((n) => n.parent_id === selectedNode.id || n.parentId === selectedNode.id)
      : [];

  const config = (selectedNode.configuration || {}) as Record<string, unknown>;

  const getNodeTypeBadge = (type: string) => {
    switch (type) {
      case 'router':
        return {
          label: 'EDGE ROUTER',
          bg: 'bg-cyan-950/80',
          text: 'text-cyan-300',
          border: 'border-cyan-700/50',
          icon: Radio,
        };
      case 'core_switch':
        return {
          label: 'CORE SWITCH',
          bg: 'bg-purple-950/80',
          text: 'text-purple-300',
          border: 'border-purple-700/50',
          icon: Network,
        };
      case 'access_switch':
        return {
          label: 'ACCESS SWITCH',
          bg: 'bg-sky-950/80',
          text: 'text-sky-300',
          border: 'border-sky-700/50',
          icon: Activity,
        };
      case 'rack':
        return {
          label: 'SERVER RACK (42U)',
          bg: 'bg-slate-900/80',
          text: 'text-slate-300',
          border: 'border-slate-700/50',
          icon: Layers,
        };
      case 'server':
        return {
          label: 'COMPUTE BLADE',
          bg: 'bg-emerald-950/80',
          text: 'text-emerald-300',
          border: 'border-emerald-700/50',
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

  const badge = getNodeTypeBadge(selectedNode.type);
  const Icon = badge.icon;

  return (
    <div
      className={`absolute top-4 right-4 z-20 ${
        isCollapsed ? 'w-auto' : 'w-80'
      } max-w-[calc(100%-2rem)] max-h-[calc(100%-4rem)] overflow-y-auto bg-slate-950/85 border border-slate-700/60 rounded-xl p-3.5 shadow-2xl backdrop-blur-xl text-xs font-sans text-slate-200 transition-all duration-150 ring-1 ring-white/5 animate-in fade-in slide-in-from-right-4`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${badge.bg} ${badge.border}`}>
            <Icon className={`w-4 h-4 ${badge.text}`} />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm leading-tight truncate max-w-[170px]">
              {selectedNode.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${badge.bg} ${badge.text} ${badge.border}`}
              >
                {badge.label}
              </span>
              <span className="text-[10px] font-mono text-slate-400">{selectedNode.id}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Collapse/Expand Toggle to avoid obscuring 3D elements */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title={isCollapsed ? 'Expand Inspector' : 'Minimize Inspector'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title="Deselect Node"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Status Line */}
          <div className="flex items-center justify-between py-2 border-b border-slate-800/80 font-mono text-[11px] mt-2">
            <span className="text-slate-400">STATUS</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="uppercase font-semibold">
                {(selectedNode.status || 'ONLINE').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Parent Hierarchy if Server */}
          {(selectedNode.parent_id || selectedNode.parentId) && (
            <div className="flex items-center justify-between py-2 border-b border-slate-800/80 font-mono text-[11px]">
              <span className="text-slate-400">PARENT RACK</span>
              <button
                onClick={() =>
                  onSelectNode?.((selectedNode.parent_id || selectedNode.parentId) as string)
                }
                className="text-cyan-400 hover:underline hover:text-cyan-300 font-semibold"
              >
                {selectedNode.parent_id || selectedNode.parentId}
              </button>
            </div>
          )}

          {/* Hardware & Spec Details */}
          <div className="py-2.5 space-y-1.5 border-b border-slate-800/80 text-[11px]">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Hardware & Config
            </div>

            {selectedNode.type === 'server' && (
              <div className="grid grid-cols-2 gap-1.5 font-mono">
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800/90">
                  <span className="text-slate-400 block text-[9px]">vCPU</span>
                  <span className="text-cyan-300 font-semibold">
                    {String(config.vcpu ?? 8)} Cores
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800/90">
                  <span className="text-slate-400 block text-[9px]">RAM</span>
                  <span className="text-purple-300 font-semibold">
                    {String(config.ram_gb ?? 16)} GB
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800/90 col-span-2 flex items-center justify-between">
                  <span className="text-slate-400 text-[9px]">Storage</span>
                  <span className="text-slate-200 font-semibold">
                    {String(config.storage_gb ?? 256)} GB NVMe
                  </span>
                </div>
              </div>
            )}

            {(selectedNode.type === 'router' ||
              selectedNode.type === 'core_switch' ||
              selectedNode.type === 'access_switch') && (
              <div className="space-y-1 font-mono">
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/70 border border-slate-800/90">
                  <span className="text-slate-400">Capacity</span>
                  <span className="text-cyan-300 font-semibold">
                    {String(config.switching_capacity_gbps || 40)} Gbps
                  </span>
                </div>
              </div>
            )}

            {selectedNode.type === 'rack' && (
              <div className="space-y-2 font-mono">
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/70 border border-slate-800/90">
                  <span className="text-slate-400">Total Units</span>
                  <span className="text-cyan-300 font-semibold">
                    {String(config.total_u || 42)}U
                  </span>
                </div>
                {containedServers.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">
                      Mounted Server Blades ({containedServers.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {containedServers.map((srv) => (
                        <button
                          key={srv.id}
                          onClick={() => onSelectNode?.(srv.id)}
                          className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700/60 transition-colors font-mono"
                        >
                          {srv.id}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Network Addressing */}
            {Boolean(config.ip_address) && (
              <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 pt-1">
                <span>IP: {String(config.ip_address)}</span>
                {Boolean(config.mac_address) && (
                  <span className="truncate max-w-[130px]">{String(config.mac_address)}</span>
                )}
              </div>
            )}
          </div>

          {/* Connected Network Links */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              <span>Connected Links ({connectedLinks.length})</span>
              <HardDrive className="w-3 h-3 text-cyan-400" />
            </div>
            {connectedLinks.length === 0 ? (
              <div className="text-slate-400 italic text-[10px]">
                No direct network links (Spatial container)
              </div>
            ) : (
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                {connectedLinks.map((link) => {
                  const peerId =
                    link.source_id === selectedNode.id ? link.target_id : link.source_id;
                  const bw = link.bandwidth_mbps ?? link.bandwidthMbps;
                  const lat = link.latency_ms ?? link.latencyMs;

                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80"
                    >
                      <button
                        onClick={() => onSelectNode?.(peerId)}
                        className="text-cyan-400 hover:underline hover:text-cyan-300 font-semibold"
                      >
                        ↔ {peerId}
                      </button>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="text-emerald-400 font-semibold">{bw} Mbps</span>
                        <span className="text-slate-400">{lat}ms</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
