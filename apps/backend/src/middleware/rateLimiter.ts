import rateLimit from 'express-rate-limit'

/**
 * General API proxy rate limiter.
 * 100 requests per 15 minutes per IP.
 * Protects the Jamendo 50,000/day free tier limit.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'You have exceeded the rate limit. Please try again in 15 minutes.',
  },
  handler: (req, res, _next, options) => {
    res.status(options.statusCode).json(options.message)
  },
})

/**
 * Strict rate limiter for search endpoints.
 * 30 requests per minute per IP to protect against rapid bursts.
 */
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'SEARCH_RATE_LIMIT',
    message: 'Too many search requests. Please slow down.',
  },
  handler: (req, res, _next, options) => {
    res.status(options.statusCode).json(options.message)
  },
})

/**
 * Auth route rate limiter.
 * 20 requests per 15 minutes per IP to prevent brute-force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AUTH_RATE_LIMIT',
    message: 'Too many authentication attempts. Please try again later.',
  },
  handler: (req, res, _next, options) => {
    res.status(options.statusCode).json(options.message)
  },
})
