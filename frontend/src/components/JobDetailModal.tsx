import React from 'react';
import { Job } from '../types';
import {
  X,
  Clock,
  CheckCircle2,
  Terminal,
  RotateCw,
} from 'lucide-react';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onReplayJob?: (jobId: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onReplayJob,
}) => {
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-md bg-[#11141c] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#0e1118]">
          <div className="flex items-center space-x-3 min-w-0">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-white text-sm">Job Inspection</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-medium border ${
                    job.status === 'COMPLETED'
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                      : job.status === 'FAILED'
                      ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {job.status}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">{job.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded bg-[#0a0d14] border border-slate-800/90">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Queue</span>
              <p className="font-mono text-slate-200 font-medium text-xs mt-0.5">{job.queueName}</p>
            </div>
            <div className="p-2.5 rounded bg-[#0a0d14] border border-slate-800/90">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Priority</span>
              <p className="font-mono text-slate-200 font-medium text-xs mt-0.5 tabular-nums">{job.priority}</p>
            </div>
            <div className="p-2.5 rounded bg-[#0a0d14] border border-slate-800/90">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Attempts</span>
              <p className="font-mono text-slate-200 font-medium text-xs mt-0.5 tabular-nums">
                {job.attemptCount} / {job.maxAttempts}
              </p>
            </div>
            <div className="p-2.5 rounded bg-[#0a0d14] border border-slate-800/90">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">BullMQ ID</span>
              <p className="font-mono text-slate-400 text-[11px] mt-0.5 truncate">
                {job.bullMqJobId || 'n/a'}
              </p>
            </div>
          </div>

          {/* Payload JSON */}
          <div>
            <div className="flex items-center space-x-1.5 mb-1.5 font-medium text-slate-300 text-xs">
              <Terminal className="w-3.5 h-3.5 text-brand-400" />
              <span>Job Payload</span>
            </div>
            <pre className="p-3 rounded bg-[#0a0d14] border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto">
              {JSON.stringify(job.payload, null, 2)}
            </pre>
          </div>

          {/* Execution Result */}
          {job.result && (
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5 font-medium text-emerald-400 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Execution Result ({job.result.executionDurationMs} ms)</span>
              </div>
              <pre className="p-3 rounded bg-emerald-950/20 border border-emerald-900/40 font-mono text-[11px] text-emerald-200 overflow-x-auto">
                {JSON.stringify(job.result.data, null, 2)}
              </pre>
            </div>
          )}

          {/* Attempts History */}
          <div>
            <div className="flex items-center space-x-1.5 mb-1.5 font-medium text-slate-300 text-xs">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Execution Attempts ({job.attempts?.length ?? 0})</span>
            </div>
            {job.attempts && job.attempts.length > 0 ? (
              <div className="border border-slate-800 rounded overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[#0e1118] text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Worker ID</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Error Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {job.attempts.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-semibold text-slate-200 tabular-nums">
                          {att.attemptNumber}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                              att.status === 'SUCCESS'
                                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                                : att.status === 'FAILED'
                                ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                                : 'bg-brand-950/40 text-brand-300 border-brand-800/60'
                            }`}
                          >
                            {att.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {att.workerId || 'pool-worker'}
                        </td>
                        <td className="py-2 px-3 text-slate-300 tabular-nums">
                          {att.durationMs ? `${att.durationMs}ms` : 'running...'}
                        </td>
                        <td className="py-2 px-3 text-rose-300 text-[10px] max-w-xs truncate">
                          {att.errorMessage || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 italic text-[11px]">No attempt records logged yet.</p>
            )}
          </div>

          {/* Audit Logs */}
          {job.auditLogs && job.auditLogs.length > 0 && (
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5 font-medium text-slate-300 text-xs">
                <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Audit Trail</span>
              </div>
              <div className="space-y-2 border-l border-slate-800 pl-3 ml-1.5">
                {job.auditLogs.map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[17px] top-1.5 w-1.5 h-1.5 rounded-full bg-slate-500" />
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-200">{log.action}</span>
                      <span className="text-[10px] text-slate-500 font-mono">by {log.actor}</span>
                      <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#0e1118] flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Created: {new Date(job.createdAt).toLocaleString()}
          </span>
          <div className="flex items-center space-x-2">
            {job.status === 'FAILED' && onReplayJob && (
              <button
                onClick={() => onReplayJob(job.id)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-rose-700 hover:bg-rose-600 text-white font-medium text-xs transition"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Replay Job</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

