import React from 'react';
import { QueueStats } from '../types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Gauge, Zap, Timer } from 'lucide-react';

interface QueueChartsProps {
  stats: QueueStats | null;
}

export const QueueCharts: React.FC<QueueChartsProps> = ({ stats }) => {
  const p50 = stats?.performance?.latencyPercentiles?.p50 ?? 0;
  const p95 = stats?.performance?.latencyPercentiles?.p95 ?? 0;
  const p99 = stats?.performance?.latencyPercentiles?.p99 ?? 0;
  const sampleSize = stats?.performance?.latencyPercentiles?.sampleSize ?? 0;

  // Chart data from queue states
  const chartData = [
    { name: 'Waiting', count: stats?.bullMq?.waiting ?? 0, fill: '#f59e0b' },
    { name: 'Active', count: stats?.bullMq?.active ?? 0, fill: '#6366f1' },
    { name: 'Delayed', count: stats?.bullMq?.delayed ?? 0, fill: '#8b5cf6' },
    { name: 'Completed', count: stats?.bullMq?.completed ?? 0, fill: '#10b981' },
    { name: 'Failed', count: stats?.bullMq?.failed ?? 0, fill: '#ef4444' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Queue Depth Breakdown Chart */}
      <div className="lg:col-span-2 glass-panel p-5 rounded-2xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Queue State Distribution
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Real-time BullMQ memory broker count</p>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="flex items-center space-x-1 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
              <span>Jobs Count</span>
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorCount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latency Percentiles Card */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Processing Latency SLA
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Calculated over {sampleSize} recent executions
              </p>
            </div>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Gauge className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-4">
            {/* p50 */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div>
                  <span className="text-xs font-semibold text-slate-300">p50 Median Latency</span>
                  <p className="text-[10px] text-slate-400">50% of jobs complete faster</p>
                </div>
              </div>
              <span className="font-mono text-base font-bold text-emerald-400">
                {p50} ms
              </span>
            </div>

            {/* p95 */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <div>
                  <span className="text-xs font-semibold text-slate-300">p95 Tail Latency</span>
                  <p className="text-[10px] text-slate-400">95% of jobs complete within</p>
                </div>
              </div>
              <span className="font-mono text-base font-bold text-amber-400">
                {p95} ms
              </span>
            </div>

            {/* p99 */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <div>
                  <span className="text-xs font-semibold text-slate-300">p99 Critical Worst-Case</span>
                  <p className="text-[10px] text-slate-400">Peak tail latency outlier</p>
                </div>
              </div>
              <span className="font-mono text-base font-bold text-indigo-400">
                {p99} ms
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center space-x-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Target SLA: &lt; 2,000ms</span>
          </span>
          <span className="font-semibold text-emerald-400">
            {p95 <= 2000 ? 'Compliant' : 'Warning'}
          </span>
        </div>
      </div>
    </div>
  );
};
