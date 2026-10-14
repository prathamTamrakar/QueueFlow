import React from 'react';
import {
  Activity,
  Layers,
  AlertTriangle,
  PlusCircle,
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
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/25 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-indigo-300">
                  QueueFlow
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  DISTRIBUTED
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Distributed Job Processing Engine</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 pl-6 border-l border-slate-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('jobs')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'jobs'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Job Explorer</span>
            </button>
            <button
              onClick={() => setActiveTab('dlq')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${activeTab === 'dlq'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Dead-Letter Queue</span>
              {unresolvedDlqCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500/30 text-rose-300 text-[10px] font-bold rounded-full border border-rose-500/40">
                  {unresolvedDlqCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Controls & Connection Status */}
        <div className="flex items-center space-x-3">
          {/* Connection Status indicator */}
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-400'
                }`}
            />
            <span className="text-[11px] font-medium text-slate-300">
              {isConnected ? 'Live Connected' : 'Offline'}
            </span>
          </div>

          {/* Auto refresh toggle */}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            title="Toggle 3s live polling"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${isAutoRefresh
                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
          >
            <Radio className={`w-3 h-3 ${isAutoRefresh ? 'animate-pulse text-indigo-400' : ''}`} />
            <span>{isAutoRefresh ? 'Live (3s)' : 'Paused'}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={onManualRefresh}
            title="Manual sync now"
            className="p-1.5 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* New Job CTA */}
          <button
            onClick={onOpenEnqueue}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 hover:from-indigo-600 hover:to-indigo-700 active:scale-95 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Enqueue Job</span>
          </button>
        </div>
      </div>
    </header>
  );
};
