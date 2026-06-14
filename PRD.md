# OpenWave — Product Requirements Document (PRD) v1.1

> **Project Codename:** OpenWave  
> **Document Version:** 1.1  
> **Status:** Approved for Development  
> **Last Updated:** 2026-06-14  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Target Users & Personas](#4-target-users--personas)
5. [Tech Stack & Architecture](#5-tech-stack--architecture)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Security Requirements](#8-security-requirements)
9. [API & Integration Contracts](#9-api--integration-contracts)
10. [Real-Time Synchronization Specification](#10-real-time-synchronization-specification)
11. [Collaborative Feature Specification](#11-collaborative-feature-specification)
12. [Environment & Configuration Management](#12-environment--configuration-management)
13. [Monorepo Layout](#13-monorepo-layout)
14. [Out of Scope](#14-out-of-scope)
15. [Open Questions](#15-open-questions)

---

## 1. Executive Summary

**OpenWave** is a free, open-source music streaming and **synchronized listening** platform. It lets users discover royalty-free music (via the Jamendo catalog), create shareable "Jam Rooms", and listen together in real-time — with millisecond-accurate playback sync, an ephemeral live chat, and a democratic track-queue voting system.

OpenWave is built to be self-hostable: operators provide their own Jamendo and Supabase credentials via environment variables; no secrets are ever hardcoded into the source tree.

---

## 2. Problem Statement

| Pain Point | Today's Reality | OpenWave's Answer |
|---|---|---|
| Synchronized listening | Existing tools are proprietary / paywalled | Free, open-source, self-hostable |
| Royalty-free music discovery | Fragmented across multiple sites | Unified Jamendo-powered search |
| Community queue curation | DJ-only or no-vote systems | Democratic upvote + host-approve model |
| Privacy / data ownership | Centralized platforms harvest data | Self-hosted; minimal data retention |

---

## 3. Goals & Success Metrics

### Primary Goals
1. Deliver a fully functional HTML5 music player backed by the Jamendo REST API.
2. Enable real-time, drift-corrected synchronized playback inside Jam Rooms.
3. Provide ephemeral live chat and a track-queue voting system within each room.
4. Pass a self-administered SAST security audit with **zero critical findings** before release.

### Success Metrics (v1.1 Launch)
| Metric | Target |
|---|---|
| Sync drift between host & listener | < 500 ms under normal LAN/WAN conditions |
| Jamendo API calls per day | < 40,000 (80% of 50,000 free-tier limit) |
| Critical security findings at audit | 0 |
| TypeScript compilation errors | 0 |
| Time-to-first-sound (cold start) | < 3 seconds |

---

## 4. Target Users & Personas

### 🎧 The Casual Listener — "Alex"
- Age 19–28, student or young professional
- Wants to discover new music without a subscription
- Would share a room link with friends to listen together remotely

### 🎛️ The Host / DJ — "Jordan"
- Curates playlists; wants control over what plays next
- Values the host-approve mechanic to avoid queue hijacking
- Self-hosts OpenWave for their community Discord server

### 👨‍💻 The Developer / Operator — "Sam"
- Forks and self-hosts OpenWave
- Needs clear env-var documentation and no hardcoded secrets
- Expects TypeScript, clean code, and a monorepo structure they can extend

---

## 5. Tech Stack & Architecture

### Frontend
| Concern | Technology |
|---|---|
| Framework | React 18 |
| Language | TypeScript |
| Bundler | Vite |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Real-Time Client | Native WebSocket API |
| XSS Sanitization | DOMPurify |
| HTTP Client | Fetch API (typed wrapper) |

### Backend
| Concern | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express |
| Language | TypeScript (ts-node / tsx) |
| WebSocket | `ws` library |
| Validation | Zod |
| Rate Limiting | express-rate-limit |
| Environment | dotenv |
| Auth / DB | Supabase (Auth + Postgres) |

### Monorepo Tooling
| Concern | Technology |
|---|---|
| Workspace manager | npm Workspaces |
| Concurrent dev runner | concurrently |
| Linter | ESLint + Prettier |

---

## 6. Functional Requirements

### 6.1 Music Discovery & Player

| ID | Requirement | Priority |
|---|---|---|
| P-01 | User can search tracks by keyword via Jamendo | P0 |
| P-02 | Search results display: title, artist, album art, duration | P0 |
| P-03 | User can play / pause a track | P0 |
| P-04 | User can seek within a track via a progress slider | P0 |
| P-05 | Volume control with mute toggle | P0 |
| P-06 | Auto-advance to next track in queue | P1 |
| P-07 | Display currently-playing metadata and album art | P0 |
| P-08 | Browse curated chart / trending tracks on home page | P1 |

### 6.2 Jam Room — Session Management

| ID | Requirement | Priority |
|---|---|---|
| R-01 | Authenticated user can create a Jam Room | P0 |
| R-02 | Room generates a shareable 6-character alphanumeric code | P0 |
| R-03 | Any user with the room code can join | P0 |
| R-04 | Room displays a live member count | P1 |
| R-05 | Host can close the room explicitly | P0 |
| R-06 | If host disconnects, a **60-second grace period** begins | P0 |
| R-07 | If host reconnects within 60s, they reclaim host status | P0 |
| R-08 | If grace period expires without reconnect, promote next member to host; if no members remain, dissolve room | P0 |
| R-09 | Rooms are ephemeral — no state is persisted to the database | P0 |

### 6.3 Real-Time Playback Synchronization

| ID | Requirement | Priority |
|---|---|---|
| S-01 | Host playback state (track, position, playing/paused) broadcasts to all room members | P0 |
| S-02 | Client computes expected position: `position_ms + (Date.now() - host_timestamp)` | P0 |
| S-03 | Client seeks local audio **only if** drift delta > 500 ms | P0 |
| S-04 | Sync corrections are silent (no audible skip for sub-500ms drift) | P0 |
| S-05 | New joiners receive an immediate state snapshot from the server | P0 |

### 6.4 Ephemeral Live Chat

| ID | Requirement | Priority |
|---|---|---|
| C-01 | Members can send text messages visible to all room members | P0 |
| C-02 | Chat messages are **ephemeral** — not stored in DB | P0 |
| C-03 | Rolling buffer of last 100 messages per room | P1 |
| C-04 | Messages display sender username and timestamp | P1 |
| C-05 | All message content is XSS-sanitized before render | P0 |

### 6.5 Track Queue & Voting

| ID | Requirement | Priority |
|---|---|---|
| Q-01 | Any member can suggest a track to the room queue | P0 |
| Q-02 | Members can upvote or downvote queued tracks | P0 |
| Q-03 | Queue is sorted by net vote count (descending) | P0 |
| Q-04 | **Only the host** can accept (promote) a track to play next | P0 |
| Q-05 | Accepted track moves to top of play queue; voting entry is removed | P1 |

### 6.6 Authentication

| ID | Requirement | Priority |
|---|---|---|
| A-01 | Users can sign up / log in via Supabase Auth (email + password) | P0 |
| A-02 | JWT issued by Supabase validated on backend for protected routes | P0 |
| A-03 | Guest / anonymous mode: users can listen (not host) without an account | P2 |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | First Contentful Paint < 1.5s on broadband |
| **Scalability** | Backend supports ≥ 100 concurrent WebSocket connections per single Node process |
| **Reliability** | 60-second host grace period prevents room dissolution on brief disconnects |
| **Availability** | Stateless HTTP layer; WebSocket state in-memory (acceptable for v1.1 single-node) |
| **Accessibility** | All interactive controls have `aria-label`; keyboard navigable player |
| **Responsiveness** | UI adapts to mobile (≥ 375px) and desktop (≥ 1280px) viewports |
| **Maintainability** | TypeScript strict mode; zero `any` casts without explicit justification |

---

## 8. Security Requirements

### 8.1 Environment & Credential Management
- **MUST NOT** hardcode any API key, secret, or database URL in source code.
- All secrets loaded exclusively from `process.env` via `dotenv`.
- A `.env.example` file MUST document every required variable with a description.
- Frontend only receives `VITE_*`-prefixed public variables (Supabase anon key, backend URL).

### 8.2 WebSocket Message Validation
- Every incoming WebSocket frame MUST be validated against a Zod schema before processing.
- Unknown or malformed message types MUST be silently dropped (no error broadcast).
- Payload fields validated for **correct types and value ranges** to prevent prototype pollution:
  ```
  SYNC_STATE  → { track_id: string, position_ms: number (≥0), is_playing: boolean, host_timestamp: number }
  CHAT_MESSAGE → { content: string (maxLen 500) }
  QUEUE_VOTE  → { track_id: string, vote: "up" | "down" }
  QUEUE_ACCEPT → { track_id: string }
  ```

### 8.3 Rate Limiting & DoS Protection
- Express API proxy routes: **100 requests / 15 minutes / IP** via `express-rate-limit`.
- Search input on frontend: **300 ms debounce** before firing API call.
- Chat messages: **5 messages / second / connection** rate-limited server-side.

### 8.4 XSS Prevention
- Chat message content run through `DOMPurify.sanitize()` before insertion into the DOM.
- React's JSX escapes string interpolation by default — do NOT use `dangerouslySetInnerHTML` with raw user content.
- HTTP response headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.

### 8.5 CORS
- Backend `cors` middleware configured with an explicit `CORS_ORIGIN` allowlist from env.
- No wildcard `*` origins in production.

---

## 9. API & Integration Contracts

### 9.1 Jamendo REST API (via Backend Proxy)

All calls routed through backend to protect the `CLIENT_ID`.

| Endpoint | Method | Backend Route | Description |
|---|---|---|---|
| `/tracks/` | GET | `GET /api/tracks/search?q=&limit=` | Search tracks by keyword |
| `/tracks/:id` | GET | `GET /api/tracks/:id` | Single track metadata |
| `/charts/tracks/` | GET | `GET /api/charts` | Trending / chart tracks |
| `/albums/` | GET | `GET /api/albums/search?q=` | Album search |
| `/artists/` | GET | `GET /api/artists/search?q=` | Artist search |

**Jamendo Base URL:** `https://api.jamendo.com/v3.0`  
**Auth:** `client_id` query param (never exposed to browser)  
**Audio format:** `mp32` (128kbps MP3)

### 9.2 Supabase Integration

| Purpose | Method |
|---|---|
| User registration | `supabase.auth.signUp()` |
| User login | `supabase.auth.signInWithPassword()` |
| JWT verification (backend) | `supabase.auth.getUser(token)` |
| User metadata storage | `profiles` table in Postgres |

### 9.3 WebSocket Message Protocol

All messages are JSON-serialized strings. Every message includes a `type` discriminator field.

**Client → Server:**
```jsonc
// Join a room
{ "type": "JOIN_ROOM", "room_code": "ABC123", "username": "jordan" }

// Host broadcasts playback state
{ "type": "SYNC_STATE", "track_id": "12345", "position_ms": 34200, "is_playing": true, "host_timestamp": 1718000000000 }

// Send a chat message
{ "type": "CHAT_MESSAGE", "content": "This track is 🔥" }

// Vote on a queued track
{ "type": "QUEUE_VOTE", "track_id": "67890", "vote": "up" }

// Host accepts a queued track
{ "type": "QUEUE_ACCEPT", "track_id": "67890" }
```

**Server → Client:**
```jsonc
// Room state snapshot (sent to new joiner)
{ "type": "ROOM_STATE", "members": [...], "current_track": {...}, "position_ms": 34200, "is_playing": true, "host_timestamp": 1718000000000 }

// Broadcast sync to all members
{ "type": "SYNC_BROADCAST", "track_id": "12345", "position_ms": 34200, "is_playing": true, "host_timestamp": 1718000000000 }

// Chat message broadcast
{ "type": "CHAT_BROADCAST", "username": "jordan", "content": "This track is 🔥", "timestamp": 1718000000000 }

// Queue state update
{ "type": "QUEUE_UPDATE", "queue": [{ "track": {...}, "votes": 5 }] }

// Error
{ "type": "ERROR", "code": "ROOM_NOT_FOUND", "message": "Room does not exist." }
```

---

## 10. Real-Time Synchronization Specification

### 10.1 Sync Algorithm

The host is the **single source of truth** for playback state. Members calculate expected local position and self-correct if drift exceeds threshold.

```
Expected Position (ms) = position_ms + (Date.now() - host_timestamp)
Drift Delta (ms)       = |audio.currentTime × 1000 − Expected Position|

IF Drift Delta > 500ms:
    audio.currentTime = Expected Position / 1000
```

### 10.2 Sync Frequency
- Host emits `SYNC_STATE` **every 5 seconds** during active playback.
- Host also emits on: play, pause, seek, track-change events.

### 10.3 Host Disconnect Grace Period (State Machine)

```
HOST CONNECTED
     │
     ▼
  [PLAYING] ──── disconnect ────▶ [GRACE_PERIOD (60s)]
                                        │
                           ┌───── reconnect ──────┐
                           ▼                       ▼
                   [HOST_RECLAIMED]         [GRACE_EXPIRED]
                                                   │
                                      members > 0 ? │
                                      ┌─────────────┴────────────┐
                                      ▼                           ▼
                              [PROMOTE_NEXT_MEMBER]        [DISSOLVE_ROOM]
```

---

## 11. Collaborative Feature Specification

### 11.1 Queue Voting — Detailed Rules

1. Member suggests a track → `QUEUE_SUGGEST` message with `track_id`.
2. Track added to room queue with `votes = 0`.
3. Any member (including suggester) can `QUEUE_VOTE` up or down — one vote per member per track.
4. Vote changes are idempotent (re-voting same direction is a no-op).
5. Queue sorted descending by `net_votes` at all times.
6. Host sends `QUEUE_ACCEPT` → track moves to `next_in_queue`; removed from voting list.
7. If host skips current track, `next_in_queue` begins playing.

### 11.2 Chat — Detailed Rules

1. Max message length: **500 characters**. Truncated server-side if exceeded.
2. Rolling buffer: **last 100 messages** kept in server memory per room.
3. New joiners receive the buffer immediately as `CHAT_HISTORY` message.
4. All content sanitized before rendering (DOMPurify on client).

---

## 12. Environment & Configuration Management

### Backend `.env` Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Express server port (default: `3001`) |
| `JAMENDO_CLIENT_ID` | Yes | Your Jamendo application Client ID |
| `JAMENDO_API_BASE` | No | Jamendo base URL (default: `https://api.jamendo.com/v3.0`) |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (never send to client) |
| `JWT_SECRET` | Yes | Secret for signing any custom JWTs |
| `CORS_ORIGIN` | Yes | Allowed frontend origin (e.g., `http://localhost:5173`) |

### Frontend `.env` Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | Yes | Backend HTTP base URL (e.g., `http://localhost:3001`) |
| `VITE_WS_URL` | Yes | Backend WebSocket URL (e.g., `ws://localhost:3001`) |
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (safe for browser) |

> **Security Note:** Only `VITE_*` prefixed variables are bundled into the browser by Vite. Service role keys MUST NOT have `VITE_` prefix.

---

## 13. Monorepo Layout

```
openwave/
├── package.json                     # npm workspace root; "concurrently" dev script
├── .env.example                     # Top-level documentation of all env vars
├── PRD.md                           # This document
│
├── apps/
│   ├── frontend/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── index.css
│   │       ├── store/
│   │       │   ├── playerStore.ts   # Track, position, queue state
│   │       │   ├── roomStore.ts     # Room members, sync state
│   │       │   └── chatStore.ts     # Ephemeral chat buffer
│   │       ├── hooks/
│   │       │   ├── usePlayer.ts     # Audio element controller
│   │       │   └── useJamRoom.ts    # WebSocket room lifecycle
│   │       ├── components/
│   │       │   ├── Player/
│   │       │   │   ├── AudioPlayer.tsx
│   │       │   │   ├── ProgressBar.tsx
│   │       │   │   └── VolumeControl.tsx
│   │       │   ├── JamRoom/
│   │       │   │   ├── RoomHeader.tsx
│   │       │   │   └── MemberList.tsx
│   │       │   ├── Chat/
│   │       │   │   ├── ChatPanel.tsx
│   │       │   │   └── ChatMessage.tsx
│   │       │   ├── Queue/
│   │       │   │   ├── QueuePanel.tsx
│   │       │   │   └── QueueItem.tsx
│   │       │   └── Search/
│   │       │       ├── SearchBar.tsx
│   │       │       └── TrackCard.tsx
│   │       ├── pages/
│   │       │   ├── HomePage.tsx
│   │       │   └── RoomPage.tsx
│   │       ├── api/
│   │       │   └── jamendo.ts       # Typed API client → backend proxy
│   │       └── lib/
│   │           ├── syncMath.ts      # Drift calculation logic
│   │           └── sanitize.ts      # DOMPurify wrapper
│   │
│   └── backend/
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env.example
│       └── src/
│           ├── index.ts             # Express + WS server entry
│           ├── routes/
│           │   ├── jamendo.ts       # Proxy to Jamendo REST API
│           │   └── auth.ts          # Supabase auth validation
│           ├── ws/
│           │   ├── server.ts        # WebSocket upgrade handler
│           │   ├── roomManager.ts   # In-memory room lifecycle
│           │   └── messageSchema.ts # Zod validation schemas
│           ├── middleware/
│           │   ├── rateLimiter.ts   # express-rate-limit config
│           │   └── authMiddleware.ts # JWT verification
│           └── lib/
│               └── supabase.ts      # Supabase client init
```

---

## 14. Out of Scope (v1.1)

- Persistent chat history (messages are ephemeral)
- Mobile native apps (iOS / Android)
- Offline / PWA mode
- User-uploaded audio files (Jamendo catalog only)
- Multi-node / clustered WebSocket (single-node in-memory state)
- Paid tier or subscription management
- Social follow / friend system
- Record labels / DMCA-protected content

---

## 15. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Should anonymous (non-authed) users be allowed to join rooms as listeners in v1.1? | Product | **Open** |
| 2 | Is Supabase Auth sufficient or do we need custom OAuth providers (Google, GitHub)? | Engineering | **Open** |
| 3 | What is the maximum number of members per Jam Room? | Product | **Open — suggest 50** |
| 4 | Should room codes be case-insensitive? | Engineering | **Open — recommend yes** |
| 5 | Do we need persistent user profiles (avatar, display name) in Supabase? | Product | **Open** |
