import React from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Server, Activity, ShieldCheck, ChevronDown, Bell, Cpu, Layers } from 'lucide-react';

export const TopNavbar: React.FC = () => {
  const { currentTick, status, seed, activeWorkspace, telemetry } = useSimulationStore();

  return (
    <header className="h-16 bg-[#070c18] border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Workspace */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_-2px_rgba(6,182,212,0.4)]">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-base text-white">DATAVERSE</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                v0.1
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight">
              3D LIVING DATA CENTER SIMULATOR
            </p>
          </div>
        </div>

        {/* Workspace Switcher Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer text-xs">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-200 font-medium">{activeWorkspace}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      {/* Center Cluster: Simulation Clock & Seed */}
      <div className="hidden lg:flex items-center gap-4 bg-slate-950/80 border border-slate-800/90 rounded-lg px-4 py-1.5 font-mono text-xs">
        <div className="flex items-center gap-2 border-r border-slate-800 pr-4">
          <span className="text-slate-400">TICK</span>
          <span className="text-cyan-300 font-semibold">
            {String(currentTick).padStart(6, '0')}
          </span>
        </div>
        <div className="flex items-center gap-2 border-r border-slate-800 pr-4">
          <span className="text-slate-400">ENGINE:</span>
          <span
            className={`font-semibold uppercase ${
              status === 'running' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">SEED:</span>
          <span className="text-slate-300 select-all">{seed}</span>
        </div>
      </div>

      {/* Right Cluster: Telemetry & Profile */}
      <div className="flex items-center gap-4">
        {/* Health Telemetry Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300">HEALTH:</span>
          <span className="text-emerald-400 font-semibold">{telemetry.systemHealthPercent}%</span>
        </div>

        {/* Throughput Indicator */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">NET:</span>
          <span className="text-cyan-300 font-semibold">
            {telemetry.networkThroughputMbps} Mbps
          </span>
        </div>

        {/* Notifications / Alerts */}
        <button
          title="Incident Alerts"
          className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#070c18]" />
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-cyan-500/30 flex items-center justify-center font-mono text-xs font-bold text-cyan-300">
            VS
          </div>
          <div className="hidden sm:block text-left text-xs">
            <div className="text-slate-200 font-medium">vyomshah</div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <Cpu className="w-2.5 h-2.5 text-cyan-400" />
              ARCHITECT
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
