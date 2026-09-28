import React, { useState } from 'react';
import {
  Slack,
  X,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import type { SlackStatus } from '../types';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SlackStatus | null;
  onStatusUpdated: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusUpdated,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('#outreach-alerts');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim().startsWith('https://hooks.slack.com/')) {
      setMessage({
        text: 'Please enter a valid Slack webhook URL (must start with https://hooks.slack.com/)',
        type: 'error',
      });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      await api.connectSlack(webhookUrl.trim(), channelName.trim());
      setMessage({ text: 'Slack connected successfully! You can now send a test notification.', type: 'success' });
      onStatusUpdated();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to connect Slack', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setTesting(true);
      setMessage(null);
      const res = await api.testSlack();
      setMessage({ text: res.message || 'Test notification sent to your Slack channel!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to dispatch test notification to Slack', type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await api.disconnectSlack();
      setMessage({ text: 'Slack disconnected.', type: 'success' });
      onStatusUpdated();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
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
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Slack className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Slack Rate-Limit Notifications</h2>
              <p className="text-xs text-slate-400">Live webhook alerts when sender quotas are exceeded</p>
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
        <div className="p-6 space-y-5">
          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Current Status Box */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  status?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              ></div>
              <div>
                <span className="text-xs font-semibold text-white">
                  {status?.connected ? 'Slack Integration Connected' : 'Slack Not Connected'}
                </span>
                <p className="text-[11px] text-slate-400">
                  {status?.connected
                    ? `Webhook: ${status.webhookUrlMasked || 'Active'} • Channel: ${status.channelName || '#general'}`
                    : 'Connect a webhook below to receive real-time rate limit alerts.'}
                </p>
              </div>
            </div>

            {status?.connected && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={testing}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  <span>{testing ? 'Sending...' : 'Test Alert'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Disconnect Slack"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Connect Form */}
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Slack Incoming Webhook URL
              </label>
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/T000/B000/XXXXX"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                From your Slack workspace: <em>Apps → Incoming WebHooks → Add New Webhook to Workspace</em>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Channel Name
              </label>
              <input
                type="text"
                placeholder="#reachinbox-alerts"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center space-x-1.5 font-medium text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Non-blocking Fault-Tolerant Behavior</span>
              </div>
              <p>
                If Slack is not connected or fails, the scheduler continues uninterrupted. The moment you connect or reconnect, rate-limit alerts automatically trigger without restarting the server.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
              >
                Close
              </button>

              <button
                type="submit"
                disabled={loading || !webhookUrl}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
              >
                <Slack className="w-3.5 h-3.5" />
                <span>{status?.connected ? 'Update Webhook' : 'Connect Slack'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
