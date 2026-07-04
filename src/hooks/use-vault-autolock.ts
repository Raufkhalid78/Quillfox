import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/app-store'

export function useVaultAutolock() {
  const currentUser = useAppStore((s) => s.currentUser)
  const isVaultLocked = useAppStore((s) => s.isVaultLocked)
  const vaultAutoLock = useAppStore((s) => s.vaultAutoLock)
  const vaultLockTimeout = useAppStore((s) => s.vaultLockTimeout)
  const lockVault = useAppStore((s) => s.lockVault)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!currentUser || !vaultAutoLock || isVaultLocked) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      return
    }

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      const timeoutMs = vaultLockTimeout * 60 * 1000
      timerRef.current = setTimeout(() => {
        lockVault()
      }, timeoutMs)
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'click', 'touchstart']

    events.forEach((event) => {
      window.addEventListener(event, resetTimer)
    })

    resetTimer()

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [currentUser, vaultAutoLock, vaultLockTimeout, isVaultLocked, lockVault])
}
