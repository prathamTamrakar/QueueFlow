import React, { useState } from 'react';
import { DLQRecord } from '../types';
import {
  AlertTriangle,
  RotateCw,
  Eye,
  CheckCircle,
  Clock,
  ShieldAlert,
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

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="glass-panel p-5 rounded-2xl border border-rose-500/20 bg-rose-950/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Dead-Letter Queue (DLQ) Center</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Permanently failed jobs that exhausted all retry policies or encountered fatal non-retryable errors.
              Administrators can inspect error details and safely replay jobs with full audit tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filterResolved}
            onChange={(e) => setFilterResolved(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="unresolved">Unresolved Failures</option>
            <option value="resolved">Recovered / Resolved</option>
            <option value="all">All DLQ History</option>
          </select>
        </div>
      </div>

      {/* DLQ List */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading && records.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
            Loading dead-letter records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <CheckCircle className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
            No unresolved dead-letter records found. All queues are running cleanly!
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((record) => (
              <div
                key={record.id}
                className="p-5 hover:bg-slate-900/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-bold text-indigo-400">
                      {record.jobId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${record.isResolved
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                    >
                      {record.isResolved ? 'RESOLVED' : 'UNRESOLVED'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Failures: <b className="text-rose-400">{record.failureCount}</b>
                    </span>
                    {record.replayCount > 0 && (
                      <span className="text-[11px] font-mono text-amber-400">
                        Replays: <b>{record.replayCount}</b>
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-mono text-rose-300 bg-rose-950/20 px-3 py-1.5 rounded-lg border border-rose-500/20">
                    {record.errorReason}
                  </p>

                  <div className="flex items-center space-x-4 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>First Failed: {new Date(record.firstFailedAt).toLocaleString()}</span>
                    </span>
                    <span>Last Failed: {new Date(record.lastFailedAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 self-end md:self-center">
                  <button
                    onClick={() => onInspect(record.jobId)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>

                  <button
                    onClick={() => onReplay(record.jobId)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md shadow-rose-600/30 transition active:scale-95"
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
