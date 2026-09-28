import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Calendar,
  Clock,
  Gauge,
  Send,
  Sparkles,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduledSuccess: () => void;
}

const PRESET_SENDERS = [
  'outreach@reachinbox.ai',
  'sales@reachinbox.test',
  'growth@outboxlabs.com',
  'campaigns@reachinbox.io',
];

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onScheduledSuccess,
}) => {
  const [sender, setSender] = useState(PRESET_SENDERS[0]);
  const [customSender, setCustomSender] = useState('');
  const [useCustomSender, setUseCustomSender] = useState(false);

  const [recipientsInput, setRecipientsInput] = useState('');
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [subject, setSubject] = useState('Transform your outbound pipeline with ReachInbox AI');
  const [body, setBody] = useState(
    `Hi {{name}},\n\nI noticed your team has been scaling outreach efforts recently. ReachInbox helps teams automate prospecting, verify high-intent leads, and schedule personalized multi-stage sequences effortlessly.\n\nWould you be open to a brief 10-minute walk-through this week?\n\nBest regards,\nReachInbox Team`
  );

  const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2); // seconds
  const [hourlyLimit, setHourlyLimit] = useState(5); // emails/hour

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Extract all emails from text/CSV
  const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    // Deduplicate
    const unique = Array.from(new Set(matches.map((e) => e.toLowerCase())));
    return unique;
  };

  const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRecipientsInput(val);
    const extracted = extractEmails(val);
    setParsedEmails(extracted);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const extracted = extractEmails(content);
      setParsedEmails(extracted);
      setRecipientsInput(extracted.join('\n'));
    };
    reader.readAsText(file);
  };

  const loadSampleLeads = () => {
    const sample = [
      'alex.turner@techcorp.com',
      'sarah.connor@cyberdyne.io',
      'michael.scott@dundermifflin.paper',
      'elena.rostova@globalfin.net',
      'david.kim@innovate.co',
      'rachel.green@ralphlauren.design',
      'bruce.wayne@wayneenterprises.org',
    ];
    setRecipientsInput(sample.join('\n'));
    setParsedEmails(sample);
    setUploadedFileName('sample_lead_list.csv');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const effectiveSender = useCustomSender ? customSender.trim() : sender;
    if (!effectiveSender || !effectiveSender.includes('@')) {
      setError('Please provide a valid sender email address.');
      return;
    }

    if (parsedEmails.length === 0) {
      setError('Please provide or upload at least one valid recipient email address.');
      return;
    }

    if (!subject.trim()) {
      setError('Email subject cannot be empty.');
      return;
    }

    if (!body.trim()) {
      setError('Email body cannot be empty.');
      return;
    }

    let startTimeISO: string | undefined = undefined;
    if (scheduleType === 'scheduled') {
      if (!scheduledDateTime) {
        setError('Please pick a scheduled start date & time.');
        return;
      }
      const selected = new Date(scheduledDateTime);
      if (isNaN(selected.getTime())) {
        setError('Invalid scheduled date/time selected.');
        return;
      }
      startTimeISO = selected.toISOString();
    }

    setLoading(true);
    try {
      await api.scheduleEmails({
        sender: effectiveSender,
        recipients: parsedEmails,
        subject,
        body,
        startTime: startTimeISO,
        delayBetweenEmailsMs: delayBetweenEmails * 1000,
        hourlyLimit,
      });

      onScheduledSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Compose & Schedule Outreach</h2>
              <p className="text-xs text-slate-400">BullMQ distributed queue & Ethereal SMTP delivery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Account */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              From (Sender Account)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {!useCustomSender ? (
                <select
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {PRESET_SENDERS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="email"
                  placeholder="custom.sender@yourdomain.com"
                  value={customSender}
                  onChange={(e) => setCustomSender(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              )}

              <button
                type="button"
                onClick={() => setUseCustomSender(!useCustomSender)}
                className="text-xs text-indigo-400 hover:text-indigo-300 py-2 px-3 border border-dashed border-slate-700 rounded-xl hover:border-indigo-500/50 transition text-left"
              >
                {useCustomSender ? '← Pick from preset sender accounts' : '+ Use custom sender email'}
              </button>
            </div>
          </div>

          {/* Lead Recipients & File Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Recipients (Upload Leads CSV or Paste)
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={loadSampleLeads}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
                >
                  Load 7 Sample Leads
                </button>
              </div>
            </div>

            {/* Upload Area */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center space-x-2 p-3 border border-dashed border-slate-700 hover:border-indigo-500 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-xs text-slate-300 transition group"
              >
                <Upload className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition" />
                <span>Upload CSV / Leads file</span>
              </button>

              <div className="sm:col-span-2 flex items-center justify-between px-3 py-2 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs">
                <div className="flex items-center space-x-2 truncate">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-300 truncate">
                    {uploadedFileName || 'No file chosen (or paste text below)'}
                  </span>
                </div>
                {parsedEmails.length > 0 && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{parsedEmails.length} lead{parsedEmails.length === 1 ? '' : 's'} detected</span>
                  </span>
                )}
              </div>
            </div>

            {/* Raw Input Box */}
            <textarea
              rows={3}
              placeholder="Paste email addresses separated by commas, tabs, or new lines..."
              value={recipientsInput}
              onChange={handleTextInputChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />

            {/* Email Pills Preview */}
            {parsedEmails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-950/40 rounded-xl border border-slate-800">
                {parsedEmails.slice(0, 8).map((email, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] border border-slate-700"
                  >
                    {email}
                  </span>
                ))}
                {parsedEmails.length > 8 && (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold">
                    +{parsedEmails.length - 8} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              placeholder="Outreach subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Email Content
              </label>
              <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Supports {'{{name}}'}, {'{{company}}'} variables</span>
              </span>
            </div>
            <textarea
              rows={5}
              placeholder="Write your email body..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
            />
          </div>

          {/* Scheduling & Rate Limiting Controls */}
          <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-4">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Timing & Provider Throttling Safeguards</span>
            </h3>

            {/* Start Time Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] text-slate-400 mb-1">Execution Mode</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleType('now')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                      scheduleType === 'now'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    Send Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('scheduled')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                      scheduleType === 'scheduled'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    Schedule Time
                  </button>
                </div>
              </div>

              {/* DateTime Picker */}
              <div>
                <span className="block text-[11px] text-slate-400 mb-1">
                  {scheduleType === 'scheduled' ? 'Scheduled Start Time' : 'Start Timestamp'}
                </span>
                <div className="relative">
                  <input
                    type="datetime-local"
                    disabled={scheduleType === 'now'}
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="w-full bg-slate-800 disabled:opacity-50 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Provider Delay & Hourly Limit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
              {/* Delay between emails */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Delay Between Emails</span>
                  <span className="text-indigo-400 font-semibold">{delayBetweenEmails} sec</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={delayBetweenEmails}
                  onChange={(e) => setDelayBetweenEmails(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Mimics provider throttling spacing between individual sends.
                </p>
              </div>

              {/* Hourly limit */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Hourly Limit per Sender</span>
                  <span className="text-indigo-400 font-semibold">{hourlyLimit} emails/hr</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Jobs over quota are rescheduled into next hour + triggers Slack alert.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Footer */}
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
              disabled={loading || parsedEmails.length === 0}
              className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Scheduling via BullMQ...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Schedule {parsedEmails.length > 0 ? `${parsedEmails.length} Email(s)` : 'Emails'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
