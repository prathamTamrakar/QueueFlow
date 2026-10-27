import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { QueueCharts } from './components/QueueCharts';
import { JobsTable } from './components/JobsTable';
import { DLQManagement } from './components/DLQManagement';
import { JobDetailModal } from './components/JobDetailModal';
import { EnqueueModal } from './components/EnqueueModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ApiClient } from './api/client';
import { Job, QueueStats, DLQRecord } from './types';
import { AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'dlq'>('overview');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stats State
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  // Jobs State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // DLQ State
  const [dlqRecords, setDlqRecords] = useState<DLQRecord[]>([]);
  const [dlqLoading, setDlqLoading] = useState<boolean>(false);
  const [totalDlq, setTotalDlq] = useState<number>(0);

  // Modals & Drawers
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [inspectedJob, setInspectedJob] = useState<Job | null>(null);
  const [isEnqueueOpen, setIsEnqueueOpen] = useState<boolean>(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    isDestructive?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => { },
  });

  // Fetch Stats
  const loadStats = useCallback(async () => {
    try {
      const data = await ApiClient.getStats();
      setStats(data);
      setIsConnected(true);
      setErrorMessage(null);
    } catch (err: any) {
      setIsConnected(false);
      // don't flood UI if connection briefly lost
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Jobs
  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const data = await ApiClient.getJobs({
        page,
        limit: 15,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        search: search || undefined,
      });
      setJobs(data.jobs);
      setTotalPages(data.totalPages);
      setTotalJobs(data.total);
      setIsConnected(true);
    } catch (err: any) {
      setIsConnected(false);
    } finally {
      setJobsLoading(false);
    }
  }, [page, statusFilter, typeFilter, search]);

  // Fetch DLQ Records
  const loadDLQ = useCallback(async () => {
    setDlqLoading(true);
    try {
      const data = await ApiClient.getFailedDLQJobs({ limit: 50 });
      setDlqRecords(data.records);
      setTotalDlq(data.total);
      setIsConnected(true);
    } catch (err: any) {
      setIsConnected(false);
    } finally {
      setDlqLoading(false);
    }
  }, []);

  // Master refresh
  const refreshAll = useCallback(() => {
    loadStats();
    if (activeTab === 'jobs' || activeTab === 'overview') {
      loadJobs();
    }
    if (activeTab === 'dlq' || activeTab === 'overview') {
      loadDLQ();
    }
  }, [activeTab, loadStats, loadJobs, loadDLQ]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Polling loop
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      refreshAll();
    }, 3000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, refreshAll]);

  // Inspect single job details
  const handleSelectJob = async (jobId: string) => {
    setSelectedJobId(jobId);
    try {
      const job = await ApiClient.getJobById(jobId);
      setInspectedJob(job);
    } catch (err: any) {
      setErrorMessage(`Failed to load job details: ${err.message}`);
    }
  };

  // Submit Enqueue Job
  const handleEnqueue = async (jobData: any, idempotencyKey?: string) => {
    try {
      const result = await ApiClient.enqueueJob(jobData, idempotencyKey);
      refreshAll();
      if (result.cached) {
        setErrorMessage('Notice: Returned existing cached job via Idempotency-Key.');
        setTimeout(() => setErrorMessage(null), 4000);
      }
    } catch (err: any) {
      setErrorMessage(`Enqueue Failed: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Cancel Job confirmation
  const handleCancelJob = (jobId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Cancel Job Confirmation',
      message: `Are you sure you want to cancel job ${jobId}? It will be removed from BullMQ queue processing.`,
      confirmLabel: 'Cancel Job',
      isDestructive: true,
      action: async () => {
        try {
          await ApiClient.cancelJob(jobId);
          refreshAll();
        } catch (err: any) {
          setErrorMessage(`Failed to cancel job: ${err.message}`);
        }
      },
    });
  };

  // Replay DLQ Job confirmation
  const handleReplayJob = (jobId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Replay Dead-Letter Job',
      message: `This will reset the attempt counter and re-enqueue job ${jobId} with boosted priority. Replay will be logged in the audit trail. Proceed?`,
      confirmLabel: 'Replay Job Now',
      isDestructive: false,
      action: async () => {
        try {
          await ApiClient.replayDLQJob(jobId, 'Admin dashboard manual replay');
          refreshAll();
          if (inspectedJob?.id === jobId) {
            handleSelectJob(jobId);
          }
        } catch (err: any) {
          setErrorMessage(`Replay Failed: ${err.message}`);
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-surface-base flex flex-col font-sans">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        isAutoRefresh={isAutoRefresh}
        setIsAutoRefresh={setIsAutoRefresh}
        onOpenEnqueue={() => setIsEnqueueOpen(true)}
        onManualRefresh={refreshAll}
        unresolvedDlqCount={stats?.database?.unresolvedDlqCount ?? 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="p-3 rounded-md bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-slate-400 hover:text-white text-xs font-mono ml-4"
              title="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab 1: Live Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <StatsOverview stats={stats} loading={statsLoading} />
            <QueueCharts stats={stats} />
            <div className="space-y-2">
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Recent Queue Executions
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700/60">
                    Top 8 records
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium font-mono"
                >
                  View Job Explorer &rarr;
                </button>
              </div>
              <JobsTable
                jobs={jobs.slice(0, 8)}
                loading={jobsLoading}
                total={totalJobs}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                onSelectJob={handleSelectJob}
                onCancelJob={handleCancelJob}
                search={search}
                setSearch={setSearch}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Job Explorer */}
        {activeTab === 'jobs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Job Explorer & Execution History</h2>
                <p className="text-xs text-slate-400">
                  Search, inspect payload parameters, view attempt logs and cancel active tasks
                </p>
              </div>
            </div>
            <JobsTable
              jobs={jobs}
              loading={jobsLoading}
              total={totalJobs}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              onSelectJob={handleSelectJob}
              onCancelJob={handleCancelJob}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
            />
          </div>
        )}

        {/* Tab 3: Dead-Letter Queue */}
        {activeTab === 'dlq' && (
          <DLQManagement
            records={dlqRecords}
            loading={dlqLoading}
            total={totalDlq}
            onReplay={handleReplayJob}
            onInspect={handleSelectJob}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0e1118] py-3.5 px-6 text-center text-xs text-slate-400 font-mono">
        QueueFlow Distributed Job Processing Engine &bull; BullMQ &bull; Redis &bull; PostgreSQL &bull; Prisma
      </footer>


      {/* Inspection Modal */}
      {selectedJobId && (
        <JobDetailModal
          job={inspectedJob}
          onClose={() => {
            setSelectedJobId(null);
            setInspectedJob(null);
          }}
          onReplayJob={handleReplayJob}
        />
      )}

      {/* Enqueue Modal */}
      <EnqueueModal
        isOpen={isEnqueueOpen}
        onClose={() => setIsEnqueueOpen(false)}
        onSubmit={handleEnqueue}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={() => {
          confirmConfig.action();
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default App;
