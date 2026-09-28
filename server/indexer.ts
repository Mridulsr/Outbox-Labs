import type { EmailRecord } from './db.js';

export interface SearchQueryOptions {
  query?: string;
  status?: string;
  sender?: string;
  limit?: number;
  offset?: number;
}

export interface SearchHit {
  id: string;
  score: number;
  email: EmailRecord;
  highlights: {
    subject?: string;
    body?: string;
    recipient?: string;
    sender?: string;
  };
}

export interface SearchResult {
  total: number;
  hits: SearchHit[];
  tookMs: number;
  indexStats: {
    totalDocs: number;
    totalTerms: number;
  };
}

class ElasticsearchIndexer {
  private docs: Map<string, EmailRecord> = new Map();
  // Field-specific inverted indices: field -> term -> Set<docId>
  private invertedIndex: Map<string, Map<string, Set<string>>> = new Map();

  constructor() {
    this.invertedIndex.set('all', new Map());
    this.invertedIndex.set('subject', new Map());
    this.invertedIndex.set('body', new Map());
    this.invertedIndex.set('recipient', new Map());
    this.invertedIndex.set('sender', new Map());
    this.invertedIndex.set('status', new Map());
  }

  private tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w@.-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  public indexEmail(email: EmailRecord): void {
    // If existing, clear previous terms
    if (this.docs.has(email.id)) {
      this.deleteEmail(email.id);
    }

    this.docs.set(email.id, email);

    const fields: Record<string, string> = {
      subject: email.subject,
      body: email.body,
      recipient: email.recipient,
      sender: email.sender,
      status: email.status,
    };

    for (const [field, text] of Object.entries(fields)) {
      const tokens = this.tokenize(text);
      const fieldMap = this.invertedIndex.get(field)!;
      const allMap = this.invertedIndex.get('all')!;

      for (const token of tokens) {
        if (!fieldMap.has(token)) fieldMap.set(token, new Set());
        fieldMap.get(token)!.add(email.id);

        if (!allMap.has(token)) allMap.set(token, new Set());
        allMap.get(token)!.add(email.id);
      }
    }
  }

  public deleteEmail(id: string): void {
    this.docs.delete(id);
    for (const fieldMap of this.invertedIndex.values()) {
      for (const set of fieldMap.values()) {
        set.delete(id);
      }
    }
  }

  public reindexAll(emails: EmailRecord[]): void {
    this.docs.clear();
    for (const fieldMap of this.invertedIndex.values()) {
      fieldMap.clear();
    }
    for (const email of emails) {
      this.indexEmail(email);
    }
    console.log(`[ElasticsearchIndexer] Indexed ${emails.length} emails. Total terms: ${this.invertedIndex.get('all')!.size}`);
  }

  public search(options: SearchQueryOptions): SearchResult {
    const startTime = performance.now();
    const query = options.query?.trim() || '';
    const statusFilter = options.status?.trim().toLowerCase();
    const senderFilter = options.sender?.trim().toLowerCase();
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const queryTokens = this.tokenize(query);
    const scoreMap: Map<string, number> = new Map();

    const subjectMap = this.invertedIndex.get('subject')!;
    const recipientMap = this.invertedIndex.get('recipient')!;
    const senderMap = this.invertedIndex.get('sender')!;
    const bodyMap = this.invertedIndex.get('body')!;
    const allMap = this.invertedIndex.get('all')!;

    if (queryTokens.length === 0) {
      // Return all matching filters
      for (const [id] of this.docs) {
        scoreMap.set(id, 1.0);
      }
    } else {
      for (const token of queryTokens) {
        // Multi-field term and prefix matching with BM25-like weights
        const matchedDocIds = new Set<string>();

        // Exact match
        if (allMap.has(token)) {
          for (const docId of allMap.get(token)!) {
            matchedDocIds.add(docId);
          }
        }

        // Prefix match (like wildcard / autocomplete)
        for (const [t, set] of allMap.entries()) {
          if (t.startsWith(token) || t.includes(token)) {
            for (const docId of set) {
              matchedDocIds.add(docId);
            }
          }
        }

        for (const docId of matchedDocIds) {
          let score = scoreMap.get(docId) || 0;
          // Apply field weights
          if (subjectMap.has(token) && subjectMap.get(token)!.has(docId)) score += 3.0;
          if (recipientMap.has(token) && recipientMap.get(token)!.has(docId)) score += 2.5;
          if (senderMap.has(token) && senderMap.get(token)!.has(docId)) score += 2.0;
          if (bodyMap.has(token) && bodyMap.get(token)!.has(docId)) score += 1.0;

          // Default minimum boost
          score += 1.0;
          scoreMap.set(docId, score);
        }
      }
    }

    // Filter by status & sender
    const hits: SearchHit[] = [];
    for (const [docId, score] of scoreMap.entries()) {
      const doc = this.docs.get(docId);
      if (!doc) continue;

      if (statusFilter && statusFilter !== 'all' && doc.status.toLowerCase() !== statusFilter) {
        continue;
      }
      if (senderFilter && !doc.sender.toLowerCase().includes(senderFilter)) {
        continue;
      }

      // Generate highlights for matched tokens
      const highlights: SearchHit['highlights'] = {};
      if (queryTokens.length > 0) {
        highlights.subject = this.highlightText(doc.subject, queryTokens);
        highlights.body = this.highlightSnippet(doc.body, queryTokens);
        highlights.recipient = this.highlightText(doc.recipient, queryTokens);
        highlights.sender = this.highlightText(doc.sender, queryTokens);
      }

      hits.push({
        id: docId,
        score,
        email: doc,
        highlights,
      });
    }

    // Sort by score descending, then scheduled_at descending
    hits.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.email.scheduled_at).getTime() - new Date(a.email.scheduled_at).getTime();
    });

    const paginated = hits.slice(offset, offset + limit);
    const tookMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      total: hits.length,
      hits: paginated,
      tookMs,
      indexStats: {
        totalDocs: this.docs.size,
        totalTerms: this.invertedIndex.get('all')!.size,
      },
    };
  }

  private highlightText(text: string, tokens: string[]): string {
    if (!text) return text;
    let res = text;
    for (const t of tokens) {
      if (t.length < 2) continue;
      const regex = new RegExp(`(${t})`, 'gi');
      res = res.replace(regex, '<mark>$1</mark>');
    }
    return res;
  }

  private highlightSnippet(body: string, tokens: string[]): string {
    if (!body) return '';
    const lower = body.toLowerCase();
    let bestPos = -1;
    for (const t of tokens) {
      const idx = lower.indexOf(t);
      if (idx !== -1) {
        bestPos = idx;
        break;
      }
    }

    if (bestPos === -1) {
      return body.slice(0, 120) + (body.length > 120 ? '...' : '');
    }

    const start = Math.max(0, bestPos - 40);
    const end = Math.min(body.length, bestPos + 80);
    const snippet = (start > 0 ? '...' : '') + body.slice(start, end) + (end < body.length ? '...' : '');
    return this.highlightText(snippet, tokens);
  }

  public getStats() {
    return {
      totalDocs: this.docs.size,
      totalTerms: this.invertedIndex.get('all')!.size,
      fields: ['subject', 'body', 'recipient', 'sender', 'status'],
    };
  }
}

export const emailIndexer = new ElasticsearchIndexer();
