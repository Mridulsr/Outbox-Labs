import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Gauge,
  Clock,
  Sliders,
  CheckCircle2,
  ExternalLink,
  Mail,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [concurrency, setConcurrency] = useState(5);
  const [minDelayMs, setMinDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [mailAccount, setMailAccount] = useState<{
    user: string;
    pass: string;
    webUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getSettings().then((res) => {
        setConcurrency(res.settings.workerConcurrency);
        setMinDelayMs(res.settings.minDelayBetweenEmailsMs);
        setHourlyLimit(res.settings.maxEmailsPerHourPerSender);
      });
      api.getMailAccount().then((res) => {
        setMailAccount(res.credentials);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      await api.updateSettings({
        workerConcurrency: concurrency,
        minDelayBetweenEmailsMs: minDelayMs,
        maxEmailsPerHourPerSender: hourlyLimit,
      });
      setSuccess(true);
      onSaved();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Queue & Rate-Limit Settings</h2>
              <p className="text-xs text-slate-400">Configure BullMQ concurrency, provider delay & quotas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Settings updated successfully! Worker concurrency updated dynamically.</span>
            </div>
          )}

          {/* Worker Concurrency */}
          <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span>BullMQ Worker Concurrency</span>
              </label>
              <span className="text-xs font-mono font-bold text-indigo-400">
                {concurrency} parallel jobs
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">
              Controls how many email sending jobs the BullMQ worker processes simultaneously.
            </p>
          </div>

          {/* Min Delay Between Emails */}
          <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Minimum Delay Between Individual Sends</span>
              </label>
              <span className="text-xs font-mono font-bold text-indigo-400">
                {(minDelayMs / 1000).toFixed(1)} seconds
              </span>
            </div>
            <input
              type="range"
              min="500"
              max="10000"
              step="500"
              value={minDelayMs}
              onChange={(e) => setMinDelayMs(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">
              Enforces provider throttling pacing so individual email dispatches are staggered.
            </p>
          </div>

          {/* Max Emails Per Hour Per Sender */}
          <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-indigo-400" />
                <span>Hourly Rate Limit per Sender</span>
              </label>
              <span className="text-xs font-mono font-bold text-indigo-400">
                {hourlyLimit} emails/hour
              </span>
            </div>
            <input
              type="number"
              min="1"
              max="1000"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-400">
              Backed by Redis atomic counters. If exceeded, remaining jobs are delayed to next hour + triggers Slack notification.
            </p>
          </div>

          {/* Ethereal Fake SMTP Details */}
          {mailAccount && (
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  <span>Ethereal Email Fake SMTP Engine</span>
                </div>
                {mailAccount.webUrl && (
                  <a
                    href={mailAccount.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                  >
                    <span>Web Viewer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 truncate">
                  <span className="text-slate-500 block text-[10px]">User:</span>
                  <span className="text-slate-300">{mailAccount.user}</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 truncate">
                  <span className="text-slate-500 block text-[10px]">Host:</span>
                  <span className="text-slate-300">smtp.ethereal.email:587</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
