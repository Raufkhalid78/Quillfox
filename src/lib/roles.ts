/**
 * Workspace role helpers. Mirrors the server-side `can_edit_workspace()`
 * function in `quillfox-shared/migrations/005_backend_hardening.sql`.
 */

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'member'

const EDIT_ROLES: WorkspaceRole[] = ['owner', 'admin', 'editor']
const ADMIN_ROLES: WorkspaceRole[] = ['owner', 'admin']

export function normalizeRole(role: string | null | undefined): WorkspaceRole {
  if (role === 'owner' || role === 'admin' || role === 'editor' || role === 'viewer' || role === 'member') {
    return role
  }
  return 'viewer'
}

/** Whether the role may modify workspace content (notes/todos). */
export function canEditWorkspace(role: string | null | undefined): boolean {
  return EDIT_ROLES.includes(normalizeRole(role))
}

/** Whether the role may manage members/invites and workspace settings. */
export function isWorkspaceAdmin(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes(normalizeRole(role))
}

/**
 * Resolves the signed-in user's role in a workspace from its member list.
 * The workspace owner is always treated as `owner` even if the membership row
 * is missing or stale.
 */
export function resolveMyRole(
  members: Array<{ userId: string; role: string }>,
  userId: string | null | undefined,
  ownerId?: string | null
): WorkspaceRole | null {
  if (!userId) return null
  if (ownerId && ownerId === userId) return 'owner'
  const mine = members.find((m) => m.userId === userId)
  return mine ? normalizeRole(mine.role) : null
}