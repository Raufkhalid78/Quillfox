/**
 * Canonical plan limits for QuillFox.
 *
 * This is the single client-side source of truth for entitlement limits. The
 * database enforces the same numbers (see
 * `quillfox-shared/migrations/007_entitlement_limits.sql`); if you change a
 * value here, change it there too.
 */

export type Tier = 'free' | 'premium' | 'ultra'

export interface PlanLimits {
  /** Max notes (live, non-archived, non-deleted) a user may own. */
  notes: number | 'unlimited'
  /** Max todo lists a user may own. */
  todoLists: number | 'unlimited'
  /** Max workspaces a user may own. */
  workspaces: number | 'unlimited'
  /** Max members per workspace (owner included), before extra seats. */
  collaborators: number
  /** Max number of notes that may have attachments. */
  attachmentNotes: number | 'unlimited'
  /** Max attachments on a single note. */
  attachmentsPerNote: number
  /** Max size of a single attachment, in megabytes. */
  attachmentSizeMb: number
}

export const PLAN_LIMITS: Record<Tier, PlanLimits> = {
  free: {
    notes: 10,
    todoLists: 3,
    workspaces: 1,
    collaborators: 2,
    attachmentNotes: 2,
    attachmentsPerNote: 5,
    attachmentSizeMb: 5,
  },
  premium: {
    notes: 'unlimited',
    todoLists: 'unlimited',
    workspaces: 10,
    collaborators: 15,
    attachmentNotes: 'unlimited',
    attachmentsPerNote: 5,
    attachmentSizeMb: 5,
  },
  ultra: {
    notes: 'unlimited',
    todoLists: 'unlimited',
    workspaces: 'unlimited',
    collaborators: 35,
    attachmentNotes: 'unlimited',
    attachmentsPerNote: 5,
    attachmentSizeMb: 5,
  },
}

/** Map the raw profile tier (which may be 'ultra_premium' or legacy values). */
export function normalizeTier(raw: string | null | undefined): Tier {
  if (raw === 'premium') return 'premium'
  if (raw === 'ultra' || raw === 'ultra_premium' || raw === 'pro') return 'ultra'
  return 'free'
}

export function getPlanLimits(tier: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[normalizeTier(tier)]
}

export function isUnlimited(value: number | 'unlimited'): value is 'unlimited' {
  return value === 'unlimited'
}

/** Human-readable limit, e.g. `'10'` or `'Unlimited'`. */
export function formatLimit(value: number | 'unlimited'): string {
  return isUnlimited(value) ? 'Unlimited' : String(value)
}

/**
 * Returns true when `count` has already reached `limit`. Unlimited limits never
 * block. Use with a `>=` comparison at the point of creation.
 */
export function isAtLimit(count: number, limit: number | 'unlimited'): boolean {
  return !isUnlimited(limit) && count >= limit
}
