'use client'

import { useEffect } from 'react'
import { applyLocaleToDocument } from '@/lib/i18n'

/** Applies the detected locale (and RTL direction) to the document. */
export function LocaleProvider() {
  useEffect(() => {
    applyLocaleToDocument()
  }, [])
  return null
}
