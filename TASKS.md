# Web App — Task Plan

Password-protected web deployment of the AI Job Search framework on Fly.io, allowing friends and family to use the full tool (scrape, apply, rank, etc.) with individual accounts.

**Stack:** Next.js (App Router), TypeScript, Tailwind CSS, SQLite, Anthropic SDK, Fly.io
**Auth:** Clerk (hosted auth UI, social login, session management)
**LLM:** Claude API (your key, shared across users)

---

## Dependency Graph

```
#1  Scaffold Next.js project
 │
 ├──► #2  Authentication (register/login/sessions)
 │     │
 │     ├──► #3  Chat UI (conversation interface)
 │     │     │
 │     │     └──► #4  Claude API integration
 │     │           │
 │     │           ├──► #5  Per-user profile & state isolation
 │     │           │     │
 │     │           │     ├──► #6  Slash commands (/scrape, /apply, /rank, /outcome)
 │     │           │     │
 │     │           │     └──► #8  Rate limiting & cost controls
 │     │           │
 │     │           └──► #7  Deploy to Fly.io
```

**Milestone A (Tasks 1–4):** Working password-protected chat with Claude — demoable.
**Milestone B (Tasks 5–6):** Full job-search functionality per user.
**Milestone C (Tasks 7–8):** Production-hardened, deployed, cost-controlled.

---

## Task #1: Scaffold Next.js Project

**Status:** Pending
**Blocked by:** None

### Goal
Create the project skeleton inside `web/` so all subsequent tasks have a buildable, runnable foundation.

### Inputs
- Decision: Next.js 14+ with App Router, TypeScript strict mode, Tailwind CSS
- Decision: SQLite via `better-sqlite3` (simple, file-based, no external DB needed)
- Decision: Project lives in `web/` to coexist with the existing CLI tools at repo root

### Outputs
- `web/` directory with:
  - `package.json` (dependencies: next, react, tailwindcss, better-sqlite3, etc.)
  - `tsconfig.json` (strict)
  - `tailwind.config.ts`
  - `app/layout.tsx` (root layout with Tailwind)
  - `app/page.tsx` (placeholder landing page)
  - `lib/db.ts` (SQLite connection singleton)
  - `db/schema.sql` (initial empty schema file)
  - `Dockerfile` (placeholder — just enough to build Next.js)
  - `fly.toml` (placeholder with app name and region)
  - `.env.example` (documents required env vars)
- The app runs locally with `npm run dev` and shows the placeholder page

### Tests / Acceptance Criteria
- [ ] `cd web && npm install` succeeds without errors
- [ ] `npm run dev` starts the dev server on localhost:3000
- [ ] `npm run build` produces a production build without type errors
- [ ] Visiting http://localhost:3000 shows the placeholder page
- [ ] SQLite database file is created on first run (even if empty)
- [ ] `docker build .` in `web/` succeeds (image builds)

---

## Task #2: Implement Authentication (Clerk)

**Status:** Done
**Blocked by:** #1

### Goal
Protect the app with individual user accounts via Clerk. No one can access chat or features without logging in.

### Inputs
- Next.js project from Task #1
- Decision: Use **Clerk** for authentication (hosted UI, social login, session management)
- Decision: Free tier covers our user count; no self-hosted auth code needed
- Env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`

### Outputs
- Dependencies: `@clerk/nextjs`
- `middleware.ts` (root) — Clerk's `clerkMiddleware()` protecting all routes except `/` and `/sign-in`/`/sign-up`
- Pages:
  - `/sign-in/[[...sign-in]]/page.tsx` — Clerk `<SignIn />` component
  - `/sign-up/[[...sign-up]]/page.tsx` — Clerk `<SignUp />` component
- Root layout wrapped with `<ClerkProvider>`
- `lib/auth.ts` — thin helper: `requireAuth()` that calls `auth()` from `@clerk/nextjs/server` and throws/redirects if not signed in; returns `userId`
- DB table: `users` (id, clerk_id UNIQUE, display_name, created_at) — synced on first login via webhook or on-demand upsert
- Webhook route `POST /api/webhooks/clerk` (optional, for user.created/deleted events) OR lazy upsert in `requireAuth()` on first request
- Updated `.env.example` with Clerk keys

### Tests / Acceptance Criteria
- [x] Visiting `/chat` while signed out redirects to `/sign-in`
- [x] Can sign up via Clerk's hosted UI (email/password or social)
- [x] Can sign in with existing credentials
- [x] After sign-in, session persists across page refreshes (Clerk handles cookies)
- [x] Sign-out clears session and redirects to `/sign-in`
- [x] `requireAuth()` returns the Clerk `userId` for downstream use
- [x] A local `users` row is created on first authenticated request (clerk_id stored)
- [x] User A cannot access User B's data (isolation uses clerk_id, not session tricks)
- [x] App still builds and starts with no Clerk keys set (graceful error page, not crash)

---

## Task #3: Build the Chat UI

**Status:** Done
**Blocked by:** #1, #2

### Goal
Create the conversation interface that users will interact with. This is the primary UX surface. No LLM yet — just the UI shell with a mock echo response.

### Inputs
- Authenticated user session from Task #2
- Decision: Messages stored in SQLite per user
- Decision: UI inspired by ChatGPT/Claude-style chat (scrollable thread, input at bottom)

### Outputs
- DB table: `conversations` (id, user_id, title, created_at, updated_at)
- DB table: `messages` (id, conversation_id, role [user/assistant], content, created_at)
- Page: `/chat` — main chat interface
  - Message thread (scrollable, auto-scrolls to bottom)
  - Text input with send button (and Enter key submit)
  - New conversation button
  - Sidebar or header showing conversation list
- API routes:
  - `POST /api/chat` — accepts message, returns mock echo response
  - `GET /api/conversations` — list user's conversations
  - `GET /api/conversations/[id]` — get messages for a conversation
- Mobile-responsive layout (usable on phone screens)

### Tests / Acceptance Criteria
- [ ] User sees an empty chat on first visit
- [ ] Typing a message and hitting send shows it in the thread
- [ ] A mock response appears after sending (echo or "LLM not connected yet")
- [ ] Messages persist across page refreshes (stored in DB)
- [ ] Can start a new conversation
- [ ] Can switch between past conversations
- [ ] User A cannot see User B's conversations
- [ ] Layout works on mobile viewport (375px wide)
- [ ] Input is disabled while "response" is loading (prevents double-send)

---

## Task #4: Integrate Claude API

**Status:** Done
**Blocked by:** #3

### Goal
Replace the mock echo with real Claude responses. The app becomes a functional AI assistant.

### Inputs
- Chat UI and message storage from Task #3
- `AWS_BEARER_TOKEN_BEDROCK` environment variable (Bedrock bearer token auth)
- System prompt assembled from skill files (job-application-assistant role definition)
- Decision: AWS Bedrock InvokeModel with bearer token auth (same as Claude Code uses)
- Decision: Model `us.anthropic.claude-opus-4-6-v1` (only model currently accessible)

### Implementation
- `lib/claude.ts` — Bedrock client with bearer token auth, `chat()` (sync) and `chatStream()` (SSE) helpers
- `lib/system-prompt.ts` — assembles system prompt from skill files on disk (candidate profile, behavioral, writing style, job evaluation)
- `POST /api/chat` — streams response tokens via SSE (ReadableStream), loads last 50 messages for context, stores token usage
- `ChatClient` — reads SSE stream, renders tokens incrementally as they arrive
- `MessageThread` — shows loading dots until first token, then renders streaming content
- DB: `input_tokens` and `output_tokens` columns added to `messages` table (with migration for existing DBs)
- Missing API key returns 503 with clear error message; rate limit errors shown as "Please try again in a moment"

### Tests / Acceptance Criteria
- [x] Sending a message produces a real Claude response (not echo)
- [x] Response streams token-by-token (not all at once after delay)
- [x] Conversation history is sent as context (Claude remembers earlier messages)
- [x] Context window is managed (old messages trimmed if conversation is very long)
- [x] Missing API key shows a clear error on the chat page (not a crash)
- [x] API rate limit errors are caught and shown as "Please try again in a moment"
- [x] Token usage is recorded per message in the DB
- [x] System prompt includes the job-application-assistant role and instructions

---

## Task #5: Per-User Profile & State Isolation

**Status:** Done
**Blocked by:** #2, #4

### Goal
Each user gets their own candidate profile, preferences, and tracked applications. Claude receives the active user's profile as context when responding.

### Inputs
- Auth system (user identity) from Task #2
- Claude integration from Task #4
- Existing skill file structure (01-candidate-profile, 02-behavioral, etc.)

### Outputs
- DB table: `profiles` (user_id, section [identity/education/experience/skills/behavioral/preferences], content JSON, updated_at)
- DB table: `applications` (id, user_id, company, role, status, job_posting_text, cv_path, cover_letter_path, notes, created_at, updated_at)
- Page: `/profile` — view/edit profile sections (simple form or structured editor)
- Updated system prompt assembly:
  - `lib/system-prompt.ts` now injects the user's profile data into the prompt
  - If profile is empty, Claude is instructed to run the `/setup` flow
- The `/setup` conversation flow populates the profile DB rows (Claude extracts structured data from the conversation and the API route saves it)

### Tests / Acceptance Criteria
- [x] New user with empty profile: Claude prompts them to set up
- [x] After setup conversation, profile rows are populated in DB
- [x] User A's profile data is never sent to Claude when User B is chatting
- [x] `/profile` page shows current profile data
- [x] User can edit profile sections from the `/profile` page
- [x] `applications` table tracks jobs per user (read by Claude for context)
- [x] Deleting an account removes all associated profile and application data

---

## Task #6: Slash Commands (/scrape, /apply, /rank, /outcome)

**Status:** Pending
**Blocked by:** #4, #5

### Goal
The real job-search functionality. Slash commands in chat trigger server-side actions and return results as assistant messages.

### Inputs
- Claude integration with user profile context from Tasks #4 and #5
- Existing CLI tools in `.agents/skills/` (jobindex-search, jobbank-search, etc.)
- Existing skill definitions in `.claude/skills/`

### Outputs
- `lib/commands.ts` — command parser and router
  - Detects `/scrape`, `/apply <url>`, `/rank`, `/outcome` in user messages
  - Routes to appropriate handler before (or instead of) sending to Claude
- Command handlers:
  - `/scrape` — runs job scraper CLIs server-side, stores results in `scraped_jobs` table per user, returns summary
  - `/apply <url_or_text>` — triggers the evaluation + CV/cover letter workflow via Claude (multi-turn)
  - `/rank` — triggers ranking of unranked scraped jobs via Claude
  - `/outcome <company> <result>` — updates application status
- DB table: `scraped_jobs` (id, user_id, portal, title, company, url, location, snippet, scraped_at, ranked, rank_score, rank_notes)
- The Bun CLI tools are bundled into the Docker image and callable from Node.js via `child_process`

### Tests / Acceptance Criteria
- [ ] Typing `/scrape` in chat triggers the scraper and returns job listings
- [ ] Scraped jobs are stored per-user (User A's scrape doesn't show for User B)
- [ ] `/apply` with a job URL kicks off the evaluation flow
- [ ] `/rank` ranks only the current user's unranked scraped jobs
- [ ] `/outcome` updates the correct application record
- [ ] Unknown slash commands are passed to Claude as normal messages
- [ ] Long-running commands (scrape) show a progress indicator
- [ ] Scraper errors don't crash the server (caught and reported to user)

---

## Task #7: Deploy to Fly.io

**Status:** Pending
**Blocked by:** #1, #2, #3, #4

### Goal
The app is live on the internet, accessible via a fly.dev URL, with persistent data.

### Inputs
- Working app from Tasks #1–4 (minimum viable deployment)
- Fly.io account (user provides)
- Secrets: `ANTHROPIC_API_KEY`, `SESSION_SECRET`

### Outputs
- Finalized `Dockerfile`:
  - Multi-stage build (deps → build → runtime)
  - Node.js 20 runtime
  - Bun installed for scraper CLIs (Task #6 will use this)
  - SQLite database at `/data/app.db` (persistent volume mount)
- Finalized `fly.toml`:
  - App name, primary region
  - Persistent volume (`/data`, 1GB)
  - Health check endpoint (`/api/health`)
  - Auto-stop/auto-start for cost savings
- `web/app/api/health/route.ts` — returns 200 OK + DB connectivity check
- Deploy script or instructions in README

### Tests / Acceptance Criteria
- [ ] `fly deploy` succeeds and app is reachable at `https://<app-name>.fly.dev`
- [ ] Can register and log in on the live URL
- [ ] Chat works end-to-end (message → Claude response)
- [ ] Data persists across deploys (volume is not wiped)
- [ ] Health check endpoint returns 200
- [ ] App restarts cleanly after a crash (SQLite WAL mode handles this)
- [ ] HTTPS is enforced (Fly handles this by default)
- [ ] Secrets are set and not visible in logs

---

## Task #8: Rate Limiting & Cost Controls

**Status:** Pending
**Blocked by:** #4, #5

### Goal
Prevent any single user from burning through the API budget. Provide visibility into usage.

### Inputs
- Token usage data stored per message (from Task #4)
- User accounts from Task #2
- Decision: Daily token limit per user (configurable via env var, e.g., `DAILY_TOKEN_LIMIT=100000`)

### Outputs
- `lib/rate-limit.ts` — checks user's daily token spend before allowing API calls
- DB view or query: sum of tokens per user per day
- UI element: token usage indicator on chat page ("X% of daily budget used")
- When limit is hit: friendly message in chat ("You've reached your daily limit. Resets at midnight UTC.")
- Admin page (`/admin`) — protected by a list of admin usernames (env var):
  - Table of all users with their daily/total token usage
  - Total spend across all users
  - Ability to adjust a user's daily limit
- Env vars: `DAILY_TOKEN_LIMIT`, `ADMIN_USERS`

### Tests / Acceptance Criteria
- [ ] User under limit can chat normally
- [ ] User at limit gets a friendly rejection (not an error)
- [ ] Limit resets at midnight UTC (new day = fresh budget)
- [ ] Token counter in UI updates after each message
- [ ] Admin page shows per-user usage (only accessible to admin users)
- [ ] Non-admin users get 404 on `/admin`
- [ ] `DAILY_TOKEN_LIMIT` env var is respected (can be changed without redeploy on Fly via secrets)
- [ ] Token counting includes both input and output tokens

---

## Notes

- **Cost estimate:** Claude Sonnet at ~$3/M input + $15/M output. A typical conversation (10 exchanges) costs roughly $0.05–0.15. With 5 active users, budget ~$5–15/day at heavy use.
- **Future enhancements (not in scope):**
  - OAuth / social login
  - File upload (CV PDFs)
  - LaTeX compilation server-side
  - WebSocket instead of SSE
  - Multi-language UI
