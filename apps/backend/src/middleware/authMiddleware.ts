import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/supabase.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
  }
}

/**
 * Middleware that requires a valid Supabase JWT in the Authorization header.
 * Attaches the decoded user to req.user on success.
 * Returns 401 if the token is missing or invalid.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authorization header with Bearer token is required.',
    })
    return
  }

  const token = authHeader.slice(7) // Remove "Bearer "

  const user = await verifyToken(token)

  if (!user) {
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'The provided token is invalid or has expired.',
    })
    return
  }

  req.user = { id: user.id, email: user.email }
  next()
}

/**
 * Optional auth middleware — attaches user if token present, but does not block.
 * Use for endpoints that support both authenticated and anonymous access.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (user) {
      req.user = { id: user.id, email: user.email }
    }
  }

  next()
}
