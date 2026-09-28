import React from 'react';
import {
  Clock,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Mail,
  Calendar,
  Send,
  User,
} from 'lucide-react';
import type { Email } from '../types';

interface ScheduledTableProps {
  emails: Email[];
  loading: boolean;
  onRefresh: () => void;
  onCancel: (id: string) => void;
  onOpenCompose: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onRefresh,
  onCancel,
  onOpenCompose,
}) => {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = Date.now();
      const diffMs = date.getTime() - now;

      let relative = '';
      if (diffMs > 0) {
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);

        if (diffSec < 60) relative = `(in ${diffSec}s)`;
        else if (diffMin < 60) relative = `(in ${diffMin}m)`;
        else relative = `(in ${diffHr}h)`;
      } else {
        relative = '(due now)';
      }

      return {
        formatted: date.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        relative,
      };
    } catch {
      return { formatted: isoString, relative: '' };
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Table Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/80">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white flex items-center space-x-2">
              <span>Scheduled Outreach Queue</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {emails.length} queued
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Pending execution via BullMQ delayed jobs with provider throttling
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition"
            title="Refresh queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={onOpenCompose}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <span>+ Schedule More</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && emails.length === 0 ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400">Loading scheduled jobs from PostgreSQL...</p>
        </div>
      ) : emails.length === 0 ? (
        <div className="p-16 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 shadow-inner">
            <Calendar className="w-7 h-7" />
          </div>
          <div className="max-w-sm mx-auto">
            <h3 className="text-sm font-semibold text-white mb-1">No scheduled emails in queue</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Upload leads via CSV or compose an email to schedule outreach using BullMQ and fake SMTP.
            </p>
            <button
              onClick={onOpenCompose}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition"
            >
              Compose New Email
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
                <th className="py-3.5 px-4">Scheduled For</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-200">
              {emails.map((email) => {
                const timeInfo = formatTime(email.scheduled_at);
                const isRescheduled = email.status === 'rescheduled';

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

                    {/* Scheduled Time */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-slate-200 font-mono text-xs">{timeInfo.formatted}</div>
                      <div className="text-[10px] text-indigo-400 font-semibold">
                        {timeInfo.relative}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isRescheduled ? (
                        <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-medium">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Rescheduled (Rate Limit)</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-medium">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>Queued in BullMQ</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => onCancel(email.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Cancel & Remove from Queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
