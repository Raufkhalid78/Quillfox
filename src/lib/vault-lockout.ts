import { supabase } from './supabase'

/**
 * Server-backed vault lockout helpers. All operations are best-effort: if the
 * RPCs are unavailable (e.g. migrations not yet applied) the client falls back
 * to its local lockout state so unlocking never hard-fails.
 */

export async function getVaultLockoutUntil(): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('get_vault_lockout_status')
    if (error || !data) return null
    const until = new Date(data as string).getTime()
    return Number.isFinite(until) && until > Date.now() ? until : null
  } catch {
    return null
  }
}

/** Records a failed unlock and returns the new lockout expiry (ms) if locked. */
export async function registerVaultFailure(): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('register_vault_failure')
    if (error || !data) return null
    const until = new Date(data as string).getTime()
    return Number.isFinite(until) && until > Date.now() ? until : null
  } catch {
    return null
  }
}

export async function clearVaultFailures(): Promise<void> {
  try {
    await supabase.rpc('clear_vault_failures')
  } catch {
    // best-effort
  }
}