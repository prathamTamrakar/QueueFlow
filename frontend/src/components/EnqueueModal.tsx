import React, { useState } from 'react';
import { JobType } from '../types';
import { X, Send, Key, Sparkles, RefreshCw } from 'lucide-react';

interface EnqueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (jobData: any, idempotencyKey?: string) => Promise<void>;
}

export const EnqueueModal: React.FC<EnqueueModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [jobType, setJobType] = useState<JobType>('EMAIL_SIMULATION');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [priority, setPriority] = useState<number>(0);
  const [maxAttempts, setMaxAttempts] = useState<number>(3);
  const [backoffDelayMs, setBackoffDelayMs] = useState<number>(1000);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Email state
  const [emailRecipient, setEmailRecipient] = useState('user@enterprise.org');
  const [emailSubject, setEmailSubject] = useState('Your Monthly Activity Summary');

  // PDF state
  const [pdfReportId, setPdfReportId] = useState('rep_analytics_2026');
  const [pdfTitle, setPdfTitle] = useState('Executive Distributed Performance Report');
  const [pdfPages, setPdfPages] = useState<number>(8);

  // CPU Light state
  const [cpuTaskName, setCpuTaskName] = useState('data_partition_hashing');
  const [cpuRecords, setCpuRecords] = useState<number>(5000);
  const [cpuAlgorithm, setCpuAlgorithm] = useState<'sha256' | 'sha512' | 'md5'>('sha256');

  // Failure Simulation state
  const [failScenario, setFailScenario] = useState('retry_recovery_demo');
  const [failCountBeforeSuccess, setFailCountBeforeSuccess] = useState<number>(2);
  const [failType, setFailType] = useState<'RETRYABLE' | 'PERMANENT'>('RETRYABLE');
  const [customError, setCustomError] = useState('Simulated transient payment gateway 503');

  if (!isOpen) return null;

  const generateRandomKey = () => {
    setIdempotencyKey(`idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let payload: any = {};
    if (jobType === 'EMAIL_SIMULATION') {
      payload = { recipient: emailRecipient, subject: emailSubject, template: 'standard-v1' };
    } else if (jobType === 'PDF_GENERATION') {
      payload = { reportId: pdfReportId, title: pdfTitle, pages: Number(pdfPages), includeCharts: true };
    } else if (jobType === 'CPU_LIGHT_PROCESSING') {
      payload = { taskName: cpuTaskName, recordsCount: Number(cpuRecords), algorithm: cpuAlgorithm };
    } else if (jobType === 'FAILURE_SIMULATION') {
      payload = {
        scenario: failScenario,
        failCountBeforeSuccess: Number(failCountBeforeSuccess),
        failType,
        customErrorMessage: customError,
      };
    }

    try {
      await onSubmit(
        {
          type: jobType,
          payload,
          priority: Number(priority),
          maxAttempts: Number(maxAttempts),
          backoffDelayMs: Number(backoffDelayMs),
          delayMs: Number(delayMs),
        },
        idempotencyKey.trim() || undefined
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Enqueue New Background Job</h3>
              <p className="text-xs text-slate-400">Dispatch workload to Redis BullMQ distributed worker pool</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Job Type Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">
              Job Type Workload
            </label>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value as JobType)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="EMAIL_SIMULATION">Email Simulation (SMTP Latency & Side-Effect Dedup)</option>
              <option value="PDF_GENERATION">PDF Generation (Compute & Storage Simulation)</option>
              <option value="CPU_LIGHT_PROCESSING">CPU-Light Processing (Hashing / Chunk Digest)</option>
              <option value="FAILURE_SIMULATION">Failure Simulation (Retry Recovery vs DLQ)</option>
            </select>
          </div>

          {/* Type Specific Fields */}
          {jobType === 'EMAIL_SIMULATION' && (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  required
                />
              </div>
            </div>
          )}

          {jobType === 'PDF_GENERATION' && (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Report ID</label>
                <input
                  type="text"
                  value={pdfReportId}
                  onChange={(e) => setPdfReportId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Report Title</label>
                  <input
                    type="text"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Page Count</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={pdfPages}
                    onChange={(e) => setPdfPages(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {jobType === 'CPU_LIGHT_PROCESSING' && (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Task Identifier</label>
                <input
                  type="text"
                  value={cpuTaskName}
                  onChange={(e) => setCpuTaskName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Records to Hash</label>
                  <input
                    type="number"
                    min="100"
                    max="50000"
                    value={cpuRecords}
                    onChange={(e) => setCpuRecords(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Digest Algorithm</label>
                  <select
                    value={cpuAlgorithm}
                    onChange={(e) => setCpuAlgorithm(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="sha256">SHA-256</option>
                    <option value="sha512">SHA-512</option>
                    <option value="md5">MD5</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {jobType === 'FAILURE_SIMULATION' && (
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Failure Nature</label>
                  <select
                    value={failType}
                    onChange={(e) => setFailType(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="RETRYABLE">RETRYABLE (Triggers Backoff)</option>
                    <option value="PERMANENT">PERMANENT (Direct to DLQ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Failures Before Success
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={failCountBeforeSuccess}
                    onChange={(e) => setFailCountBeforeSuccess(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                  <span className="text-[10px] text-amber-400">Set 2 to demo 3rd attempt recovery!</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Simulated Error Message</label>
                <input
                  type="text"
                  value={customError}
                  onChange={(e) => setCustomError(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* Idempotency Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-400 uppercase">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Idempotency-Key Header (Optional)</span>
              </label>
              <button
                type="button"
                onClick={generateRandomKey}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                + Generate UUID
              </button>
            </div>
            <input
              type="text"
              placeholder="e.g. idemp-req-79102"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Submitting identical key twice returns cached result without creating a duplicate job.
            </p>
          </div>

          {/* Scheduling & Retry Policy Parameters */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                Priority (-20 to 20)
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                Max Retries
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                Backoff (ms)
              </label>
              <input
                type="number"
                step="500"
                value={backoffDelayMs}
                onChange={(e) => setBackoffDelayMs(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Enqueuing...' : 'Dispatch to Queue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
