import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCw,
  Server,
  Layers,
  Clock,
  AlertOctagon,
  CheckCircle,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import type { QueueStats, QueueJob } from '../types';

interface QueueMonitorProps {
  stats: QueueStats | null;
  onRefreshStats: () => void;
}

export const QueueMonitor: React.FC<QueueMonitorProps> = ({ stats, onRefreshStats }) => {
  const [jobs, setJobs] = useState<{
    active: QueueJob[];
    delayed: QueueJob[];
    waiting: QueueJob[];
    failed: QueueJob[];
    completed: QueueJob[];
  }>({
    active: [],
    delayed: [],
    waiting: [],
    failed: [],
    completed: [],
  });

  const [activeJobTab, setActiveJobTab] = useState<'delayed' | 'active' | 'waiting' | 'failed' | 'completed'>('delayed');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await api.getQueueJobs(30);
      setJobs(res.jobs);
    } catch (err: any) {
      console.error('Failed fetching queue jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => {
      fetchJobs();
      onRefreshStats();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handlePauseResume = async () => {
    try {
      if (stats?.isPaused) {
        await api.resumeQueue();
        setActionMessage('Queue resumed successfully');
      } else {
        await api.pauseQueue();
        setActionMessage('Queue paused');
      }
      onRefreshStats();
      fetchJobs();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const res = await api.retryAllFailed();
      setActionMessage(res.message);
      onRefreshStats();
      fetchJobs();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const currentTabJobs = jobs[activeJobTab] || [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Stat Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-white">BullMQ Engine Live Monitor</h2>
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Redis Connected</span>
                </span>
                {stats?.isPaused && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
                    Queue Paused
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Queue: <code className="font-mono text-indigo-300">{stats?.queueName || 'reachinbox-email-queue'}</code> • Worker Concurrency: <span className="text-white font-semibold">{stats?.concurrency || 5}</span> • Min Delay: <span className="text-white font-semibold">{stats?.minDelayMs || 2000}ms</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handlePauseResume}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                stats?.isPaused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                  : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/30'
              }`}
            >
              {stats?.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{stats?.isPaused ? 'Resume Queue' : 'Pause Queue'}</span>
            </button>

            <button
              onClick={handleRetryFailed}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Failed</span>
            </button>

            <button
              onClick={() => {
                fetchJobs();
                onRefreshStats();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
              title="Refresh queue"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="mb-4 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
            {actionMessage}
          </div>
        )}

        {/* 5 Status Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div
            onClick={() => setActiveJobTab('delayed')}
            className={`cursor-pointer p-4 rounded-xl border transition ${
              activeJobTab === 'delayed'
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-amber-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">Delayed</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats?.counts.delayed ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Scheduled for future execution</p>
          </div>

          <div
            onClick={() => setActiveJobTab('active')}
            className={`cursor-pointer p-4 rounded-xl border transition ${
              activeJobTab === 'active'
                ? 'bg-indigo-500/10 border-indigo-500/40'
                : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-indigo-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">Active</span>
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats?.counts.active ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Processing in worker thread</p>
          </div>

          <div
            onClick={() => setActiveJobTab('waiting')}
            className={`cursor-pointer p-4 rounded-xl border transition ${
              activeJobTab === 'waiting'
                ? 'bg-blue-500/10 border-blue-500/40'
                : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-blue-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">Waiting</span>
              <Layers className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats?.counts.waiting ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Ready for next available worker</p>
          </div>

          <div
            onClick={() => setActiveJobTab('completed')}
            className={`cursor-pointer p-4 rounded-xl border transition ${
              activeJobTab === 'completed'
                ? 'bg-emerald-500/10 border-emerald-500/40'
                : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">Completed</span>
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats?.counts.completed ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Successfully sent via SMTP</p>
          </div>

          <div
            onClick={() => setActiveJobTab('failed')}
            className={`cursor-pointer p-4 rounded-xl border transition ${
              activeJobTab === 'failed'
                ? 'bg-rose-500/10 border-rose-500/40'
                : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-rose-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">Failed</span>
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats?.counts.failed ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Delivery or network error</p>
          </div>
        </div>
      </div>

      {/* Jobs Inspector Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-semibold text-white capitalize">
              {activeJobTab} Jobs Stream
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {currentTabJobs.length} listed
            </span>
          </div>

          {/* Sub tabs */}
          <div className="flex space-x-1 text-xs">
            {(['delayed', 'active', 'waiting', 'completed', 'failed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveJobTab(tab)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition ${
                  activeJobTab === tab
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {currentTabJobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No {activeJobTab} jobs currently in BullMQ.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Job ID</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Timing / Delay</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4 text-right">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {currentTabJobs.map((job) => {
                  const delaySec = Math.ceil(job.delayRemainingMs / 1000);

                  return (
                    <tr key={job.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {job.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        {job.recipient || '—'}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                        {job.subject || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        {job.state === 'delayed' && delaySec > 0 ? (
                          <span className="text-amber-400 font-semibold">
                            Delay: {delaySec}s remaining
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            {new Date(job.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {job.attemptsMade}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            job.state === 'delayed'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : job.state === 'active'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : job.state === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : job.state === 'failed'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {job.state}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
