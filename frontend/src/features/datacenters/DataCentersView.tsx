import React from 'react';
import { Server, Plus, HardDrive, Shield } from 'lucide-react';

export const DataCentersView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Data Centers & Workspaces
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              DAY 3 ROADMAP
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage data center physical topology definitions, rack specifications, and multi-tenant
            workspaces.
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-xs cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Facility</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-200">US-East Production (DC-01)</h2>
                <p className="text-xs text-slate-400 font-mono">Ashburn, VA • Primary Cluster</p>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
              ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/60 font-mono text-xs">
            <div>
              <div className="text-[10px] text-slate-400">RACKS</div>
              <div className="text-slate-200 font-semibold">4 Units (42U)</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">BLADE SERVERS</div>
              <div className="text-slate-200 font-semibold">16 Nodes</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">POWER / PDU</div>
              <div className="text-slate-200 font-semibold">Redundant A+B</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Parent Topology: Dual Access Switch Mesh</span>
            <span className="text-cyan-400 hover:underline cursor-pointer">
              Inspect Physical Schema →
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/80 flex flex-col items-center justify-center text-center">
          <HardDrive className="w-8 h-8 text-slate-400 mb-2" />
          <h2 className="text-sm font-semibold text-slate-300">EU-Central Secondary (DC-02)</h2>
          <p className="text-xs text-slate-400 max-w-xs mt-1 mb-3">
            Standby regional facility scheduled for schema provisioning in Phase 1 (Day 3).
          </p>
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Shield className="w-3 h-3" /> Awaiting Supabase DB migration
          </span>
        </div>
      </div>
    </div>
  );
};
