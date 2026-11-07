import React from 'react';
import { PlaySquare, Database, CheckCircle, RotateCw } from 'lucide-react';

export const SimulationsView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          Simulation Scenarios & Checkpoints
          <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            DAY 10–12 ROADMAP
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Deterministic simulation runs, scenario replay archives, and SHA-256 state checkpoint
          management.
        </p>
      </div>

      <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <PlaySquare className="w-4 h-4 text-cyan-400" />
            <span>Active Scenario: Nominal Load Baseline</span>
          </div>
          <span className="text-xs font-mono text-cyan-300">SEED: 0x4f3a9b1c7e8d2f10</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-slate-400 text-[10px]">PRNG ALGORITHM</div>
            <div className="text-slate-200 mt-0.5 font-semibold">SplitMix64 (v1.0)</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-slate-400 text-[10px]">ACTION ORDERING</div>
            <div className="text-slate-200 mt-0.5 font-semibold">(tick, action_seq)</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-slate-400 text-[10px]">CHECKPOINT CANONICAL HASH</div>
            <div className="text-slate-200 mt-0.5 font-semibold">RFC 8785 SHA-256</div>
          </div>
        </div>

        <div className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-mono">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Invariant Engine Rules Locked (DECISIONS.md)</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Simulation loop execution is strictly decoupled from WebGL render framerates. Time steps
            advance via discrete simulation ticks. Checkpoint save/restore engine foundation will be
            implemented during Phase 4.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-xs cursor-not-allowed"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Restore Checkpoint</span>
          </button>
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 text-xs cursor-not-allowed"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Execute Replay Verification</span>
          </button>
        </div>
      </div>
    </div>
  );
};
