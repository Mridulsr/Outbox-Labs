import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ScheduledTable } from './components/ScheduledTable';
import { SentTable } from './components/SentTable';
import { QueueMonitor } from './components/QueueMonitor';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { SettingsModal } from './components/SettingsModal';
import { SearchModal } from './components/SearchModal';
import { AuthModal } from './components/AuthModal';
import { api } from './services/api';
import type { Email, QueueStats, SlackStatus, UserProfile } from './types';
import {
  Clock,
  Send,
  Activity,
  Gauge,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function App() {
  // Authentication State
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('reachinbox_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Navigation Tab
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'queue' | 'search'>('scheduled');

  // Data States
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);

  // Loading States
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [loadingSent, setLoadingSent] = useState(false);

  // Modal Visibility States
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global Notification / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Auth Handlers
  const handleLoginSuccess = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('reachinbox_user', JSON.stringify(profile));
    showToast(`Welcome, ${profile.name}! Signed in successfully.`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('reachinbox_user');
    showToast('Signed out successfully.');
  };

  // Data Fetching
  const fetchScheduled = async () => {
    try {
      setLoadingScheduled(true);
      const res = await api.getScheduledEmails();
      setScheduledEmails(res.emails);
    } catch (err: any) {
      console.error('Failed to fetch scheduled emails:', err);
    } finally {
      setLoadingScheduled(false);
    }
  };

  const fetchSent = async () => {
    try {
      setLoadingSent(true);
      const res = await api.getSentEmails();
      setSentEmails(res.emails);
    } catch (err: any) {
      console.error('Failed to fetch sent emails:', err);
    } finally {
      setLoadingSent(false);
    }
  };

  const fetchQueueStats = async () => {
    try {
      const res = await api.getQueueStats();
      setQueueStats(res.stats);
    } catch (err: any) {
      console.warn('Queue stats unavailable:', err.message);
    }
  };

  const fetchSlackStatus = async () => {
    try {
      const res = await api.getSlackStatus();
      setSlackStatus(res);
    } catch (err: any) {
      console.warn('Slack status unavailable:', err.message);
    }
  };

  const refreshAllData = () => {
    fetchScheduled();
    fetchSent();
    fetchQueueStats();
    fetchSlackStatus();
  };

  // Initial load and periodic background polling
  useEffect(() => {
    refreshAllData();
    const interval = setInterval(() => {
      fetchScheduled();
      fetchSent();
      fetchQueueStats();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCancelEmail = async (id: string) => {
    try {
      await api.cancelEmail(id);
      showToast('Scheduled email removed from queue.');
      fetchScheduled();
      fetchQueueStats();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-4 py-3 rounded-2xl bg-indigo-600 text-white shadow-2xl border border-indigo-400/30 text-xs font-medium animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        user={user}
        onLogout={handleLogout}
        slackStatus={slackStatus}
        onOpenSlack={() => setIsSlackOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCompose={() => setIsComposeOpen(true)}
        queueStats={queueStats}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        scheduledCount={scheduledEmails.length}
        sentCount={sentEmails.length}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick Metric Stat Highlights */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Scheduled In Queue</span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {scheduledEmails.length}
            </div>
            <div className="text-[11px] text-indigo-400/80 mt-1">
              BullMQ delayed jobs
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Sent History</span>
              <Send className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {sentEmails.length}
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-1">
              Ethereal fake SMTP
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Worker Concurrency</span>
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {queueStats?.concurrency || 5} Workers
            </div>
            <div className="text-[11px] text-purple-400/80 mt-1">
              Min delay: {queueStats?.minDelayMs ? `${queueStats.minDelayMs / 1000}s` : '2s'}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Hourly Rate Limit</span>
              <Gauge className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {queueStats?.maxEmailsPerHour || 10} / hr
            </div>
            <div className="text-[11px] text-amber-400/80 mt-1">
              {slackStatus?.connected ? 'Slack alerts active' : 'Connect Slack for alerts'}
            </div>
          </div>
        </div>

        {/* Tab View Container */}
        {activeTab === 'scheduled' && (
          <ScheduledTable
            emails={scheduledEmails}
            loading={loadingScheduled}
            onRefresh={fetchScheduled}
            onCancel={handleCancelEmail}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        )}

        {activeTab === 'sent' && (
          <SentTable
            emails={sentEmails}
            loading={loadingSent}
            onRefresh={fetchSent}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        )}

        {activeTab === 'queue' && (
          <QueueMonitor stats={queueStats} onRefreshStats={fetchQueueStats} />
        )}

        {activeTab === 'search' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">Elasticsearch Full-Text Search</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Search through all scheduled and sent outreach emails across subject, body, recipients, and senders with BM25 term weighting and highlights.
            </p>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition"
            >
              Open Search Console
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>ReachInbox.ai Production Email Scheduler • Outbox Labs</span>
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>BullMQ + Redis 7</span>
            </span>
            <span>•</span>
            <span>PostgreSQL 16 Storage</span>
            <span>•</span>
            <span>Ethereal SMTP</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal isOpen={!user} onLoginSuccess={handleLoginSuccess} />

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onScheduledSuccess={() => {
          showToast('Emails scheduled successfully in BullMQ queue!');
          refreshAllData();
          setActiveTab('scheduled');
        }}
      />

      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        status={slackStatus}
        onStatusUpdated={fetchSlackStatus}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => {
          showToast('Queue settings updated!');
          fetchQueueStats();
        }}
      />

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
