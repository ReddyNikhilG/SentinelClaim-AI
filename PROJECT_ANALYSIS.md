# Claims Orchestrator AI - Project Analysis & Setup Guide

## Project Overview

**Claims Orchestrator AI** is an intelligent claims management system built with:
- **Frontend**: React 18 + TypeScript + Vite  
- **UI Framework**: Shadcn/UI with Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Functions + Storage)
- **AI Integration**: Gemini API for fraud scoring & Elevenlabs for transcription
- **Real-time**: Supabase Realtime subscriptions for claims, notifications, and notes
- **Storage**: Supabase Storage for claim documents
- **Email**: Resend API for email notifications
- **Chat**: RAG-based chat with vector embeddings (pgvector)

---

## Architecture

### Frontend Structure
```
src/
├── App.tsx                    # Main app with routing
├── components/
│   ├── NavLink.tsx            # Navigation component
│   ├── ProtectedRoute.tsx     # Auth guard
│   ├── activity-log/          # Activity log components
│   ├── admin/                 # Admin panel components
│   ├── chat/                  # Chat & RAG components
│   ├── claims/                # Claims related components
│   ├── dashboard/             # Dashboard components
│   ├── layout/                # Layout wrapper
│   ├── notifications/         # Notification components
│   └── ui/                    # Shadcn UI components
├── contexts/
│   └── AuthContext.tsx        # Authentication state
├── hooks/
│   ├── useClaimDocuments.ts   # Fetch claim documents
│   ├── useClaims.ts           # Fetch claims data
│   ├── useNotifications.ts    # Real-time notifications
│   ├── useRealtimeClaims.ts   # Real-time claim updates
│   ├── useSpeechRecognition.ts # Voice claim input
│   ├── useElevenLabsTranscribe.ts # Voice transcription
│   └── [other hooks]
├── pages/
│   ├── AuthPage.tsx           # Login/signup
│   ├── DashboardPage.tsx      # Main dashboard
│   ├── ClaimsListPage.tsx     # Claims list
│   ├── ClaimDetailPage.tsx    # Claim details & chat
│   ├── AdminPage.tsx          # Admin management
│   ├── SlaDashboardPage.tsx   # SLA monitoring
│   ├── ActivityLogPage.tsx    # Activity audit trail
│   ├── AnalyticsPage.tsx      # Analytics & reports
│   └── [other pages]
├── types/
│   └── claims.ts              # TypeScript interfaces
├── integrations/
│   └── supabase/
│       ├── client.ts          # Supabase client config
│       └── types.ts           # Generated DB types
├── hooks/
│   └── [custom hooks]
└── lib/
    ├── fraudScoring.ts        # Fraud analysis logic
    ├── slaPdfExport.ts        # PDF generation
    └── utils.ts               # Utilities
```

### Key Technologies

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | React 18 + TypeScript + Vite | UI rendering |
| **Styling** | Tailwind CSS + Shadcn/UI | Component styling |
| **State Management** | React Query (TanStack) | Server state & caching |
| **Auth** | Supabase Auth | User authentication |
| **Database** | Supabase PostgreSQL | Data persistence |
| **Real-time** | Supabase Realtime | Live updates |
| **Storage** | Supabase Storage | Document uploads |
| **API** | Supabase Edge Functions | Custom business logic |
| **AI** | Gemini API | Fraud scoring |
| **Voice** | ElevenLabs API | Transcription |
| **Email** | Resend API | Notifications |
| **Embeddings** | pgvector | Vector search for RAG |

---

## Database Schema (Supabase PostgreSQL)

### Core Tables

#### 1. **profiles** (User Information)
```sql
- id: UUID (PK)
- user_id: UUID (FK → auth.users)
- full_name: TEXT
- email: TEXT
- avatar_url: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### 2. **user_roles** (Role Assignment)
```sql
- id: UUID (PK)
- user_id: UUID (FK → auth.users)
- role: user_role ENUM (admin, adjuster, siu_analyst)
- created_at: TIMESTAMP
UNIQUE (user_id, role)
```

#### 3. **claims** (Main Claims Table)
```sql
- id: UUID (PK)
- claim_number: TEXT (UNIQUE, auto-generated)
- policy_number: TEXT
- claim_type: claim_type ENUM (auto, property, liability, workers_comp, health)
- claim_amount: DECIMAL(12, 2)
- incident_date: DATE
- incident_location: TEXT
- description: TEXT
- status: claim_status ENUM (pending, under_review, approved, rejected, siu_investigation, auto_approved)
- risk_score: INTEGER (0-100)
- risk_category: risk_category ENUM (low, medium, high)
- assigned_group: TEXT
- assigned_to: UUID (FK → auth.users, nullable)
- claimant_name: TEXT
- claimant_email: TEXT
- claimant_phone: TEXT
- created_by: UUID (FK → auth.users)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### 4. **fraud_results** (AI Fraud Analysis)
```sql
- id: UUID (PK)
- claim_id: UUID (FK → claims) UNIQUE
- score: INTEGER (0-100)
- category: risk_category ENUM (low, medium, high)
- factors: JSONB (array of factors)
- analyzed_at: TIMESTAMP
```

#### 5. **claim_events** (Audit Trail)
```sql
- id: UUID (PK)
- claim_id: UUID (FK → claims)
- event_type: TEXT
- event_data: JSONB
- performed_by: UUID (FK → auth.users, nullable)
- created_at: TIMESTAMP
```

#### 6. **claim_notes** (Comments & Collaboration)
```sql
- id: UUID (PK)
- claim_id: UUID (FK → claims)
- user_id: UUID (FK → auth.users)
- content: TEXT
- note_type: TEXT ENUM (comment, internal, system)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### 7. **claim_documents** (Document Tracking)
```sql
- id: UUID (PK)
- claim_id: UUID (FK → claims)
- file_name: TEXT
- file_path: TEXT
- file_size: INTEGER
- file_type: TEXT
- uploaded_by: UUID (FK → auth.users)
- created_at: TIMESTAMP
```

#### 8. **notifications** (User Notifications)
```sql
- id: UUID (PK)
- user_id: UUID (FK → auth.users)
- title: TEXT
- message: TEXT
- type: TEXT (info, warning, error, success)
- claim_id: UUID (FK → claims, nullable)
- read: BOOLEAN
- created_at: TIMESTAMP
```

#### 9. **notification_preferences** (User Settings)
```sql
- id: UUID (PK)
- user_id: UUID (FK → auth.users) UNIQUE
- email_bulk_approved: BOOLEAN (default: true)
- email_bulk_rejected: BOOLEAN (default: true)
- email_bulk_siu_investigation: BOOLEAN (default: true)
- email_bulk_reassign: BOOLEAN (default: true)
- email_high_risk_alert: BOOLEAN (default: true)
- email_claim_reassignment: BOOLEAN (default: true)
- email_digest_enabled: BOOLEAN (default: false)
- email_digest_frequency: TEXT (daily, weekly, monthly)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### 10. **email_log** (Email Audit)
```sql
- id: UUID (PK)
- user_id: UUID (FK → auth.users)
- email_type: TEXT
- recipient_email: TEXT
- subject: TEXT
- status: TEXT (sent, failed, pending)
- error_message: TEXT
- metadata: JSONB
- created_at: TIMESTAMP
```

#### 11. **chat_messages** (Chat History)
```sql
- id: UUID (PK)
- user_id: UUID (FK → auth.users)
- role: TEXT (user, assistant)
- content: TEXT
- created_at: TIMESTAMP
```

#### 12. **chat_documents** (RAG Knowledge Base)
```sql
- id: UUID (PK)
- title: TEXT
- content: TEXT
- embedding: vector(1536) [pgvector]
- metadata: JSONB
- created_at: TIMESTAMP
```

#### 13. **sla_snapshots** (SLA Tracking)
```sql
- id: UUID (PK)
- week_start: DATE
- total_emails: INTEGER
- sent_count: INTEGER
- failed_count: INTEGER
- success_rate: INTEGER
- first_attempt_rate: INTEGER
- avg_attempts: NUMERIC(4, 2)
- sla_healthy: BOOLEAN
- created_at: TIMESTAMP
```

#### 14. **sla_thresholds** (SLA Configuration)
```sql
- id: UUID (PK)
- first_attempt_rate_target: INTEGER (default: 80)
- max_hourly_failure_rate: INTEGER (default: 20)
- failure_alert_min_samples: INTEGER (default: 5)
- escalation_consecutive_weeks: INTEGER (default: 2)
- slack_channel: TEXT (default: '#general')
- updated_at: TIMESTAMP
- updated_by: UUID (FK → auth.users)
```

### Storage Buckets

1. **claim-documents** - Stores uploaded claim files (private, authenticated access)

---

## Row-Level Security (RLS) Policies

### Profiles
- Users can view/update own profiles
- Admins can view all profiles

### Claims
- **Admins**: View all claims
- **SIU Analysts**: View only HIGH-risk claims
- **Adjusters**: View assigned claims or own claims
- All authenticated users can create claims
- Adjusters/admins can update claims

### Notifications
- Users see only their own notifications
- System can insert notifications

### Chat
- Users can manage their own chat history
- RAG documents are publicly readable

### Email Log
- Users see own email log
- Admins see all

### Preferences & Documents
- Users control own preferences and documents
- Admins have elevated access

---

## Supabase Edge Functions

Configured Edge Functions for automation:

1. **claims-assistant** - AI-powered claim analysis
2. **parse-voice-claim** - Voice-to-claim conversion
3. **send-high-risk-alert** - Alert high-risk claims
4. **elevenlabs-transcribe** - Voice transcription
5. **chat-messages** - Chat API
6. **embed-query** - Vector embedding queries
7. **generate-embeddings** - Create embeddings
8. **notify-reassignment** - Alert on reassignment
9. **send-digest** - Email digests
10. **notify-bulk-action** - Bulk operation alerts
11. **check-email-failure-rate** - SLA monitoring
12. **send-sla-report** - SLA reports

All functions have JWT verification disabled for service-to-function calls.

---

## Current Environment Configuration

### Environment Variables (`.env`)
```env
VITE_SUPABASE_PROJECT_ID="ljybuubleavqtxuzdzxi"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_cGw9kQswh6ieGXXWK6V6iQ_u98Mpmkd"
VITE_SUPABASE_URL="https://ljybuubleavqtxuzdzxi.supabase.co"
GEMINI_API_KEY="AIzaSyBQJinlJQXXhu4L6y1-ahj1A40dhnwOoLU"
ELEVENLABS_API_KEY="2779f6353c8f85ec83af98b47a9164aa20d23796191009928a8207d86b70bd52"
RESEND_API_KEY="re_4VaAwcUg_H17eboUSKqfQYC2H9btv6fGe"
```

---

## Key Features

### 1. **Authentication & Authorization**
- Supabase Auth (Email/social login)
- Role-based access control (RBAC)
- Row-level security policies

### 2. **Claims Management**
- Create/view/update claims
- Auto-generated claim numbers
- Risk scoring with Gemini AI
- Multiple claim types and statuses

### 3. **Real-time Updates**
- Live claim status changes
- Real-time notifications
- Collaborative notes

### 4. **AI-Powered Features**
- Fraud risk detection
- Voice claim input (speech recognition + ElevenLabs)
- RAG-based chat assistant with embeddings

### 5. **Audit & Compliance**
- Complete audit trail (claim_events)
- Email delivery tracking
- Activity logging
- SLA monitoring

### 6. **User Experience**
- Responsive UI with Tailwind CSS
- Toast notifications
- Real-time data synchronization
- Document upload support

### 7. **Analytics & Reporting**
- Dashboard with key metrics
- SLA dashboard for email performance
- Activity logs for compliance
- Analytics page for trends

---

## Development Setup

### Prerequisites
- Node.js 16+
- Bun or npm
- Supabase CLI (for local development)

### Installation
```bash
# Install dependencies
bun install

# Configure environment variables
# Update .env with your Supabase credentials

# Start development server
bun run dev

# Build for production
bun run build
```

### Running Tests
```bash
# Run tests
bun run test

# Watch mode
bun run test:watch
```

---

## Database Connection Status

✅ **Supabase Connected**
- Project ID: `ljybuubleavqtxuzdzxi`
- URL: `https://ljybuubleavqtxuzdzxi.supabase.co`
- All migrations applied: 17 migrations
- Tables: 14 main tables
- Storage: 1 bucket (claim-documents)
- Functions: 12 Edge Functions

---

## Next Steps

1. ✅ Database schema is fully configured
2. ✅ All tables created with proper relationships
3. ✅ Row-level security policies in place
4. ✅ Real-time subscriptions configured
5. ✅ Storage bucket configured
6. ⏳ **Seed initial data** (users, test claims)
7. ⏳ **Deploy Edge Functions** (local → Supabase)
8. ⏳ **Test all integrations** (Gemini, ElevenLabs, Resend)

---

## Key Database Functions & Procedures

### 1. **has_role()** - Check user role
```sql
SELECT has_role(user_id, 'admin'::user_role)
```

### 2. **get_user_role()** - Get user's role
```sql
SELECT get_user_role(user_id)
```

### 3. **match_documents()** - Vector similarity search
```sql
SELECT * FROM match_documents(query_embedding, 0.75, 5)
```

### 4. **verify_schema_integrity()** - Check schema health
```sql
SELECT * FROM verify_schema_integrity()
```

---

## Important Security Notes

- All tables have RLS enabled
- Service role needed for admin operations
- Frontend uses publishable key (limited scope)
- All user data is isolated by user_id
- Email functions can be called by service role only
- Chat documents are public but user messages are private

---

## File Structure Summary

- **Frontend**: React + TypeScript (src/)
- **Config**: Vite, Tailwind, ESLint (root)
- **Database**: Supabase PostgreSQL + migrations
- **Functions**: Edge Functions (TypeScript)
- **Tests**: Vitest configuration
- **Package Manager**: Bun

---

