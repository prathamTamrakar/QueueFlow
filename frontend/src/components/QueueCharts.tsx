import React from 'react';
import { QueueStats } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface QueueChartsProps {
  stats: QueueStats | null;
}

const STATE_COLORS: Record<string, string> = {
  Waiting: '#f59e0b',
  Active: '#3b82f6',
  Delayed: '#8b5cf6',
  Completed: '#10b981',
  Failed: '#f43f5e',
};

export const QueueCharts: React.FC<QueueChartsProps> = ({ stats }) => {
  const p50 = stats?.performance?.latencyPercentiles?.p50 ?? 0;
  const p95 = stats?.performance?.latencyPercentiles?.p95 ?? 0;
  const p99 = stats?.performance?.latencyPercentiles?.p99 ?? 0;
  const sampleSize = stats?.performance?.latencyPercentiles?.sampleSize ?? 0;

  // Discrete queue state counts (BullMQ memory broker)
  const chartData = [
    { name: 'Waiting', count: stats?.bullMq?.waiting ?? 0, color: STATE_COLORS.Waiting },
    { name: 'Active', count: stats?.bullMq?.active ?? 0, color: STATE_COLORS.Active },
    { name: 'Delayed', count: stats?.bullMq?.delayed ?? 0, color: STATE_COLORS.Delayed },
    { name: 'Completed', count: stats?.bullMq?.completed ?? 0, color: STATE_COLORS.Completed },
    { name: 'Failed', count: stats?.bullMq?.failed ?? 0, color: STATE_COLORS.Failed },
  ];

  const totalBrokerJobs = chartData.reduce((acc, curr) => acc + curr.count, 0);
  const slaTargetMs = 2000;
  const isSlaCompliant = p95 <= slaTargetMs;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0e1118] border border-slate-700/80 p-2.5 rounded shadow-lg text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span
              className="w-2 h-2 rounded-xs"
              style={{ backgroundColor: data.color }}
            />
            <span className="text-slate-200 font-medium">{data.name}:</span>
            <span className="text-white font-bold tabular-nums">
              {data.count.toLocaleString()} jobs
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">BullMQ in-memory state</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* Queue State Distribution - Honest Categorical Bar Chart */}
      <div className="lg:col-span-2 p-4 rounded-md bg-[#11141c] border border-slate-800 flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Queue State Distribution
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700/60">
                  BullMQ Memory
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Categorical breakdown of jobs currently in Redis broker
              </p>
            </div>

            {/* State Count Legend */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-400">{item.name}:</span>
                  <span className="text-slate-200 font-medium tabular-nums">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="h-56 w-full pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                barSize={38}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#1f2533" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#475569"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#222736' }}
                />
                <YAxis
                  stroke="#475569"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#222736' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Total active in memory: <strong className="text-slate-200 tabular-nums">{totalBrokerJobs}</strong> jobs</span>
          <span>Zero-value states render as baseline bars</span>
        </div>
      </div>

      {/* Processing Latency SLA - Structured Operational Table */}
      <div className="p-4 rounded-md bg-[#11141c] border border-slate-800 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Processing Latency SLA
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Target boundary: &lt; {slaTargetMs.toLocaleString()}ms (p95)
              </p>
            </div>

            {/* SLA Badge */}
            <div
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                isSlaCompliant
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                  : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
              }`}
            >
              {isSlaCompliant ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>SLA Met</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>SLA Breached</span>
                </>
              )}
            </div>
          </div>

          {/* Structured Latency Rows */}
          <div className="divide-y divide-slate-800/60 mt-2">
            {/* p50 Median */}
            <div className="py-2.5">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-300">p50 Median</span>
                  <span className="text-[10px] text-slate-500 ml-2">Typical run duration</span>
                </div>
                <span className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                  {p50} ms
                </span>
              </div>
              <div className="mt-1.5 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (p50 / slaTargetMs) * 100)}%` }}
                />
              </div>
            </div>

            {/* p95 Tail */}
            <div className="py-2.5">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-300">p95 Tail Latency</span>
                  <span className="text-[10px] text-slate-500 ml-2">SLA threshold benchmark</span>
                </div>
                <span
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    isSlaCompliant ? 'text-slate-100' : 'text-amber-400 font-bold'
                  }`}
                >
                  {p95} ms
                </span>
              </div>
              <div className="mt-1.5 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isSlaCompliant ? 'bg-brand-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.min(100, (p95 / slaTargetMs) * 100)}%` }}
                />
              </div>
            </div>

            {/* p99 Worst Case */}
            <div className="py-2.5">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-300">p99 Outlier Peak</span>
                  <span className="text-[10px] text-slate-500 ml-2">Tail latency spike</span>
                </div>
                <span className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                  {p99} ms
                </span>
              </div>
              <div className="mt-1.5 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (p99 / (slaTargetMs * 1.5)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Latency footnote */}
        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3 text-slate-500" />
            <span>Sample size: {sampleSize} executions</span>
          </span>
          <span>Target: &lt; {slaTargetMs}ms</span>
        </div>
      </div>
    </div>
  );
};

