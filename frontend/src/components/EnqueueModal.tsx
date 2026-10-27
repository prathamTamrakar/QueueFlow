import React, { useState } from 'react';
import { JobType } from '../types';
import { X, Send, Key, Plus } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-md bg-[#11141c] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#0e1118]">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded bg-brand-950 border border-brand-800/60 flex items-center justify-center text-brand-400">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Enqueue Background Job</h3>
              <p className="text-[11px] text-slate-400">Dispatch workload payload to Redis BullMQ queue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Job Type Selector */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
              Workload Type
            </label>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value as JobType)}
              className="w-full px-3 py-1.5 rounded-md bg-[#0a0d14] border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="EMAIL_SIMULATION">Email Simulation (SMTP Latency & Dedup)</option>
              <option value="PDF_GENERATION">PDF Generation (Compute & Storage Simulation)</option>
              <option value="CPU_LIGHT_PROCESSING">CPU-Light Processing (Chunk Hash Digest)</option>
              <option value="FAILURE_SIMULATION">Failure Simulation (Retry Backoff vs DLQ)</option>
            </select>
          </div>

          {/* Type Specific Fields */}
          {jobType === 'EMAIL_SIMULATION' && (
            <div className="p-3.5 rounded-md bg-[#0e1118] border border-slate-800/80 space-y-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500 font-mono text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500 text-xs"
                  required
                />
              </div>
            </div>
          )}

          {jobType === 'PDF_GENERATION' && (
            <div className="p-3.5 rounded-md bg-[#0e1118] border border-slate-800/80 space-y-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Report ID</label>
                <input
                  type="text"
                  value={pdfReportId}
                  onChange={(e) => setPdfReportId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 font-mono text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Report Title</label>
                  <input
                    type="text"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Page Count</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={pdfPages}
                    onChange={(e) => setPdfPages(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 font-mono text-xs tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {jobType === 'CPU_LIGHT_PROCESSING' && (
            <div className="p-3.5 rounded-md bg-[#0e1118] border border-slate-800/80 space-y-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Task Identifier</label>
                <input
                  type="text"
                  value={cpuTaskName}
                  onChange={(e) => setCpuTaskName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 font-mono text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Records to Hash</label>
                  <input
                    type="number"
                    min="100"
                    max="50000"
                    value={cpuRecords}
                    onChange={(e) => setCpuRecords(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Digest Algorithm</label>
                  <select
                    value={cpuAlgorithm}
                    onChange={(e) => setCpuAlgorithm(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 text-xs"
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
            <div className="p-3.5 rounded-md bg-rose-950/20 border border-rose-900/40 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Failure Nature</label>
                  <select
                    value={failType}
                    onChange={(e) => setFailType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 text-xs"
                  >
                    <option value="RETRYABLE">RETRYABLE (Triggers Backoff)</option>
                    <option value="PERMANENT">PERMANENT (Direct to DLQ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Failures Before Success
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={failCountBeforeSuccess}
                    onChange={(e) => setFailCountBeforeSuccess(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 font-mono text-xs tabular-nums"
                  />
                  <span className="text-[10px] text-amber-400 mt-0.5 block">2 = recover on 3rd attempt</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Simulated Error Message</label>
                <input
                  type="text"
                  value={customError}
                  onChange={(e) => setCustomError(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Idempotency Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="flex items-center space-x-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <Key className="w-3 h-3 text-slate-500" />
                <span>Idempotency-Key Header (Optional)</span>
              </label>
              <button
                type="button"
                onClick={generateRandomKey}
                className="text-[11px] text-brand-400 hover:text-brand-300 font-mono"
              >
                + generate key
              </button>
            </div>
            <input
              type="text"
              placeholder="e.g. idemp-req-79102"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-[#0a0d14] border border-slate-800 font-mono text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Re-submitting with identical key returns cached response without dispatching duplicate job.
            </p>
          </div>

          {/* Scheduling & Retry Policy Parameters */}
          <div className="grid grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80">
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1 tracking-wider">
                Priority
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 font-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1 tracking-wider">
                Max Retries
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 font-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1 tracking-wider">
                Backoff (ms)
              </label>
              <input
                type="number"
                step="500"
                value={backoffDelayMs}
                onChange={(e) => setBackoffDelayMs(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 font-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1 tracking-wider">
                Delay (ms)
              </label>
              <input
                type="number"
                step="1000"
                min="0"
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-[#0a0d14] border border-slate-800 text-slate-200 font-mono text-xs tabular-nums"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs border border-brand-500/50 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Enqueuing...' : 'Dispatch Job'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

