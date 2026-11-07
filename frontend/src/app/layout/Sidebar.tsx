import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  PlaySquare,
  Activity,
  AlertTriangle,
  Settings,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const navItems = [
    { to: '/', label: 'Command Center', icon: LayoutDashboard },
    { to: '/datacenters', label: 'Data Centers', icon: Server },
    { to: '/simulations', label: 'Simulations', icon: PlaySquare },
    { to: '/monitoring', label: 'Monitoring', icon: Activity },
    { to: '/incidents', label: 'Incidents', icon: AlertTriangle, badge: '0' },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={`bg-[#060a14] border-r border-slate-800/80 transition-all duration-300 flex flex-col justify-between z-20 ${
        collapsed ? 'w-16 max-md:hidden' : 'w-64'
      }`}
    >
      {/* Navigation Links */}
      <div className="py-4">
        <div className="px-3 mb-2 flex items-center justify-between text-[11px] font-mono uppercase text-slate-400">
          {!collapsed && <span>Operations Console</span>}
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-auto"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_-2px_rgba(6,182,212,0.25)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                {!collapsed && (
                  <div className="flex items-center justify-between w-full">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 group-hover:bg-slate-700">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Telemetry Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 font-mono text-[11px]">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-cyan-400" />
                <span>CORE ENGINE</span>
              </span>
              <span className="text-emerald-400">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-violet-400" />
                <span>BACKEND API</span>
              </span>
              <span className="text-slate-300">:8000</span>
            </div>
            <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-900">
              PRD v2.0 • SplitMix64 PRNG
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" title="Core Engine Online" />
            <div className="w-2 h-2 rounded-full bg-violet-400" title="Backend Scaffolding" />
          </div>
        )}
      </div>
    </aside>
  );
};
