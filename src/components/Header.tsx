import React from 'react';
import {
  Mail,
  Send,
  LogOut,
  Slack,
  Activity,
  Settings,
  Search,
  Plus,
} from 'lucide-react';
import type { UserProfile, SlackStatus, QueueStats } from '../types';

interface HeaderProps {
  user: UserProfile | null;
  onLogout: () => void;
  slackStatus: SlackStatus | null;
  onOpenSlack: () => void;
  onOpenSettings: () => void;
  onOpenCompose: () => void;
  queueStats: QueueStats | null;
  activeTab: 'scheduled' | 'sent' | 'queue' | 'search';
  setActiveTab: (tab: 'scheduled' | 'sent' | 'queue' | 'search') => void;
  scheduledCount: number;
  sentCount: number;
  onSearchClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  slackStatus,
  onOpenSlack,
  onOpenSettings,
  onOpenCompose,
  queueStats,
  activeTab,
  setActiveTab,
  scheduledCount,
  sentCount,
  onSearchClick,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  ReachInbox
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Scheduler
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Distributed BullMQ & Fake SMTP Engine
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <div className="hidden md:flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'scheduled'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Scheduled</span>
              {scheduledCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-950 text-indigo-200 border border-indigo-400/40">
                  {scheduledCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'sent'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Sent</span>
              {sentCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-950 text-indigo-200 border border-indigo-400/40">
                  {sentCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'queue'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>BullMQ Live</span>
              {queueStats && queueStats.counts.delayed + queueStats.counts.active > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'search'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
          </div>

          {/* Right Action Tools & User Profile */}
          <div className="flex items-center space-x-3">
            {/* Quick Search Button */}
            <button
              onClick={onSearchClick}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-800 transition"
              title="Search emails (Elasticsearch)"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Slack Connection Pill */}
            <button
              onClick={onOpenSlack}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                slackStatus?.connected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
              title={
                slackStatus?.connected
                  ? `Slack Connected (${slackStatus.channelName || '#general'})`
                  : 'Connect Slack for Rate-Limit Alerts'
              }
            >
              <Slack className="w-3.5 h-3.5 text-current" />
              <span className="hidden sm:inline">
                {slackStatus?.connected ? 'Slack Active' : 'Connect Slack'}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  slackStatus?.connected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              ></span>
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-800 transition"
              title="Queue & Rate Limit Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Primary Compose Button */}
            <button
              onClick={onOpenCompose}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium shadow-md shadow-indigo-600/25 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Compose Email</span>
            </button>

            {/* User Profile & Logout */}
            {user && (
              <div className="flex items-center pl-2 border-l border-slate-800 space-x-2">
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-indigo-400/30 object-cover"
                />
                <div className="hidden xl:block text-left text-xs leading-tight">
                  <div className="font-medium text-slate-200 truncate max-w-[120px]">{user.name}</div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{user.email}</div>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-t border-slate-800 px-2 py-1.5 justify-around bg-slate-900/90 text-xs">
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-3 py-1 rounded-md font-medium ${
            activeTab === 'scheduled' ? 'text-indigo-400 bg-slate-800' : 'text-slate-400'
          }`}
        >
          Scheduled ({scheduledCount})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`px-3 py-1 rounded-md font-medium ${
            activeTab === 'sent' ? 'text-indigo-400 bg-slate-800' : 'text-slate-400'
          }`}
        >
          Sent ({sentCount})
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-3 py-1 rounded-md font-medium ${
            activeTab === 'queue' ? 'text-indigo-400 bg-slate-800' : 'text-slate-400'
          }`}
        >
          BullMQ
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`px-3 py-1 rounded-md font-medium ${
            activeTab === 'search' ? 'text-indigo-400 bg-slate-800' : 'text-slate-400'
          }`}
        >
          Search
        </button>
      </div>
    </header>
  );
};
