import React from 'react';
import { Job, JobStatus, JobType } from '../types';
import {
  Search,
  Eye,
  XCircle,
  Mail,
  FileText,
  Cpu,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface JobsTableProps {
  jobs: Job[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onSelectJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  search: string;
  setSearch: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  typeFilter: string;
  setTypeFilter: (t: string) => void;
}

export const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  loading,
  total,
  page,
  totalPages,
  onPageChange,
  onSelectJob,
  onCancelJob,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
}) => {
  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/60">
            COMPLETED
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-brand-950/40 text-brand-300 border border-brand-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            <span>ACTIVE</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-950/40 text-amber-300 border border-amber-800/60">
            PENDING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-rose-950/40 text-rose-300 border border-rose-800/60">
            FAILED
          </span>
        );
      case 'DELAYED':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-purple-950/40 text-purple-300 border border-purple-800/60">
            DELAYED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  const getTypeIcon = (type: JobType) => {
    switch (type) {
      case 'EMAIL_SIMULATION':
        return <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'PDF_GENERATION':
        return <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'CPU_LIGHT_PROCESSING':
        return <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'FAILURE_SIMULATION':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-md bg-[#11141c] border border-slate-800 flex flex-col overflow-hidden">
      {/* Search & Filters Toolbar */}
      <div className="p-3 border-b border-slate-800/80 bg-[#0e1118] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Job ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#11141c] border border-slate-800 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono transition"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-md bg-[#11141c] border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="DELAYED">Delayed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-md bg-[#11141c] border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="">All Job Types</option>
            <option value="EMAIL_SIMULATION">Email Simulation</option>
            <option value="PDF_GENERATION">PDF Generation</option>
            <option value="CPU_LIGHT_PROCESSING">CPU Light</option>
            <option value="FAILURE_SIMULATION">Failure Simulation</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto min-h-[260px]">
        {loading && jobs.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-slate-400 animate-pulse">
            Querying job database records...
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <p className="text-slate-300 font-medium">No queue records match the active criteria.</p>
            <p className="text-slate-400 text-[11px] mt-1">
              Dispatch a test job via &ldquo;Enqueue&rdquo; to populate the execution queue.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e1118] text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800/80">
              <tr>
                <th className="py-2.5 px-3.5">Job ID</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Attempts</th>
                <th className="py-2.5 px-3">Created</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-slate-800/30 transition-colors cursor-pointer group"
                  onClick={() => onSelectJob(job.id)}
                >
                  <td className="py-2.5 px-3.5 font-mono text-slate-300">
                    <span className="text-brand-400 group-hover:underline">
                      {job.id.slice(0, 8)}
                    </span>
                    <span className="text-slate-500">{job.id.slice(8, 14)}...</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center space-x-1.5">
                      {getTypeIcon(job.type)}
                      <span className="text-slate-300 font-medium text-[11px]">
                        {job.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">{getStatusBadge(job.status)}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-300">
                    <span
                      className={
                        job.attemptCount > 1
                          ? 'text-amber-400 font-semibold'
                          : 'text-slate-300'
                      }
                    >
                      {job.attemptCount}
                    </span>
                    <span className="text-slate-400"> / {job.maxAttempts}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] tabular-nums whitespace-nowrap">
                    {new Date(job.createdAt).toLocaleTimeString()}
                    <span className="text-slate-400 ml-1.5 hidden sm:inline">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td
                    className="py-2.5 px-3.5 text-right space-x-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onSelectJob(job.id)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      title="Inspect Job"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {(job.status === 'PENDING' || job.status === 'DELAYED') && (
                      <button
                        onClick={() => onCancelJob(job.id)}
                        className="p-1 rounded text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40 transition"
                        title="Cancel Job"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 bg-[#0e1118]">
        <div className="font-mono text-[11px]">
          Showing page <span className="text-slate-200 font-semibold">{page}</span> of{' '}
          <span className="text-slate-200 font-semibold">{totalPages || 1}</span>{' '}
          (<span className="tabular-nums">{total}</span> jobs recorded)
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1 rounded border border-slate-800 bg-[#11141c] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1 rounded border border-slate-800 bg-[#11141c] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 transition"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

