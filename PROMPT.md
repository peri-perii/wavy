You are an elite Full-Stack Engineer and Application Security Architect. Your task is to build "OpenWave", an open-source music streaming and synchronized listening platform, based strictly on the provided specifications from "OpenWave_PRD_v1.1.docx". 

You must deliver a complete, working codebase including the Frontend, Backend, Real-Time Synchronization layer, and an automated Security Self-Audit.

### 1. APPLICATION ARCHITECTURE & TECH STACK
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, and Zustand (State Management).
- Backend: Node.js, Express, TypeScript, and the 'ws' library or 'Socket.io' for real-time bidirectional messaging.
- Data & Auth Layer: Integration endpoints for Jamendo REST API and Supabase (Auth + Postgres metadata).
- Monorepo Structure: Organize the project as a clean monorepo:
  ├── apps/
  │   ├── frontend/ (Vite + React app)
  │   └── backend/  (Node.js + Express + WS server)
  └── package.json

### 2. CORE IMPLEMENTATION STEPS
Execute these phases comprehensively, implementing actual logic (not just comments):
- Phase 1: Core Player & API Gateway: Build the HTML5 music player state engine using Zustand. Set up the backend Express server to proxy Jamendo REST API calls to protect client-side environments.
- Phase 2: WebSocket Jam Room Engine: Implement the server-side in-memory room lifecycle logic (Create, Join, 60s Grace Period for host disconnect). Write the client-side synchronization math:
  Expected Position = position_ms + (Date.now() - host_timestamp)
  Enforce local audio adjustment/seeking only if the calculated drift delta exceeds 500ms.
- Phase 3: Collaborative Features: Build the ephemeral live chat layout and the track queue voting system (where hosts have exclusive rights to accept upvoted tracks).

### 3. STRICT ENVIRONMENT SECURE RUNTIME MANDATE (NO HARDCODING)
- You are strictly forbidden from hardcoding any secret tokens, database credentials, or API keys (e.g., Jamendo API Keys, Supabase URL/Keys, JWT Secrets).
- For the backend, utilize `dotenv` to load configurations strictly from process.env. Provide a `.env.example` file explicitly documenting all required variables.
- Prompt the user directly in your response chat to provide their local API keys, and write instructions on how to dynamically plug them into their local environment variables file.

### 4. AUTOMATED RUNTIME SECURITY AUDIT & SELF-CORRECTION
Before finalizing the codebase, act as an automated security scanner. Run a comprehensive mental static application security testing (SAST) review on the code you have just written. Specifically audit and self-correct the following vectors:
1. Environment Leakage: Check to ensure no credentials bypassed your environment system.
2. Prototype Pollution & Injection: Ensure WebSocket message payloads (`JSON.parse`) are strictly validated against an expected runtime schema (e.g., matching required track_id, position_ms types) to prevent arbitrary malicious execution.
3. Denial of Service (DoS): Add a baseline rate-limiter wrapper to the Express API proxy routes and standard debounce logic to search endpoints to protect the Jamendo 50,000 free-tier calls per day.
4. XSS in Chat: Sanitize message payloads in the ephemeral Jam Room chat before injecting them into the DOM.

If your audit catches any bugs, vulnerabilities, or sub-optimal patterns in your initial implementation, explicitly list the vulnerability caught and refactor your code immediately to solve it on your own.

Begin by setting up the project directory layouts, scaffolding the configurations, and prompting me for my specific API environment credentials.