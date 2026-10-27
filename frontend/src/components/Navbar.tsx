import React from 'react';
import {
  Activity,
  Layers,
  AlertTriangle,
  Plus,
  RefreshCw,
  Server,
  Radio,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'overview' | 'jobs' | 'dlq';
  setActiveTab: (tab: 'overview' | 'jobs' | 'dlq') => void;
  isConnected: boolean;
  isAutoRefresh: boolean;
  setIsAutoRefresh: (val: boolean) => void;
  onOpenEnqueue: () => void;
  onManualRefresh: () => void;
  unresolvedDlqCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
  isAutoRefresh,
  setIsAutoRefresh,
  onOpenEnqueue,
  onManualRefresh,
  unresolvedDlqCount,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-surface-subtle/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center space-x-6 min-w-0">
            <div className="flex items-center space-x-2.5 shrink-0">
              <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-200">
                <Layers className="w-4 h-4 text-brand-500" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm tracking-tight text-white">
                  QueueFlow
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                  ENGINE
                </span>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-slate-800 text-white border border-slate-700/80 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('jobs')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'jobs'
                    ? 'bg-slate-800 text-white border border-slate-700/80 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Job Explorer</span>
              </button>

              <button
                onClick={() => setActiveTab('dlq')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'dlq'
                    ? 'bg-slate-800 text-white border border-slate-700/80 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${unresolvedDlqCount > 0 ? 'text-rose-400' : 'text-slate-400'}`} />
                <span>Dead-Letter Queue</span>
                {unresolvedDlqCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-rose-500/20 text-rose-300 text-[10px] font-mono font-semibold rounded border border-rose-500/30 tabular-nums">
                    {unresolvedDlqCount}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Controls & Connection Status */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
            {/* Connection Status indicator */}
            <div className="hidden sm:flex items-center space-x-1.5 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
              />
              <span className="text-[11px] font-mono text-slate-300">
                {isConnected ? 'connected' : 'offline'}
              </span>
            </div>

            {/* Auto refresh toggle */}
            <button
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              title={isAutoRefresh ? 'Live updates enabled (polling every 3s)' : 'Live updates paused'}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors border ${
                isAutoRefresh
                  ? 'bg-brand-950/40 text-brand-400 border-brand-800/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Radio className={`w-3 h-3 ${isAutoRefresh ? 'text-brand-400' : 'text-slate-500'}`} />
              <span className="text-[11px]">{isAutoRefresh ? '3s' : 'off'}</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={onManualRefresh}
              title="Sync now"
              className="p-1.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Enqueue Job CTA */}
            <button
              onClick={onOpenEnqueue}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs border border-brand-500/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enqueue</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden items-center space-x-1 py-2 border-t border-slate-800/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'jobs'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3 h-3" />
            <span>Jobs</span>
          </button>
          <button
            onClick={() => setActiveTab('dlq')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'dlq'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className={`w-3 h-3 ${unresolvedDlqCount > 0 ? 'text-rose-400' : ''}`} />
            <span>Dead-Letter</span>
            {unresolvedDlqCount > 0 && (
              <span className="px-1 py-0.2 bg-rose-500/20 text-rose-300 text-[10px] font-mono rounded">
                {unresolvedDlqCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

