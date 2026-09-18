import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client using cookies for session storage.
 *
 * Sessions are persisted in httpOnly-capable cookies managed by @supabase/ssr
 * (refreshed in middleware) instead of localStorage, reducing XSS token theft.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}