import React from 'react';
import { DataCenterViewport } from '../../three/scene/DataCenterViewport';
import { useSimulationStore } from '../../store/useSimulationStore';
import {
  Server,
  Activity,
  Zap,
  Radio,
  Play,
  Pause,
  RotateCcw,
  AlertOctagon,
  Network,
  Cpu,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const CommandCenterView: React.FC = () => {
  const { currentTick, status, telemetry, setStatus, resetSimulation } = useSimulationStore();

  // Synthetic baseline telemetry series for visualization
  const telemetryData = [
    { time: '13:00', throughput: 38, latency: 1.1 },
    { time: '13:05', throughput: 42, latency: 1.2 },
    { time: '13:10', throughput: 45, latency: 1.18 },
    { time: '13:15', throughput: 40, latency: 1.15 },
    { time: '13:20', throughput: 55, latency: 1.35 },
    { time: '13:25', throughput: 42.5, latency: 1.18 },
  ];

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* Top Banner / Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Command Center
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              LIVE TELEMETRY
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time 3D physical workspace visualization and deterministic network simulator.
          </p>
        </div>

        {/* Engine Playback Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setStatus(status === 'running' ? 'paused' : 'running')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              status === 'running'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-[0_0_15px_-2px_rgba(6,182,212,0.4)]'
            }`}
          >
            {status === 'running' ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{status === 'running' ? 'PAUSE TICK' : 'START SIMULATION'}</span>
          </button>
          <button
            onClick={resetSimulation}
            title="Reset Simulation State"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metric Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">ACTIVE HARDWARE</span>
            <Server className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {telemetry.totalServers}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">
              Blades ({telemetry.activeRacks} Racks)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            100% Compute Operational
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">THROUGHPUT</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {telemetry.networkThroughputMbps}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">Mbps</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Link Capacity:{' '}
            <span className="text-slate-200 font-mono">{telemetry.maxBandwidthMbps} Mbps</span> (50%
            load)
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">NETWORK LATENCY</span>
            <Radio className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {telemetry.avgLatencyMs}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">ms (p99: 1.84ms)</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Base Propagation 1.0 ms / hop
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">WORKLOAD DEMAND</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {telemetry.activeRequestsPerSec}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">req/sec</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">Tick: {currentTick}</div>
        </div>
      </div>

      {/* Main 3D Viewport Section */}
      <div className="w-full h-[520px]">
        <DataCenterViewport />
      </div>

      {/* Bottom Grid: Link Telemetry Chart, Quick Fault Console & Topology Hierarchy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Real-time Link Telemetry Graph */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Aggregate Bandwidth Telemetry
            </h2>
            <span className="text-[10px] font-mono text-cyan-400">Mbps (Last 30m)</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} domain={[0, 70]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0b1120',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="throughput"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#cyanGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Fault Injection Console */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                Fault Injection Console
              </h2>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                Phase 5 Staging
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Discrete simulation events are committed at ordered sequence{' '}
              <code className="text-cyan-300 font-mono">(tick, action_seq)</code>.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                disabled
                className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 text-left text-xs opacity-75 cursor-not-allowed hover:border-slate-600"
              >
                <div className="font-semibold text-rose-300 flex items-center gap-1.5">
                  <Cpu className="w-3 h-3" />
                  Crash Server Node
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">OOM memory exhaustion</div>
              </button>

              <button
                disabled
                className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 text-left text-xs opacity-75 cursor-not-allowed hover:border-slate-600"
              >
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Network className="w-3 h-3" />
                  Cut Core Link
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Sever Core-Access link</div>
              </button>

              <button
                disabled
                className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 text-left text-xs opacity-75 cursor-not-allowed hover:border-slate-600"
              >
                <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Activity className="w-3 h-3" />
                  Latency Jitter
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">+50ms propagation delay</div>
              </button>

              <button
                disabled
                className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 text-left text-xs opacity-75 cursor-not-allowed hover:border-slate-600"
              >
                <div className="font-semibold text-violet-300 flex items-center gap-1.5">
                  <Radio className="w-3 h-3" />
                  Packet Drop Spike
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Inject 15% drop rate</div>
              </button>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/60 mt-3">
            Deterministic state mutation engine activates on Day 13.
          </div>
        </div>

        {/* Topology Hierarchy Invariants */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Network className="w-3.5 h-3.5 text-cyan-400" />
                Network Topology Hierarchy
              </h2>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                PRD Invariant
              </span>
            </div>

            <div className="space-y-2 mt-3 font-mono text-xs">
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
          </div>

          <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-800/60 mt-3">
            Note: Racks are spatial grouping objects and do not forward traffic.
          </div>
        </div>
      </div>
    </div>
  );
};
