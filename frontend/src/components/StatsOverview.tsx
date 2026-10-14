import React from 'react';
import { QueueStats } from '../types';
import { Clock, Play, CheckCircle2, AlertOctagon, Cpu, Database, ShieldCheck } from 'lucide-react';

interface StatsOverviewProps {
  stats: QueueStats | null;
  loading: boolean;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, loading }) => {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-900/60 border border-slate-800" />
        ))}
      </div>
    );
  }

  const waiting = stats?.bullMq?.waiting ?? stats?.database?.byStatus?.PENDING ?? 0;
  const active = stats?.bullMq?.active ?? stats?.database?.byStatus?.ACTIVE ?? 0;
  const completed = stats?.database?.byStatus?.COMPLETED ?? stats?.bullMq?.completed ?? 0;
  const failed = stats?.database?.byStatus?.FAILED ?? stats?.bullMq?.failed ?? 0;
  const successRate = stats?.performance?.successRate ?? 100;
  const dlqCount = stats?.database?.unresolvedDlqCount ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Waiting Card */}
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Waiting Backlog
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
              {waiting.toLocaleString()}
            </span>
            <span className="text-xs text-amber-400/80 font-medium">Ready to consume</span>
          </div>
          <div className="mt-3 flex items-center text-[11px] text-slate-400 space-x-1">
            <span>Delayed buffer:</span>
            <span className="font-semibold text-slate-300 font-mono">
              {stats?.bullMq?.delayed ?? 0}
            </span>
          </div>
        </div>

        {/* Active Card */}
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active In-Flight
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Play className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
              {active.toLocaleString()}
            </span>
            <span className="text-xs text-indigo-400 font-medium">
              Slots: {stats?.worker?.concurrency ?? 5}
            </span>
          </div>
          <div className="mt-3 flex items-center text-[11px] text-slate-400 space-x-1">
            <span>Concurrency limit:</span>
            <span className="font-semibold text-slate-300 font-mono">
              {stats?.worker?.concurrency ?? 5} workers
            </span>
          </div>
        </div>

        {/* Completed Card */}
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Completed Jobs
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
              {completed.toLocaleString()}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {successRate}% Success
            </span>
          </div>
          <div className="mt-3 flex items-center text-[11px] text-slate-400 space-x-1">
            <span>Audit log tracked:</span>
            <span className="font-semibold text-slate-300 font-mono">
              {stats?.database?.totalJobs ?? completed} total
            </span>
          </div>
        </div>

        {/* Failed / DLQ Card */}
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Failed & DLQ
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
              {failed.toLocaleString()}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {dlqCount} In DLQ
            </span>
          </div>
          <div className="mt-3 flex items-center text-[11px] text-slate-400 space-x-1">
            <span>Unresolved Dead Letters:</span>
            <span className="font-semibold text-rose-300 font-mono">{dlqCount} pending</span>
          </div>
        </div>
      </div>

      {/* Cluster Health Strip */}
      <div className="glass-panel p-3.5 rounded-xl flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>Worker Queue:</span>
            <span className="font-mono text-slate-200 font-semibold">
              {stats?.worker?.queueName || 'default-jobs'}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Redis State:</span>
            <span
              className={`font-semibold ${stats?.worker?.redisConnected ? 'text-emerald-400' : 'text-amber-400'
                }`}
            >
              {stats?.worker?.redisConnected ? 'Healthy' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Rate Limiter:</span>
            <span className="font-mono text-slate-200">
              {stats?.worker?.rateLimitMax ?? 100} ops / {stats?.worker?.rateLimitDurationMs ?? 1000}ms
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          Last sync:{' '}
          <span className="font-mono text-slate-300">
            {stats ? new Date(stats.timestamp).toLocaleTimeString() : 'syncing...'}
          </span>
        </div>
      </div>
    </div>
  );
};
