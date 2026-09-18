import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client.
 *
 * Uses @supabase/ssr so that the auth session lives in cookies (managed and
 * refreshed by middleware + server routes) rather than localStorage. This
 * limits the blast radius of XSS-based token theft.
 *
 * The two public env vars are inlined at build time by Next.js. We validate
 * them lazily so a missing value surfaces as a clear runtime error instead of
 * silently pointing at a placeholder project.
 */
function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  return { url, anonKey }
}

let client: ReturnType<typeof createBrowserClient> | null = null

function getClient() {
  if (!client) {
    const { url, anonKey } = config()
    client = createBrowserClient(url, anonKey)
  }
  return client
}

/**
 * Proxy keeps the existing `supabase.from(...)` / `supabase.auth...` call sites
 * working while deferring client creation until first access.
 */
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver)
  },
})