import React from 'react';
import {
  Send,
  ExternalLink,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  User,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import type { Email } from '../types';

interface SentTableProps {
  emails: Email[];
  loading: boolean;
  onRefresh: () => void;
  onOpenCompose: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  loading,
  onRefresh,
  onOpenCompose,
}) => {
  const formatSentTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Table Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/80">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white flex items-center space-x-2">
              <span>Sent Emails Log</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {emails.length} processed
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Delivered via Ethereal fake SMTP with live message preview links
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition"
          title="Refresh sent list"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Content */}
      {loading && emails.length === 0 ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400">Loading sent history...</p>
        </div>
      ) : emails.length === 0 ? (
        <div className="p-16 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 shadow-inner">
            <Inbox className="w-7 h-7" />
          </div>
          <div className="max-w-sm mx-auto">
            <h3 className="text-sm font-semibold text-white mb-1">No sent emails yet</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              When BullMQ workers execute jobs, dispatched emails and their Ethereal test inbox links appear here.
            </p>
            <button
              onClick={onOpenCompose}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition"
            >
              Send First Outreach
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Recipient</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Sender</th>
                <th className="py-3.5 px-4">Sent Time</th>
                <th className="py-3.5 px-4">Delivery Status</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Ethereal Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-200">
              {emails.map((email) => {
                const isSent = email.status === 'sent';

                return (
                  <tr key={email.id} className="hover:bg-slate-800/40 transition">
                    {/* Recipient */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-medium text-white flex items-center space-x-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-xs">{email.recipient}</span>
                      </div>
                    </td>

                    {/* Subject */}
                    <td className="py-3.5 px-4 max-w-xs truncate">
                      <span className="text-slate-300 font-medium">{email.subject}</span>
                      <p className="text-[11px] text-slate-500 truncate">{email.body}</p>
                    </td>

                    {/* Sender */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-slate-400">
                        <User className="w-3 h-3 text-slate-500" />
                        <span className="text-xs truncate max-w-[140px]">{email.sender}</span>
                      </div>
                    </td>

                    {/* Sent Time */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                      {formatSentTime(email.sent_at)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isSent ? (
                        <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Sent via SMTP</span>
                        </div>
                      ) : (
                        <div
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-medium"
                          title={email.error_message || 'Delivery failed'}
                        >
                          <XCircle className="w-3 h-3 shrink-0" />
                          <span>Failed</span>
                        </div>
                      )}
                    </td>

                    {/* Ethereal Email Web Link */}
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      {email.ethereal_url ? (
                        <a
                          href={email.ethereal_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-medium transition"
                        >
                          <span>Open in Ethereal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">No URL available</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
