import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = ['/dashboard']

/** Routes an authenticated user should be redirected away from. */
const AUTH_ROUTES = ['/auth']

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Build an enforced Content-Security-Policy.
 *
 * - Scripts are locked to nonce + strict-dynamic (no wildcard hosts).
 * - object/base/frame-ancestors are locked down.
 * - A report endpoint can be added via CSP_REPORT_URI when available.
 */
function buildCsp(nonce: string) {
  const reportUri = process.env.CSP_REPORT_URI
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https://*.supabase.co`,
    `font-src 'self' data:`,
    `connect-src 'self' wss://*.supabase.co https://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ]
  if (reportUri) directives.push(`report-uri ${reportUri}`)
  return directives.join('; ')
}

function applySecurityHeaders(response: NextResponse, csp: string) {
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const { pathname } = request.nextUrl
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase isn't configured we cannot enforce auth; fail closed on
  // protected routes rather than serving them unprotected.
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    // IMPORTANT: getUser() refreshes the session and validates the token.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (isProtected(pathname) && !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      url.searchParams.set('redirect', pathname)
      const redirectResponse = NextResponse.redirect(url)
      applySecurityHeaders(redirectResponse, csp)
      return redirectResponse
    }

    if (isAuthRoute(pathname) && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      const redirectResponse = NextResponse.redirect(url)
      applySecurityHeaders(redirectResponse, csp)
      return redirectResponse
    }
  } else if (isProtected(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    const redirectResponse = NextResponse.redirect(url)
    applySecurityHeaders(redirectResponse, csp)
    return redirectResponse
  }

  applySecurityHeaders(response, csp)
  return response
}

export const config = {
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}