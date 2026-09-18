'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0b0f14',
          color: '#f7f8f8',
        }}
      >
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Application error</h1>
          <p style={{ opacity: 0.7, marginTop: 8 }}>
            A critical error occurred. Please reload the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}