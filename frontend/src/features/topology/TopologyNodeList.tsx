import React, { useMemo, useState, useCallback, useRef } from 'react';
import type { TopologyNode } from '../../engine/topology/types';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  Server,
  Layers,
  Radio,
  Network,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Check,
} from 'lucide-react';

interface TopologyNodeListProps {
  nodes: TopologyNode[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  className?: string;
}

export const TopologyNodeList: React.FC<TopologyNodeListProps> = ({
  nodes,
  selectedNodeId: propSelectedNodeId,
  onSelectNode: propOnSelectNode,
  className = '',
}) => {
  // Store synchronization
  const storeSelectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const storeSetSelectedNodeId = useSimulationStore((state) => state.setSelectedNodeId);

  const activeSelectedId =
    propSelectedNodeId !== undefined ? propSelectedNodeId : storeSelectedNodeId;
  const handleSelectNode = useCallback(
    (id: string | null) => {
      if (propOnSelectNode) {
        propOnSelectNode(id);
      } else {
        storeSetSelectedNodeId(id);
      }
    },
    [propOnSelectNode, storeSetSelectedNodeId]
  );

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'network' | 'racks' | 'servers'>('all');

  // Track expanded state for racks (default: all racks expanded to show all servers)
  const [expandedRacks, setExpandedRacks] = useState<Record<string, boolean>>({
    'rack-01': true,
    'rack-02': true,
    'rack-03': true,
    'rack-04': true,
  });

  const toggleRack = useCallback((rackId: string) => {
    setExpandedRacks((prev) => ({
      ...prev,
      [rackId]: !prev[rackId],
    }));
  }, []);

  const expandAll = useCallback(() => {
    setExpandedRacks({
      'rack-01': true,
      'rack-02': true,
      'rack-03': true,
      'rack-04': true,
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedRacks({
      'rack-01': false,
      'rack-02': false,
      'rack-03': false,
      'rack-04': false,
    });
  }, []);

  // Logical groupings according to PRD v2.0 hierarchy
  const routerNodes = useMemo(() => nodes.filter((n) => n.type === 'router'), [nodes]);
  const coreSwitchNodes = useMemo(() => nodes.filter((n) => n.type === 'core_switch'), [nodes]);
  const accessSwitchNodes = useMemo(() => nodes.filter((n) => n.type === 'access_switch'), [nodes]);
  const rackNodes = useMemo(() => nodes.filter((n) => n.type === 'rack'), [nodes]);
  const serverNodes = useMemo(() => nodes.filter((n) => n.type === 'server'), [nodes]);

  // Server child lookup by parent rack ID
  const serversByRack = useMemo(() => {
    const map = new Map<string, TopologyNode[]>();
    for (const server of serverNodes) {
      const parentId = server.parent_id || server.parentId || '';
      const list = map.get(parentId) || [];
      list.push(server);
      map.set(parentId, list);
    }
    return map;
  }, [serverNodes]);

  // Filter evaluation
  const queryLower = searchQuery.toLowerCase().trim();
  const matchesSearch = useCallback(
    (node: TopologyNode) => {
      if (!queryLower) return true;
      return (
        node.id.toLowerCase().includes(queryLower) ||
        node.name.toLowerCase().includes(queryLower) ||
        node.type.toLowerCase().includes(queryLower) ||
        node.status.toLowerCase().includes(queryLower)
      );
    },
    [queryLower]
  );

  // Status icon and color helper
  const renderStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'online':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">ONLINE</span>
          </span>
        );
      case 'degraded':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">DEGRADED</span>
          </span>
        );
      case 'offline':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono text-rose-400">
            <XCircle className="w-3 h-3 text-rose-400" />
            <span className="hidden sm:inline">OFFLINE</span>
          </span>
        );
      case 'maintenance':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono text-sky-400">
            <Wrench className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">MAINT</span>
          </span>
        );
      default:
        return <span className="text-[10px] font-mono text-slate-400 uppercase">{status}</span>;
    }
  };

  // Keyboard navigation refs
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, node: TopologyNode, isRack = false) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelectNode(node.id === activeSelectedId ? null : node.id);
    } else if (isRack && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      toggleRack(node.id);
    }
  };

  // Empty state handling
  if (!nodes || nodes.length === 0) {
    return (
      <div
        className={`p-6 rounded-xl bg-slate-900/50 border border-slate-800 text-center font-mono ${className}`}
        role="region"
        aria-label="Topology Node Tree"
      >
        <div className="text-slate-400 text-sm mb-1 font-semibold">Topology Graph Empty</div>
        <p className="text-xs text-slate-400">
          No hardware nodes available in current configuration.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={`flex flex-col bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden backdrop-blur-md ${className}`}
      role="region"
      aria-label="Data Center Hardware Topology Hierarchy"
    >
      {/* Header & Controls Bar */}
      <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-white">
            Topology Hierarchy
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50">
            {nodes.length} Nodes
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Expand / Collapse All */}
          <button
            onClick={expandAll}
            className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 px-2 py-1 rounded hover:bg-slate-800/50 transition-colors"
            title="Expand All Rack Bays"
          >
            Expand All
          </button>
          <span className="text-slate-700">|</span>
          <button
            onClick={collapseAll}
            className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 px-2 py-1 rounded hover:bg-slate-800/50 transition-colors"
            title="Collapse All Rack Bays"
          >
            Collapse All
          </button>
          {activeSelectedId && (
            <button
              onClick={() => handleSelectNode(null)}
              className="text-[10px] font-mono text-slate-400 hover:text-rose-400 px-2 py-1 rounded hover:bg-slate-800/50 transition-colors"
              title="Clear Active Selection"
            >
              Deselect
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="px-3.5 py-2.5 border-b border-slate-800/60 bg-slate-950/20 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search nodes by name, ID, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500/70 transition-colors"
            aria-label="Filter topology nodes"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
              title="Clear Search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <Filter className="w-3 h-3 text-slate-400 mr-1" />
          {(['all', 'network', 'racks', 'servers'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setTypeFilter(cat)}
              className={`px-2 py-1 rounded-md transition-colors uppercase ${
                typeFilter === cat
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Tree / Node List */}
      <div
        className="p-3 overflow-y-auto max-h-[500px] space-y-3"
        role="tree"
        aria-label="Hardware Nodes Tree"
      >
        {/* ============================================================== */}
        {/* 1. EDGE ROUTER TIER */}
        {/* ============================================================== */}
        {(typeFilter === 'all' || typeFilter === 'network') && routerNodes.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-cyan-400/90 flex items-center gap-1.5 px-1">
              <Radio className="w-3 h-3" />
              <span>Edge Gateway Router ({routerNodes.length})</span>
            </div>
            {routerNodes.filter(matchesSearch).map((node) => {
              const isSelected = activeSelectedId === node.id;
              return (
                <div
                  key={node.id}
                  role="treeitem"
                  tabIndex={0}
                  aria-selected={isSelected}
                  aria-label={`${node.name} (${node.id}) - Edge Router - Status ${node.status}`}
                  onClick={() => handleSelectNode(isSelected ? null : node.id)}
                  onKeyDown={(e) => handleKeyDown(e, node)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                    isSelected
                      ? 'bg-cyan-950/70 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.25)] text-white'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-1.5 rounded-md border ${
                        isSelected
                          ? 'bg-cyan-900/80 border-cyan-400 text-cyan-200'
                          : 'bg-cyan-950/60 border-cyan-800/40 text-cyan-400'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{node.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                          ROUTER
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>ID: {node.id}</span>
                        <span>•</span>
                        <span>100 Gbps WAN</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {renderStatusBadge(node.status)}
                    {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. CORE SWITCH TIER */}
        {/* ============================================================== */}
        {(typeFilter === 'all' || typeFilter === 'network') && coreSwitchNodes.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-purple-400/90 flex items-center gap-1.5 px-1">
              <Network className="w-3 h-3" />
              <span>Core Distribution Switch ({coreSwitchNodes.length})</span>
            </div>
            {coreSwitchNodes.filter(matchesSearch).map((node) => {
              const isSelected = activeSelectedId === node.id;
              return (
                <div
                  key={node.id}
                  role="treeitem"
                  tabIndex={0}
                  aria-selected={isSelected}
                  aria-label={`${node.name} (${node.id}) - Core Switch - Status ${node.status}`}
                  onClick={() => handleSelectNode(isSelected ? null : node.id)}
                  onKeyDown={(e) => handleKeyDown(e, node)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 ${
                    isSelected
                      ? 'bg-purple-950/70 border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.25)] text-white'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-1.5 rounded-md border ${
                        isSelected
                          ? 'bg-purple-900/80 border-purple-400 text-purple-200'
                          : 'bg-purple-950/60 border-purple-800/40 text-purple-400'
                      }`}
                    >
                      <Network className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{node.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-700/60">
                          CORE
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>ID: {node.id}</span>
                        <span>•</span>
                        <span>80 Gbps Fabric</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {renderStatusBadge(node.status)}
                    {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. ACCESS SWITCHES TIER */}
        {/* ============================================================== */}
        {(typeFilter === 'all' || typeFilter === 'network') && accessSwitchNodes.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-sky-400/90 flex items-center gap-1.5 px-1">
              <Activity className="w-3 h-3" />
              <span>Access Switches ({accessSwitchNodes.length})</span>
            </div>
            {accessSwitchNodes.filter(matchesSearch).map((node) => {
              const isSelected = activeSelectedId === node.id;
              return (
                <div
                  key={node.id}
                  role="treeitem"
                  tabIndex={0}
                  aria-selected={isSelected}
                  aria-label={`${node.name} (${node.id}) - Access Switch - Status ${node.status}`}
                  onClick={() => handleSelectNode(isSelected ? null : node.id)}
                  onKeyDown={(e) => handleKeyDown(e, node)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer font-mono text-xs focus:outline-none focus:ring-1 focus:ring-sky-400 ${
                    isSelected
                      ? 'bg-sky-950/70 border-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.25)] text-white'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-1.5 rounded-md border ${
                        isSelected
                          ? 'bg-sky-900/80 border-sky-400 text-sky-200'
                          : 'bg-sky-950/60 border-sky-800/40 text-sky-400'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{node.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-700/60">
                          ACCESS
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>ID: {node.id}</span>
                        <span>•</span>
                        <span>40 Gbps Switching</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {renderStatusBadge(node.status)}
                    {isSelected && <Check className="w-4 h-4 text-sky-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. PHYSICAL RACKS & MOUNTED SERVERS */}
        {/* ============================================================== */}
        {(typeFilter === 'all' || typeFilter === 'racks' || typeFilter === 'servers') &&
          rackNodes.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-slate-400" />
                  Physical Server Cabinets ({rackNodes.length} Racks)
                </span>
                <span className="text-[9px] text-slate-400 lowercase font-normal italic">
                  spatial grouping • no forwarding
                </span>
              </div>

              {rackNodes.map((rack) => {
                const isRackSelected = activeSelectedId === rack.id;
                const isExpanded = expandedRacks[rack.id] ?? true;
                const childServers = serversByRack.get(rack.id) || [];
                const rackMatches = matchesSearch(rack);
                const hasMatchingChildren = childServers.some(matchesSearch);

                if (!rackMatches && !hasMatchingChildren && searchQuery) {
                  return null;
                }

                return (
                  <div
                    key={rack.id}
                    className="rounded-lg border border-slate-800/80 bg-slate-950/40 overflow-hidden"
                  >
                    {/* Rack Header Item */}
                    <div
                      role="treeitem"
                      tabIndex={0}
                      aria-selected={isRackSelected}
                      aria-expanded={isExpanded}
                      aria-label={`${rack.name} (${rack.id}) - 42U Server Rack - Status ${rack.status}`}
                      onClick={() => handleSelectNode(isRackSelected ? null : rack.id)}
                      onKeyDown={(e) => handleKeyDown(e, rack, true)}
                      className={`flex items-center justify-between p-2.5 transition-all cursor-pointer font-mono text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                        isRackSelected
                          ? 'bg-slate-800/80 border-b border-cyan-500/50 text-white'
                          : 'hover:bg-slate-900/60 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Toggle Expansion Chevron */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRack(rack.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title={isExpanded ? 'Collapse Rack Servers' : 'Expand Rack Servers'}
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <div
                          className={`p-1.5 rounded-md border ${
                            isRackSelected
                              ? 'bg-slate-700 border-slate-400 text-white'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </div>

                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{rack.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-700">
                              42U RACK
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>ID: {rack.id}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-semibold">
                              {childServers.length} Blades Mounted
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {renderStatusBadge(rack.status)}
                        {isRackSelected && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                    </div>

                    {/* Child Server Blades (Nested under Rack) */}
                    {isExpanded && childServers.length > 0 && (
                      <div
                        className="pl-7 pr-2 py-1.5 space-y-1 bg-slate-950/60 border-t border-slate-800/40"
                        role="group"
                      >
                        {childServers.filter(matchesSearch).map((server) => {
                          const isServerSelected = activeSelectedId === server.id;
                          return (
                            <div
                              key={server.id}
                              role="treeitem"
                              tabIndex={0}
                              aria-selected={isServerSelected}
                              aria-label={`${server.name} (${server.id}) - Compute Blade - Status ${server.status}`}
                              onClick={() => handleSelectNode(isServerSelected ? null : server.id)}
                              onKeyDown={(e) => handleKeyDown(e, server)}
                              className={`flex items-center justify-between p-2 rounded-md border transition-all cursor-pointer font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                                isServerSelected
                                  ? 'bg-emerald-950/70 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.25)] text-white'
                                  : 'bg-slate-900/50 border-slate-850 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`p-1 rounded border ${
                                    isServerSelected
                                      ? 'bg-emerald-900/80 border-emerald-400 text-emerald-200'
                                      : 'bg-emerald-950/50 border-emerald-800/40 text-emerald-400'
                                  }`}
                                >
                                  <Server className="w-3 h-3" />
                                </div>
                                <div>
                                  <div className="font-medium text-white flex items-center gap-1.5">
                                    <span>{server.name}</span>
                                    <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                                      SERVER
                                    </span>
                                  </div>
                                  <div className="text-[9px] text-slate-400 flex items-center gap-2">
                                    <span>{server.id}</span>
                                    <span>•</span>
                                    <span className="text-purple-300 font-semibold">
                                      8 vCPU / 16 GB RAM
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {renderStatusBadge(server.status)}
                                {isServerSelected && (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* Footer Info Pill */}
      <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>Click node to select • Arrow keys to navigate</span>
        <span className="text-cyan-400">Sync: 3D Scene Active</span>
      </div>
    </div>
  );
};
