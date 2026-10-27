import React, { useState } from 'react';
import { DLQRecord } from '../types';
import {
  RotateCw,
  Eye,
  CheckCircle2,
  Clock,
  AlertOctagon,
} from 'lucide-react';

interface DLQManagementProps {
  records: DLQRecord[];
  loading: boolean;
  total: number;
  onReplay: (jobId: string) => void;
  onInspect: (jobId: string) => void;
}

export const DLQManagement: React.FC<DLQManagementProps> = ({
  records,
  loading,
  total,
  onReplay,
  onInspect,
}) => {
  const [filterResolved, setFilterResolved] = useState<string>('unresolved');

  const filtered = records.filter((r) => {
    if (filterResolved === 'unresolved') return !r.isResolved;
    if (filterResolved === 'resolved') return r.isResolved;
    return true;
  });

  const unresolvedCount = records.filter((r) => !r.isResolved).length;

  return (
    <div className="space-y-3">
      {/* DLQ Header Strip */}
      <div className="p-4 rounded-md bg-[#11141c] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded bg-rose-950/50 border border-rose-800/60 flex items-center justify-center text-rose-400">
              <AlertOctagon className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-semibold text-slate-100">
              Dead-Letter Queue (DLQ)
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700/60">
              {unresolvedCount} unresolved / {total} total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Jobs that failed all retry attempts or threw non-retryable errors. Replaying re-enqueues the job with boosted priority.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          <select
            value={filterResolved}
            onChange={(e) => setFilterResolved(e.target.value)}
            className="px-2.5 py-1.5 rounded-md bg-[#0e1118] border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="unresolved">Unresolved Only ({unresolvedCount})</option>
            <option value="resolved">Resolved / Recovered</option>
            <option value="all">All DLQ Records ({records.length})</option>
          </select>
        </div>
      </div>

      {/* DLQ Records List */}
      <div className="rounded-md bg-[#11141c] border border-slate-800 overflow-hidden">
        {loading && records.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-slate-400 animate-pulse">
            Loading dead-letter records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-slate-300 font-medium">No dead-letter jobs in this view.</p>
            <p className="text-slate-400 text-[11px]">
              {filterResolved === 'unresolved'
                ? 'All queues are healthy and running without permanent failures.'
                : 'No historical dead-letter records matching filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {filtered.map((record) => (
              <div
                key={record.id}
                className="p-4 hover:bg-slate-800/20 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-xs font-semibold text-brand-400">
                      {record.jobId}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-medium border ${
                        record.isResolved
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                          : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                      }`}
                    >
                      {record.isResolved ? 'RESOLVED' : 'UNRESOLVED'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Failures: <strong className="text-rose-400 tabular-nums">{record.failureCount}</strong>
                    </span>
                    {record.replayCount > 0 && (
                      <span className="text-[11px] font-mono text-amber-400">
                        Replays: <strong className="tabular-nums">{record.replayCount}</strong>
                      </span>
                    )}
                  </div>

                  {/* Error Reason in Monospace Code Block */}
                  <div className="p-2.5 rounded bg-[#0a0d14] border border-slate-800 font-mono text-[11px] text-rose-300/90 leading-relaxed overflow-x-auto">
                    {record.errorReason}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>First Failed: {new Date(record.firstFailedAt).toLocaleString()}</span>
                    </span>
                    <span>Last Failed: {new Date(record.lastFailedAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 shrink-0 self-end md:self-start pt-1">
                  <button
                    onClick={() => onInspect(record.jobId)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-[#0e1118] hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>

                  <button
                    onClick={() => onReplay(record.jobId)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-rose-700 hover:bg-rose-600 text-white font-medium text-xs border border-rose-600/60 transition"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Replay Job</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

