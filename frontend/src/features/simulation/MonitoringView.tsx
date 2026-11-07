import React from 'react';
import { Clock, ShieldCheck, Cpu, HardDrive } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

export const MonitoringView: React.FC = () => {
  const telemetryHistory = [
    { time: '13:00', cpu: 22, memory: 34, packets: 1200 },
    { time: '13:05', cpu: 28, memory: 36, packets: 1450 },
    { time: '13:10', cpu: 32, memory: 38, packets: 1600 },
    { time: '13:15', cpu: 26, memory: 37, packets: 1320 },
    { time: '13:20', cpu: 45, memory: 41, packets: 2100 },
    { time: '13:25', cpu: 30, memory: 39, packets: 1540 },
  ];

  const serverLoads = [
    { name: 'Srv-01', load: 38 },
    { name: 'Srv-02', load: 42 },
    { name: 'Srv-03', load: 29 },
    { name: 'Srv-04', load: 35 },
    { name: 'Srv-05', load: 40 },
    { name: 'Srv-06', load: 31 },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          Telemetry & Monitoring Analytics
          <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
            METRICS ENGINE
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Historical aggregate utilization, latency distribution percentiles, and node resource
          consumption.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CPU & Memory Aggregates */}
        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Cluster Compute & Memory (%)
            </h2>
            <span className="text-xs font-mono text-slate-400">Sample interval: 5m</span>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryHistory}>
                <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} domain={[0, 100]} />
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
                  dataKey="cpu"
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.2}
                  name="CPU %"
                />
                <Area
                  type="monotone"
                  dataKey="memory"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.2}
                  name="RAM %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Server Load Distribution */}
        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-violet-400" />
              Blade Server Queue Balance (%)
            </h2>
            <span className="text-xs font-mono text-emerald-400">Intra-tick Balanced</span>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serverLoads}>
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0b1120',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="load" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Load %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Full ring-buffer telemetry history scheduled for implementation in Phase 6.</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span>All Metrics Aggregators Online</span>
        </div>
      </div>
    </div>
  );
};
