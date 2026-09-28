# ReachInbox Email Job Scheduler Service & Dashboard 🚀

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Distributed_Queue-FF4154?style=flat)](https://bullmq.io/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Persistence-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade, distributed email scheduling platform built for ReachInbox (Outbox Labs). Powered by **TypeScript**, **Express.js**, **BullMQ**, **Redis**, **PostgreSQL**, and **Ethereal fake SMTP**, featuring full search indexing, worker concurrency controls, atomic rate-limiting, live Slack alerts, and an interactive React + Tailwind dashboard.

---

## 📁 Repository Structure

```
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules for node_modules, dist, db data
├── docker-compose.yml      # Multi-container Docker deployment (App + Redis)
├── Dockerfile              # Multi-stage production container build
├── index.html              # Frontend entry point & metadata
├── package.json            # Scripts and dependencies
├── server.ts               # Standalone production server runner
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration with embedded dev API middleware
├── server/                 # Express backend, BullMQ scheduler & persistence
│   ├── api.ts              # REST API endpoints (/api/*)
│   ├── db.ts               # PostgreSQL database schema & persistence layer
│   ├── indexer.ts          # Elasticsearch-style BM25 full-text inverted index
│   ├── mail.ts             # Ethereal fake SMTP transport & link generation
│   ├── queue.ts            # BullMQ worker processor, pacing & crash recovery
│   ├── redis.ts            # Redis connection manager & atomic rate limiter
│   ├── slack.ts            # Slack incoming webhook alert dispatcher
│   └── vitePlugin.ts       # Vite Connect middleware wrapper for dev mode
└── src/                    # React frontend application
    ├── App.tsx             # Root dashboard view & tab router
    ├── main.tsx            # React DOM client entry point
    ├── index.css           # Tailwind CSS directives
    ├── types.ts            # Frontend shared TypeScript models
    ├── components/         # Dashboard UI components
    │   ├── ComposeModal.tsx      # Email composer & CSV lead importer
    │   ├── Header.tsx            # Header, user status & action buttons
    │   ├── MetricCards.tsx       # Real-time counter metrics
    │   ├── QueueMonitor.tsx      # Live BullMQ queue visualizer & controls
    │   ├── ScheduledList.tsx     # Pending email list with live countdowns
    │   ├── SearchModal.tsx       # Elasticsearch search console modal
    │   ├── SentList.tsx          # Delivered history with Ethereal preview links
    │   └── SettingsModal.tsx     # Concurrency, pacing & quota settings
    └── services/           # Frontend API client
        └── api.ts          # REST client wrapper for /api endpoints
```

---

## 🏗️ Architecture Overview

```
                                      ┌────────────────────────┐
                                      │   Google OAuth Auth    │
                                      └───────────┬────────────┘
                                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          ReachInbox React Dashboard (Frontend)                         │
│  - Compose & Lead CSV Upload (Parsing & Verification)                                  │
│  - Scheduled Emails Queue (Live Countdowns & Actions)                                  │
│  - Sent History (Live Ethereal Web Viewer Previews)                                    │
│  - Real-time BullMQ Monitor (Active / Delayed / Waiting / Completed / Failed)           │
│  - Elasticsearch Inverted Index Search Console                                         │
│  - Slack Rate-Limit Alert Configuration & Test Trigger                                 │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │ REST API (/api/*)
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Express.js Backend Service                                │
│                                                                                        │
│  1. Database Layer (PostgreSQL)                                                        │
│     - Persistent storage for emails, attempts, status, timestamps, and settings       │
│                                                                                        │
│  2. Persistent Distributed Queue (BullMQ + Redis 7)                                    │
│     - Delayed jobs (no cron jobs!)                                                     │
│     - Dynamic worker concurrency (default: 5 concurrent workers)                       │
│     - Provider throttling delay (default: 2s between sends)                            │
│     - Crash-resilient startup recovery (idempotent re-queuing)                         │
│                                                                                        │
│  3. Atomic Hourly Rate Limiter (Redis Counters)                                        │
│     - Keyed by `rate_limit:{sender}:{hourWindowTimestamp}`                             │
│     - Safe across multiple workers & cluster instances                                │
│     - Automatic next-hour window rescheduling with stagger jitter (no dropped jobs)   │
│                                                                                        │
│  4. Slack Integration                                                                  │
│     - Dispatches real-time Block Kit alerts when hourly quotas are exceeded           │
│                                                                                        │
│  5. Ethereal Fake SMTP Engine                                                          │
│     - Multi-sender outreach with live preview links (`ethereal.email/message/...`)     │
│                                                                                        │
│  6. Elasticsearch Search Indexer                                                       │
│     - BM25 inverted index tokenizing subject, body, sender, recipient, & tags          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features Implemented

### 🖥️ Backend Architecture
- **No Cron Jobs Policy**: 100% powered by **BullMQ delayed jobs** and Redis timers.
- **Relational PostgreSQL Storage**: Complete ACID-compliant relational persistence storing email records, status (`scheduled`, `sent`, `failed`, `rescheduled`), error logs, and delivery URLs.
- **Server Restart Resilience**:
  - Unsent and rescheduled emails are recovered from PostgreSQL at startup.
  - Idempotent BullMQ `jobId = email.id` ensures jobs are neither lost nor sent twice.
- **Worker Concurrency**: Configurable parallel worker threads (1-20 concurrency) processed safely under load.
- **Provider Throttling Pacing**: Configurable minimum delay (e.g. 2s) between individual sends to respect SMTP provider limits.
- **Atomic Hourly Rate Limiting**:
  - Redis atomic counters keyed by sender and hour window timestamp.
  - When the hourly threshold is reached, remaining jobs are **never dropped**; they are automatically rescheduled into the next hour window with jitter to avoid thundering herd.
- **Slack Alert Dispatch**: Live, verifiable Slack notification sent the instant a sender reaches their quota.
- **Ethereal Fake SMTP Delivery**: Emails sent from multiple customizable sender profiles with direct clickable web viewer links.
- **Elasticsearch Inverted Indexing**: Custom search index engine supporting multi-field tokenization, highlights (`<mark>`), and instant filtering.

### 🎨 Frontend Dashboard
- **Google OAuth Login**: Clean login with Google Identity Services and one-click demo profiles, avatar display, and logout.
- **Header**: User details, live Slack integration status pill, settings trigger, and primary **Compose Email** button.
- **Quick Metrics**: Real-time counter cards for Scheduled, Sent, Worker Concurrency, and Hourly Limits.
- **Scheduled Outreach View**:
  - Recipient, subject, sender, scheduled time with relative countdown (`in 30s`), status, and cancel action.
  - Loading skeletons & empty states.
- **Sent Outreach View**:
  - Sent time, delivery status, and direct button: **"Open in Ethereal"** to view the email in Ethereal's web viewer!
- **BullMQ Live Queue Monitor**:
  - Visual metrics for Active, Delayed, Waiting, Completed, and Failed jobs.
  - Live inspection stream, Pause/Resume queue controls, and Retry Failed Jobs button.
- **Compose Modal**:
  - Support for multiple preset or custom sender emails.
  - **CSV / Leads File Uploader**: Instant lead email extraction with parsed count badge (`12 leads detected`) and tag preview.
  - Subject and body with personalization tags (`{{name}}`, `{{company}}`).
  - Send Immediately or Schedule for specific future timestamp.
  - Sliders for delay between emails and sender hourly limits.
- **Elasticsearch Search Modal**: Live keyword search with match scoring and highlighted snippets.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (tested on v22)
- **Redis**: Running on `localhost:6379` (installed and managed automatically by the app daemon or via Docker)

---

### Quickstart (Local NPM)

#### 1. Clone & Install
```bash
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>
npm install
```

#### 2. Environment Setup
```bash
cp .env.example .env
```

#### 3. Run Development Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

#### 4. Run Production Build
```bash
npm run build
npm start
```

---

### Quickstart (Docker Compose) 🐳

Spin up both the Redis service and the application container in one command:
```bash
docker compose up --build
```
The dashboard will be available at **`http://localhost:3000`**.

---

### 📤 Uploading to GitHub

If you are publishing this project to your own GitHub profile, run:
```bash
# 1. Initialize git (if not already done)
git init -b main

# 2. Add files (node_modules and local secrets are excluded via .gitignore)
git add .

# 3. Commit your changes
git commit -m "feat: complete ReachInbox email job scheduler and dashboard"

# 4. Link your remote GitHub repository
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# 5. Push to GitHub
git push -u origin main
```

---

## 🧪 Testing the Core Requirements

### 1. Test Scheduling & Restart Persistence
1. Open the dashboard and click **"Compose Email"**.
2. Click **"Load 7 Sample Leads"** (or upload your own CSV).
3. Set start time to **Schedule Time** 3 minutes into the future.
4. Click **"Schedule 7 Emails"**.
5. Observe them queued in the **Scheduled** tab and **BullMQ Delayed** section.
6. Stop the server (`Ctrl+C`) and restart it (`npm run dev`).
7. **Notice**: The scheduler runs its recovery check, detects the scheduled emails in PostgreSQL, ensures they are queued in BullMQ, and delivers them at the exact scheduled time without duplicate sends!

### 2. Test Rate Limiting & Slack Notification
1. Open the **Slack** modal in the header and paste your Slack incoming webhook URL (e.g. from `api.slack.com/apps`).
2. Click **"Test Alert"** to verify your channel receives the message.
3. Open **Compose Email**, set the hourly limit to **2 emails/hour**, and schedule 5 emails.
4. Watch the first 2 emails send via Ethereal SMTP.
5. On the 3rd email, the BullMQ worker detects the rate limit has been reached:
   - Job is automatically rescheduled to the next hour window.
   - Status updates to `Rescheduled (Rate Limit)`.
   - **A live warning is immediately dispatched to your Slack channel!**

### 3. Test Ethereal Email Previews
1. Navigate to the **Sent** tab.
2. Click **"Open in Ethereal"** next to any delivered email.
3. Ethereal Email will open in a new tab rendering the HTML message, headers, subject, and sender!

---

## 🛠️ API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | System diagnostics (Redis, DB, SMTP, Worker) |
| `/api/emails/scheduled` | GET | List all pending scheduled emails |
| `/api/emails/sent` | GET | List all delivered emails with preview URLs |
| `/api/emails/schedule` | POST | Schedule single or batch lead campaign |
| `/api/emails/:id` | DELETE | Cancel a scheduled email |
| `/api/queue/stats` | GET | Real-time BullMQ job counts and settings |
| `/api/queue/jobs` | GET | Inspect active, delayed, waiting, and failed jobs |
| `/api/queue/pause` | POST | Pause queue execution |
| `/api/queue/resume` | POST | Resume queue execution |
| `/api/queue/retry-all` | POST | Retry all failed jobs |
| `/api/search?q=...` | GET | Elasticsearch full-text query with highlights |
| `/api/slack/status` | GET | Slack integration status |
| `/api/slack/connect` | POST | Connect Slack webhook |
| `/api/slack/test` | POST | Dispatch live Slack notification |
| `/api/settings` | GET/POST | Configure concurrency, delay, and hourly limits |

---

## 💡 Assumptions & Design Choices

1. **BullMQ + Redis 7**: Selected as the distributed job engine because it provides native delayed job timers (`opts.delay`), atomic locks, retries with exponential backoff, and eliminates brittle cron polling.
2. **PostgreSQL Relational DB**: Used for ACID persistence of campaign records. Runs with zero external dependency headaches while preserving full SQL table schemas, indices, and constraints.
3. **Atomic Redis Rate Limiting**: Implemented with Redis atomic `INCR` + `EXPIRE` over a 1-hour window key (`rate_limit:{sender}:{window}`). This guarantees thread safety across multiple concurrent workers.
4. **Slack Resilience**: If Slack is not connected or the webhook is temporarily unreachable, outreach jobs are never blocked. As soon as Slack is connected, alerts begin working immediately.

---

Built for the ReachInbox Software Development Intern Assignment.
