import React from 'react';
import { Job } from '../types';
import {
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Terminal,
  RotateCw,
  Cpu,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-3xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base">Job Inspection</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {job.status}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5">{job.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Queue</span>
              <p className="font-mono text-slate-200 font-semibold mt-1">{job.queueName}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Priority</span>
              <p className="font-mono text-slate-200 font-semibold mt-1">{job.priority}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Attempts</span>
              <p className="font-mono text-slate-200 font-semibold mt-1">
                {job.attemptCount} / {job.maxAttempts}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] uppercase font-semibold text-slate-400">BullMQ ID</span>
              <p className="font-mono text-slate-400 text-[10px] mt-1 truncate">
                {job.bullMqJobId || 'Pending'}
              </p>
            </div>
          </div>

          {/* Payload JSON */}
          <div>
            <div className="flex items-center space-x-1.5 mb-2 font-semibold text-slate-200">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>Job Payload</span>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto selection:bg-indigo-500/40">
              {JSON.stringify(job.payload, null, 2)}
            </pre>
          </div>

          {/* Execution Result */}
          {job.result && (
            <div>
              <div className="flex items-center space-x-1.5 mb-2 font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Execution Result ({job.result.executionDurationMs} ms)</span>
              </div>
              <pre className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 font-mono text-[11px] text-emerald-200 overflow-x-auto">
                {JSON.stringify(job.result.data, null, 2)}
              </pre>
            </div>
          )}

          {/* Attempts History */}
          <div>
            <div className="flex items-center space-x-1.5 mb-2 font-semibold text-slate-200">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Execution Attempt History</span>
            </div>
            {job.attempts && job.attempts.length > 0 ? (
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Worker ID</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Error Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {job.attempts.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-300">
                          {att.attemptNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${att.status === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : att.status === 'FAILED'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-indigo-500/10 text-indigo-400'
                              }`}
                          >
                            {att.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {att.workerId || 'pool-worker'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {att.durationMs ? `${att.durationMs}ms` : 'running...'}
                        </td>
                        <td className="py-2.5 px-3 text-rose-300 font-mono text-[10px] max-w-xs truncate">
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
              <div className="flex items-center space-x-1.5 mb-2 font-semibold text-slate-200">
                <RotateCw className="w-4 h-4 text-indigo-400" />
                <span>Audit Trail</span>
              </div>
              <div className="space-y-2 border-l-2 border-slate-800 pl-4 ml-2">
                {job.auditLogs.map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-indigo-500" />
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-200">{log.action}</span>
                      <span className="text-[10px] text-slate-500 font-mono">by {log.actor}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
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
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Created: {new Date(job.createdAt).toLocaleString()}
          </span>
          <div className="flex items-center space-x-2">
            {job.status === 'FAILED' && onReplayJob && (
              <button
                onClick={() => onReplayJob(job.id)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Replay from DLQ</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
