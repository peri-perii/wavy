import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authRateLimiter } from '../middleware/rateLimiter.js'
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js'

const router = Router()

/**
 * POST /api/auth/signup
 * Register a new user via Supabase Auth.
 */
router.post('/signup', authRateLimiter, async (req: Request, res: Response) => {
  const { email, password, username } = req.body as {
    email?: string
    password?: string
    username?: string
  }

  if (!email || !password || !username) {
    res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'email, password, and username are required.',
    })
    return
  }

  if (typeof email !== 'string' || typeof password !== 'string' || typeof username !== 'string') {
    res.status(400).json({ error: 'INVALID_FIELDS', message: 'All fields must be strings.' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' })
    return
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { username },
    email_confirm: true, // Skip email confirmation for self-hosted
  })

  if (error) {
    res.status(400).json({ error: 'SIGNUP_FAILED', message: error.message })
    return
  }

  res.status(201).json({
    message: 'Account created successfully.',
    user: { id: data.user.id, email: data.user.email },
  })
})

/**
 * POST /api/auth/login
 * Sign in via Supabase Auth and return the session tokens.
 */
router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'email and password are required.',
    })
    return
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    res.status(401).json({ error: 'LOGIN_FAILED', message: 'Invalid email or password.' })
    return
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email,
      username: data.user.user_metadata.username,
    },
  })
})

/**
 * GET /api/auth/me
 * Return current authenticated user profile.
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id

  const { data, error } = await supabase.auth.admin.getUserById(userId)

  if (error || !data.user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found.' })
    return
  }

  res.json({
    id: data.user.id,
    email: data.user.email,
    username: data.user.user_metadata.username,
    created_at: data.user.created_at,
  })
})

/**
 * POST /api/auth/logout
 * Sign the user out (invalidate the session on the Supabase side).
 */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization!
  const token = authHeader.slice(7)

  // Sign out the user's JWT
  const { error } = await supabase.auth.admin.signOut(token)

  if (error) {
    res.status(500).json({ error: 'LOGOUT_FAILED', message: error.message })
    return
  }

  res.json({ message: 'Logged out successfully.' })
})

export default router
