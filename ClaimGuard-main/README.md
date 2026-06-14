<p align="center">
  <img src="public/favicon.svg" width="80" alt="ClaimGuard AI" />
</p>

<h1 align="center">ClaimGuard AI</h1>
<p align="center"><strong>Enterprise Claims Orchestration & Fraud Risk Scoring Platform</strong></p>

<p align="center">
  <a href="https://claimguardai.netlify.app/">🌐 Live Demo</a> &nbsp;·&nbsp;
  <em>Built with React · TypeScript · Tailwind CSS · Mini Supabase</em>
</p>

---

## ✨ Overview

ClaimGuard AI is a real-time, intelligent insurance claims management platform that automates the entire lifecycle — from **First Notice of Loss (FNOL)** to **fraud investigation** — using AI-powered risk scoring, voice-to-form automation, and an enterprise-grade notification pipeline.

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                    │
│  Dashboard · Claims · Analytics · SLA · Chat Bot    │
├──────────────┬──────────────┬───────────────────────┤
│  Gemini 3    │  ElevenLabs  │   Realtime Engine     │
│   Flash      │  Speech-to-  │   (WebSocket)         │
│  Gateway     │  Text API    │                       │
├──────────────┴──────────────┴───────────────────────┤
│               Supabase (Backend)                    │
│  Edge Functions · Auth · Database · Storage         │
└─────────────────────────────────────────────────────┘
```

---

## 🔬 Fraud Analytics & Risk Scoring Model

### Model Type — Rule-Based Weighted Scoring (Guidewire-Aligned)

ClaimGuard uses a **deterministic, multi-factor weighted scoring algorithm** inspired by Guidewire ClaimCenter patterns. Each claim is evaluated against **six risk factors**, producing a score from **0–100**.

### Scoring Factors

| # | Factor | Weight | Logic |
|---|--------|--------|-------|
| 1 | **Claim Amount** | 8–40 pts | Tiered brackets: >$500K → 40 pts, >$100K → 35 pts, >$75K → 30 pts, >$50K → 25 pts, >$25K → 15 pts, >$10K → 8 pts |
| 2 | **Incident Timing** | 15–20 pts | Same-day filing → 15 pts (unusual urgency). Delayed >30 days → 20 pts (possible fabrication) |
| 3 | **Claim Type Profile** | 8–18 pts | Liability → 18, Workers Comp → 15, Property → 12, Auto → 10, Health → 8 |
| 4 | **Location Risk** | 12 pts | Geo-keyword matching: "downtown", "highway", "interstate", "parking lot", "mall" |
| 5 | **Description Keywords** | 8–20 pts | Flags: "total loss", "stolen", "fire", "flood", "vandalism", "hit and run" (8 pts each, max 20) |
| 6 | **Contact Completeness** | 10 pts | Missing email or phone reduces verification ability |

### Risk Categories & Auto-Routing

| Score | Category | Routed To | Auto-Status |
|-------|----------|-----------|-------------|
| 0–34 | 🟢 Low | Auto-Processing | `auto_approved` |
| 35–59 | 🟡 Medium | Adjuster Review Team | `under_review` |
| 60–100 | 🔴 High | Special Investigation Unit (SIU) | `siu_investigation` |

> **Why rule-based?** In regulated insurance environments, deterministic scoring provides full **auditability** and **explainability** — every point in the score can be traced to a specific factor, which is critical for compliance and SIU investigations.

---

## 🎙️ Voice Claim Entry (FNOL)

### Pipeline

```
Microphone → MediaRecorder API → Audio Blob
    ↓
ElevenLabs Scribe v2 (server-side STT)
    ↓
Raw Transcript
    ↓
Gemini 3 Flash Gateway 
    ↓
Structured JSON → Auto-fills FNOL Form
```

### How It Works

1. **Audio Capture** — Browser's `MediaRecorder` API records the claimant's spoken description in WebM/MP4 format.
2. **Speech-to-Text** — The audio blob is sent to an Edge Function (`elevenlabs-transcribe`) that calls **ElevenLabs Scribe v2** for high-accuracy server-grade transcription with speaker diarization.
3. **AI Extraction** — The transcript is forwarded to a second Edge Function (`parse-voice-claim`) powered by **Google Gemini 3 Flash Preview** Gateway. A specialized system prompt extracts structured fields:
   - `claim_type` (inferred from context: "car crash" → `auto`)
   - `incident_date` (relative dates resolved: "yesterday" → `YYYY-MM-DD`)
   - `claim_amount` (natural language → numeric: "five thousand" → `5000`)
   - `incident_location`, `description`, `claimant_name`, `claimant_email`, `claimant_phone`, `policy_number`
4. **Form Auto-Fill** — Extracted JSON fields are mapped directly into the React Hook Form state, pre-populating the FNOL form for the user to review and submit.

---

## 🤖 ClaimGuard AI Chat Assistant

### Model & Architecture

| Component | Technology |
|-----------|------------|
| **LLM** | Google Gemini 3 Flash Gateway |
| **Knowledge Base** | RAG with pgvector embeddings on uploaded policy documents |
| **Streaming** | Server-Sent Events (SSE) for real-time token-by-token rendering |
| **History** | Cloud-synced per-user conversation persistence |

### Capabilities

- Explains risk scores with factor-level breakdown
- Guides users through claim filing, documentation requirements, and next steps
- Answers policy-specific questions using RAG over uploaded insurance documents
- Platform navigation assistance and feature explanations
- Never provides legal or medical advice — defers to professionals

---

## 🔔 Notification & Email System

### Multi-Channel Pipeline

```
Claim Event (create / update / bulk action)
    ↓
Database Trigger → In-App Notification (notifications table)
    ↓
Edge Functions → Email Notifications
    ├── High-Risk Alert     → SIU team immediate email
    ├── Reassignment Notice → New assignee notification
    ├── Bulk Action Summary → Digest of batch operations
    └── Scheduled Digest    → Configurable daily/weekly rollups
```

### Features

- **Per-user preference control** — Toggle each notification type (high-risk alerts, reassignment, bulk actions, digests)
- **Role-based defaults** — Admin, Adjuster, SIU Analyst each have sensible default preferences
- **Email SLA monitoring** — Tracks delivery success rates, first-attempt rates, and failure counts with weekly snapshots
- **SLA Dashboard** — Visual KPI cards, trend charts, drill-down metrics, and configurable alert thresholds
- **Slack escalation** — Automated alerts to a configurable Slack channel when SLA degrades over consecutive weeks

---

## 📊 Key Features

| Feature | Description |
|---------|-------------|
| **Real-Time Dashboard** | Live metrics: total claims, pending, approved, high-risk, exposure amount, avg risk score |
| **Claims CRUD** | Full create/read/update lifecycle with status transitions and audit trail |
| **Document Management** | Upload PDFs, images, spreadsheets as claim evidence with secure cloud storage |
| **Analytics Suite** | Risk distribution charts, claim type breakdowns, workflow metrics, scoring accuracy |
| **Activity Log** | Filterable event timeline with trend charts and weekly stats |
| **Bulk Operations** | Multi-select claims for batch approve, reject, reassign, or escalate |
| **Claim Comparison** | Side-by-side claim detail comparison for investigation |
| **PDF/CSV Export** | Export claim details, SLA reports, and analytics as PDF or CSV |
| **Keyboard Shortcuts** | Power-user navigation shortcuts throughout the platform |
| **Role-Based Access** | Admin, Adjuster, SIU Analyst roles with RLS-enforced data isolation |
| **Real-Time Updates** | WebSocket-powered live claim updates across all connected clients |

---

## 🛡️ Security

- **Row-Level Security (RLS)** on all database tables
- **Role verification** via `SECURITY DEFINER` functions (prevents recursive RLS)
- Roles stored in a dedicated `user_roles` table (never on the profile)
- Email verification required before sign-in
- All AI calls routed through backend Edge Functions — no client-side API keys

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| UI Components | shadcn/ui, Radix UI, Recharts |
| State & Routing | TanStack React Query, React Router v6 |
| Backend | Lovable Cloud (Edge Functions, Auth, Database, Storage) |
| AI Models | Google Gemini 3 Flash Gateway |
| Speech-to-Text | ElevenLabs Scribe v2 |
| Vector Search | pgvector for RAG embeddings |
| Real-Time | WebSocket subscriptions (postgres_changes) |

---

