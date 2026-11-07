import React from 'react';
import { AlertTriangle, CheckCircle2, History } from 'lucide-react';

export const IncidentsView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          Incident Response & Failover Operations
          <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
            SYSTEM NOMINAL
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Active fault lifecycle tracking, automated failover logs, and time-scrubbing incident
          replay.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 font-mono">
          <div className="text-[11px] text-slate-400">ACTIVE INCIDENTS</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">0</div>
          <div className="text-[10px] text-slate-400 mt-1">Zero unmitigated outages</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 font-mono">
          <div className="text-[11px] text-slate-400">MEAN TIME TO RECOVERY</div>
          <div className="text-2xl font-bold text-cyan-300 mt-1">420 ms</div>
          <div className="text-[10px] text-slate-400 mt-1">Simulated failover time</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 font-mono">
          <div className="text-[11px] text-slate-400">FAULT PIPELINE</div>
          <div className="text-2xl font-bold text-slate-200 mt-1">Ready</div>
          <div className="text-[10px] text-slate-400 mt-1">Phase 5 (Day 13-15)</div>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            Recent Simulation Incident Log
          </h2>
          <span className="text-xs font-mono text-slate-400">Ordered by (tick, action_seq)</span>
        </div>

        <div className="space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-slate-200 font-medium">Link Sever Auto-Failover Test</span>
                <div className="text-[10px] text-slate-400">
                  Access Switch 1 $\rightarrow$ Access Switch 2 alternate path
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 text-[10px]">
                RESOLVED
              </span>
              <div className="text-[10px] text-slate-400 mt-0.5">Tick #000450</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-slate-200 font-medium">
                  Planned OOM Degradation Benchmark
                </span>
                <div className="text-[10px] text-slate-400">
                  Memory leak profile execution on Blade-04
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/50 text-[10px]">
                CLEARED
              </span>
              <div className="text-[10px] text-slate-400 mt-0.5">Tick #000210</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
