import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { createWsServer } from './ws/server.js'
import tracksRoutes, { initializeDynamicMusicPools } from './routes/tracks.js'
import authRoutes from './routes/auth.js'

// ─── Environment Validation ───────────────────────────────────────────────────
const REQUIRED_ENV_VARS = [
  'JAMENDO_CLIENT_ID',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'CORS_ORIGIN',
]

const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v])
if (missingVars.length > 0) {
  console.error(
    `[Wavy] ❌ Missing required environment variables:\n  ${missingVars.join('\n  ')}\n` +
    '  Copy apps/backend/.env.example to apps/backend/.env and fill in your values.'
  )
  process.exit(1)
}

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express()
const PORT = Number(process.env.PORT ?? 3001)
const CORS_ORIGIN = process.env.CORS_ORIGIN!

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  )
  next()
})

app.use(express.json({ limit: '32kb' })) // Limit request body size

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', tracksRoutes)
app.use('/api/auth', authRoutes)

// Health check — never rate limited
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'openwave-backend', timestamp: Date.now() })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found.' })
})

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Wavy] Unhandled error:', err.message)
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' })
})

// ─── HTTP + WebSocket Server ──────────────────────────────────────────────────
const server = http.createServer(app)
createWsServer(server)

// Spin up background registry discovery sync
initializeDynamicMusicPools().then(() => {
  console.log('🚀 Wavy Core Stream Engine successfully stabilized and active.')
})

server.listen(PORT, () => {
  console.log(`\n🌊 Wavy Backend running at:`)
  console.log(`   HTTP  → http://localhost:${PORT}`)
  console.log(`   WS    → ws://localhost:${PORT}`)
  console.log(`   CORS  → ${CORS_ORIGIN}`)
  console.log(`   Env   → ${process.env.NODE_ENV ?? 'development'}\n`)
})

export { server }
// Triggering dev server reload to pick up new .env variables

