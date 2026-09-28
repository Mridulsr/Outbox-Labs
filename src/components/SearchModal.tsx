import React, { useState, useEffect } from 'react';
import { Search, X, Filter, Zap, Clock, Send, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { SearchHit } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'sent' | 'failed' | 'rescheduled'>('all');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [tookMs, setTookMs] = useState(0);
  const [stats, setStats] = useState<{ totalDocs: number; totalTerms: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const performSearch = async (q: string, status: string) => {
    try {
      setLoading(true);
      const res = await api.searchEmails(q, status);
      setHits(res.hits || []);
      setTotal(res.total || 0);
      setTookMs(res.tookMs || 0);
      setStats(res.indexStats || null);
    } catch (err: any) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      performSearch(query, statusFilter);
    }
  }, [isOpen, statusFilter]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    performSearch(val, statusFilter);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 pt-12 sm:pt-16">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Search Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white flex items-center space-x-2">
                  <span>Elasticsearch Email Search</span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    BM25 Inverted Index
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Full-text index over subjects, bodies, recipients, senders, and delivery tags
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Search by keywords, subject, recipient email, or content..."
              value={query}
              onChange={handleQueryChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  performSearch('', statusFilter);
                }}
                className="text-xs text-slate-400 hover:text-white absolute right-3 top-2.5 px-1.5 py-0.5 rounded hover:bg-slate-700"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Pills & Stats */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-400 flex items-center space-x-1 mr-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter:</span>
              </span>
              {(['all', 'scheduled', 'sent', 'rescheduled', 'failed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-lg capitalize font-medium transition ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-2">
              <span>{total} matches ({tookMs}ms)</span>
              {stats && (
                <span>• Index: {stats.totalDocs} docs, {stats.totalTerms} terms</span>
              )}
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-3">
          {loading ? (
            <div className="p-8 text-center space-y-2">
              <div className="w-6 h-6 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400">Querying Elasticsearch index...</p>
            </div>
          ) : hits.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No matching emails found in index. Try a different query.
            </div>
          ) : (
            hits.map((hit) => {
              const email = hit.email;
              return (
                <div
                  key={hit.id}
                  className="p-4 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/60 rounded-xl transition space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs text-white font-medium">
                        {hit.highlights.recipient ? (
                          <span
                            dangerouslySetInnerHTML={{ __html: hit.highlights.recipient }}
                            className="[&>mark]:bg-amber-400/20 [&>mark]:text-amber-300 [&>mark]:px-0.5 rounded"
                          />
                        ) : (
                          email.recipient
                        )}
                      </span>
                      <span className="text-[10px] text-slate-500">via</span>
                      <span className="text-xs text-slate-400">{email.sender}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-indigo-400">
                        Score: {hit.score.toFixed(1)}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                          email.status === 'sent'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : email.status === 'rescheduled'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {email.status}
                      </span>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="text-sm font-semibold text-slate-200">
                    {hit.highlights.subject ? (
                      <span
                        dangerouslySetInnerHTML={{ __html: hit.highlights.subject }}
                        className="[&>mark]:bg-amber-400/20 [&>mark]:text-amber-300 [&>mark]:px-0.5 rounded"
                      />
                    ) : (
                      email.subject
                    )}
                  </div>

                  {/* Body Snippet */}
                  <div className="text-xs text-slate-400 leading-relaxed font-sans line-clamp-2">
                    {hit.highlights.body ? (
                      <span
                        dangerouslySetInnerHTML={{ __html: hit.highlights.body }}
                        className="[&>mark]:bg-amber-400/20 [&>mark]:text-amber-300 [&>mark]:px-0.5 rounded"
                      />
                    ) : (
                      email.body
                    )}
                  </div>

                  {/* Footer Meta */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-700/40">
                    <span>Scheduled: {new Date(email.scheduled_at).toLocaleString()}</span>
                    {email.sent_at && <span>Sent: {new Date(email.sent_at).toLocaleString()}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
