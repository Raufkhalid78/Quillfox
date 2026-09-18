import { normalizeTier, getPlanLimits, isAtLimit, formatLimit, PLAN_LIMITS } from '../plans'

describe('plans', () => {
  it('normalizes legacy and unknown tiers', () => {
    expect(normalizeTier('free')).toBe('free')
    expect(normalizeTier('premium')).toBe('premium')
    expect(normalizeTier('ultra')).toBe('ultra')
    expect(normalizeTier('ultra_premium')).toBe('ultra')
    expect(normalizeTier('pro')).toBe('ultra')
    expect(normalizeTier(null)).toBe('free')
    expect(normalizeTier('nonsense')).toBe('free')
  })

  it('returns the canonical limits per tier', () => {
    expect(getPlanLimits('free')).toEqual(PLAN_LIMITS.free)
    expect(getPlanLimits('premium').notes).toBe('unlimited')
    expect(getPlanLimits('ultra').workspaces).toBe('unlimited')
    expect(getPlanLimits('free').collaborators).toBe(2)
    expect(getPlanLimits('premium').collaborators).toBe(15)
    expect(getPlanLimits('ultra').collaborators).toBe(35)
  })

  it('isAtLimit respects unlimited limits', () => {
    expect(isAtLimit(9, 10)).toBe(false)
    expect(isAtLimit(10, 10)).toBe(true)
    expect(isAtLimit(11, 10)).toBe(true)
    expect(isAtLimit(9999, 'unlimited')).toBe(false)
  })

  it('formats limits for display', () => {
    expect(formatLimit(10)).toBe('10')
    expect(formatLimit('unlimited')).toBe('Unlimited')
  })
})
