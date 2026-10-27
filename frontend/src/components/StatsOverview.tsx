import React from 'react';
import { QueueStats } from '../types';
import { Server, Database, Gauge, RefreshCcw, AlertTriangle } from 'lucide-react';

interface StatsOverviewProps {
  stats: QueueStats | null;
  loading: boolean;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, loading }) => {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-md bg-slate-900/60 border border-slate-800" />
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
  const concurrency = stats?.worker?.concurrency ?? 5;
  const delayed = stats?.bullMq?.delayed ?? 0;

  // Calculate worker utilization percentage
  const utilization = concurrency > 0 ? Math.min(100, Math.round((active / concurrency) * 100)) : 0;

  return (
    <div className="space-y-3">
      {/* Primary Metrics Grid - Differentiated, information-dense */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Active In-Flight (Live Operations) */}
        <div className="p-4 rounded-md bg-[#11141c] border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                Active In-Flight
              </span>
              <span className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400">
                <span className={`w-1.5 h-1.5 rounded-full ${active > 0 ? 'bg-brand-500' : 'bg-slate-500'}`} />
                <span>{active > 0 ? 'processing' : 'idle'}</span>
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
                {active.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {active} / {concurrency} slots
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80">
            {/* Slot utilization bar */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Worker Load</span>
              <span className="font-mono text-slate-300 tabular-nums">{utilization}%</span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  utilization > 80 ? 'bg-amber-400' : 'bg-brand-500'
                }`}
                style={{ width: `${utilization}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 2: Waiting Backlog (Queue Depth) */}
        <div className="p-4 rounded-md bg-[#11141c] border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                Waiting Backlog
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {waiting === 0 ? 'depth clear' : `${waiting} queued`}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
                {waiting.toLocaleString()}
              </span>
              {delayed > 0 ? (
                <span className="text-xs font-mono text-amber-400 tabular-nums">
                  +{delayed} delayed
                </span>
              ) : (
                <span className="text-xs font-mono text-slate-500">0 delayed</span>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Delayed buffer:</span>
            <span className="font-mono text-slate-300 tabular-nums">{delayed} ready later</span>
          </div>
        </div>

        {/* Metric 3: Completed Jobs (Throughput & SLA) */}
        <div className="p-4 rounded-md bg-[#11141c] border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                Completed Jobs
              </span>
              <span className="text-[11px] font-mono font-medium text-emerald-400 tabular-nums">
                {successRate.toFixed(1)}% success
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
                {completed.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                Total: {stats?.database?.totalJobs ?? completed}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Audited records:</span>
            <span className="font-mono text-slate-300 tabular-nums">
              {stats?.database?.totalJobs ?? completed} in DB
            </span>
          </div>
        </div>

        {/* Metric 4: Failed & DLQ (Failure Alerting) */}
        <div
          className={`p-4 rounded-md bg-[#11141c] border flex flex-col justify-between transition-colors ${
            dlqCount > 0 ? 'border-rose-900/60 bg-rose-950/10' : 'border-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                Failed & DLQ
              </span>
              {dlqCount > 0 ? (
                <span className="flex items-center space-x-1 text-[11px] font-mono font-medium text-rose-400">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>Action Needed</span>
                </span>
              ) : (
                <span className="text-[11px] font-mono text-slate-500">No DLQ alerts</span>
              )}
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span
                className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${
                  failed > 0 ? 'text-rose-300' : 'text-white'
                }`}
              >
                {failed.toLocaleString()}
              </span>
              <span
                className={`text-xs font-mono tabular-nums ${
                  dlqCount > 0 ? 'text-rose-400 font-semibold' : 'text-slate-500'
                }`}
              >
                {dlqCount} in DLQ
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Unresolved Dead Letters:</span>
            <span
              className={`font-mono tabular-nums ${
                dlqCount > 0 ? 'text-rose-400 font-medium' : 'text-slate-500'
              }`}
            >
              {dlqCount} pending review
            </span>
          </div>
        </div>
      </div>

      {/* System Status Bar - Compact, quiet, technical */}
      <div className="px-3.5 py-2 rounded-md bg-[#0e1118] border border-slate-800/80 flex flex-wrap items-center justify-between gap-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400">
          {/* Worker Queue */}
          <div className="flex items-center space-x-1.5">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">Queue:</span>
            <span className="font-mono text-slate-200 font-medium">
              {stats?.worker?.queueName || 'default-jobs'}
            </span>
          </div>

          {/* Redis Health */}
          <div className="flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">Redis:</span>
            <span className="flex items-center space-x-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  stats?.worker?.redisConnected ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
              />
              <span
                className={`font-mono text-[11px] ${
                  stats?.worker?.redisConnected ? 'text-slate-300' : 'text-rose-400 font-medium'
                }`}
              >
                {stats?.worker?.redisConnected ? 'healthy' : 'disconnected'}
              </span>
            </span>
          </div>

          {/* Rate Limiter */}
          <div className="flex items-center space-x-1.5">
            <Gauge className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">Rate Limit:</span>
            <span className="font-mono text-slate-300 tabular-nums">
              {stats?.worker?.rateLimitMax ?? 100} ops / {(stats?.worker?.rateLimitDurationMs ?? 1000)}ms
            </span>
          </div>
        </div>

        {/* Last Sync */}
        <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
          <RefreshCcw className="w-3 h-3 text-slate-500" />
          <span>Last sync:</span>
          <span className="text-slate-300 tabular-nums">
            {stats ? new Date(stats.timestamp).toLocaleTimeString() : 'syncing...'}
          </span>
        </div>
      </div>
    </div>
  );
};

