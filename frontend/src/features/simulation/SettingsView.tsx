import React from 'react';
import { Key, Cpu, Shield } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          Environment & System Settings
          <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            CONFIGURATION
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Supabase authentication credentials, backend connection URLs, and simulation engine
          parameters.
        </p>
      </div>

      <div className="space-y-4">
        {/* Backend & Supabase Connection Card */}
        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 border-b border-slate-800/80 pb-3">
            <Key className="w-4 h-4 text-cyan-400" />
            <span>Identity & Data Layer Endpoints</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <label className="text-slate-400 block mb-1">VITE_SUPABASE_URL</label>
              <input
                type="text"
                readOnly
                value="https://your-project-id.supabase.co"
                className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">FASTAPI BACKEND URL</label>
              <input
                type="text"
                readOnly
                value="http://127.0.0.1:8000"
                className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-cyan-300"
              />
            </div>
          </div>
        </div>

        {/* Engine Parameters Card */}
        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 border-b border-slate-800/80 pb-3">
            <Cpu className="w-4 h-4 text-violet-400" />
            <span>Simulation Engine Specifications</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 text-[10px]">TICK CLOCK INTERVAL</span>
              <div className="text-slate-200 font-semibold mt-1">100 ms / tick (10 Hz nominal)</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 text-[10px]">LINK BASE PROPAGATION</span>
              <div className="text-slate-200 font-semibold mt-1">1.0 ms per hop</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-2 border-t border-slate-800/60">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              All secrets are strictly loaded from local .env and never committed to version
              control.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
