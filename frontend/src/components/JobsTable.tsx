import React, { useState } from 'react';
import { Job, JobStatus, JobType } from '../types';
import {
  Search,
  Filter,
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            COMPLETED
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
            ACTIVE
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            PENDING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            FAILED
          </span>
        );
      case 'DELAYED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            DELAYED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
            {status}
          </span>
        );
    }
  };

  const getTypeIcon = (type: JobType) => {
    switch (type) {
      case 'EMAIL_SIMULATION':
        return <Mail className="w-3.5 h-3.5 text-sky-400" />;
      case 'PDF_GENERATION':
        return <FileText className="w-3.5 h-3.5 text-amber-400" />;
      case 'CPU_LIGHT_PROCESSING':
        return <Cpu className="w-3.5 h-3.5 text-emerald-400" />;
      case 'FAILURE_SIMULATION':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
      {/* Search & Filters Header */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/40">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Job ID or BullMQ ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
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
            className="px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
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
      <div className="overflow-x-auto min-h-[300px]">
        {loading && jobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
            Fetching job queue records...
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No matching jobs found in queue. Click "Enqueue Job" to dispatch one!
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800/80">
              <tr>
                <th className="py-3 px-4">Job ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Attempts</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-slate-900/40 transition-colors group cursor-pointer"
                  onClick={() => onSelectJob(job.id)}
                >
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-300">
                    <span className="text-indigo-400 font-semibold">{job.id.slice(0, 8)}</span>
                    <span className="text-slate-500">{job.id.slice(8, 18)}...</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(job.type)}
                      <span className="font-medium text-slate-200">
                        {job.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">{getStatusBadge(job.status)}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    <span
                      className={
                        job.attemptCount > 1
                          ? 'text-amber-400 font-bold'
                          : 'text-slate-400'
                      }
                    >
                      {job.attemptCount}
                    </span>
                    <span className="text-slate-600"> / {job.maxAttempts}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                    {new Date(job.createdAt).toLocaleTimeString()} (
                    {new Date(job.createdAt).toLocaleDateString()})
                  </td>
                  <td
                    className="py-3.5 px-4 text-right space-x-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onSelectJob(job.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      title="Inspect Job"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {(job.status === 'PENDING' || job.status === 'DELAYED') && (
                      <button
                        onClick={() => onCancelJob(job.id)}
                        className="p-1 rounded-lg text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40 transition"
                        title="Cancel Job"
                      >
                        <XCircle className="w-4 h-4" />
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
      <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/40">
        <div>
          Showing page <span className="text-white font-semibold">{page}</span> of{' '}
          <span className="text-white font-semibold">{totalPages || 1}</span> ({total} total jobs)
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-900 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-900 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
