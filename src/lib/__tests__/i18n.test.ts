import { t, setLocale, getLocale, messages } from '../i18n'

describe('i18n', () => {
  afterEach(() => setLocale('en'))

  it('returns the message for a known key', () => {
    expect(t('common.search')).toBe('Search')
  })

  it('interpolates variables', () => {
    expect(t('search.noResults')).toBe('No matches found.')
  })

  it('falls back to the key when missing', () => {
    // @ts-expect-error deliberately unknown key
    expect(t('does.not.exist')).toBe('does.not.exist')
  })

  it('exposes an English catalog', () => {
    expect(Object.keys(messages.en).length).toBeGreaterThan(0)
    expect(getLocale()).toBe('en')
  })
})