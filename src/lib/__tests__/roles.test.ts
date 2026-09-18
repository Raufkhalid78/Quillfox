import { normalizeRole, canEditWorkspace, isWorkspaceAdmin, resolveMyRole } from '../roles'

describe('roles', () => {
  it('normalizes unknown roles to viewer', () => {
    expect(normalizeRole('owner')).toBe('owner')
    expect(normalizeRole('editor')).toBe('editor')
    expect(normalizeRole('nonsense')).toBe('viewer')
    expect(normalizeRole(null)).toBe('viewer')
  })

  it('allows only owner/admin/editor to edit content', () => {
    expect(canEditWorkspace('owner')).toBe(true)
    expect(canEditWorkspace('admin')).toBe(true)
    expect(canEditWorkspace('editor')).toBe(true)
    expect(canEditWorkspace('member')).toBe(false)
    expect(canEditWorkspace('viewer')).toBe(false)
  })

  it('identifies admins', () => {
    expect(isWorkspaceAdmin('owner')).toBe(true)
    expect(isWorkspaceAdmin('admin')).toBe(true)
    expect(isWorkspaceAdmin('editor')).toBe(false)
  })

  it('resolves the current user role, preferring ownership', () => {
    const members = [
      { userId: 'u1', role: 'viewer' },
      { userId: 'u2', role: 'editor' },
    ]
    expect(resolveMyRole(members, 'u1')).toBe('viewer')
    expect(resolveMyRole(members, 'u2')).toBe('editor')
    expect(resolveMyRole(members, 'owner-id', 'owner-id')).toBe('owner')
    expect(resolveMyRole(members, 'nobody')).toBeNull()
  })
})
