// Simple in-memory rate limiter for API routes
// Uses sliding window per IP address

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
const WINDOW_MS = 60 * 1000 // 1 minute window

let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given identifier (e.g., IP address)
 * @param key - Unique identifier (usually IP address)
 * @param limit - Max requests per window
 * @returns { success, remaining, resetAt }
 */
export function rateLimit(key: string, limit: number = 60): RateLimitResult {
  cleanup()

  const now = Date.now()
  const entry = store.get(key)

  if (!entry) {
    store.set(key, { timestamps: [now] })
    return { success: true, remaining: limit - 1, resetAt: now + WINDOW_MS }
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0]
    return {
      success: false,
      remaining: 0,
      resetAt: oldestInWindow + WINDOW_MS,
    }
  }

  entry.timestamps.push(now)
  return {
    success: true,
    remaining: limit - entry.timestamps.length,
    resetAt: now + WINDOW_MS,
  }
}

/**
 * Helper to extract IP from NextRequest
 */
export function getClientIp(req: Request): string {
  // Check common proxy headers
  const headers = new Headers(req.headers)
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  // Fallback
  return 'unknown'
}
