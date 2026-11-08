import { describe, expect, it } from 'vitest'
import { createTranslator, formatDuration, pickLanguage } from '../src/localize'
import en from '../src/translations/en.json'
import itCatalogue from '../src/translations/it.json'
import pt from '../src/translations/pt.json'

describe('pickLanguage', () => {
  it('config wins over hass\'s language', () => {
    expect(pickLanguage('pt', 'en')).toBe('pt')
  })
  it('uses hass\'s language when the config does not set one', () => {
    expect(pickLanguage(undefined, 'pt')).toBe('pt')
  })
  it('reduces a regional tag to the base language', () => {
    expect(pickLanguage(undefined, 'pt-PT')).toBe('pt')
  })
  it('picks Italian from Home Assistant, including a regional tag', () => {
    expect(pickLanguage(undefined, 'it')).toBe('it')
    expect(pickLanguage(undefined, 'it-IT')).toBe('it')
  })
  it('falls back to English for a language without a catalog', () => {
    expect(pickLanguage(undefined, 'de')).toBe('en')
  })
  it('falls back to English with no information at all', () => {
    expect(pickLanguage(undefined, undefined)).toBe('en')
  })
})

describe('createTranslator', () => {
  it('translates to Italian', () => {
    expect(createTranslator('it')('openings.all_closed')).toBe('Tutto chiuso')
    expect(createTranslator('it')('charging.title', { percent: 64 })).toBe('Carica al 64%')
  })
  it('translates to Portuguese', () => {
    expect(createTranslator('pt')('openings.all_closed')).toBe('Tudo fechado')
  })
  it('translates to English', () => {
    expect(createTranslator('en')('openings.all_closed')).toBe('All closed')
  })
  it('interpolates variables', () => {
    expect(createTranslator('pt')('charging.title', { percent: 60 })).toBe('Carregado a 60%')
  })
  it('leaves the placeholder literal when the variable is missing', () => {
    expect(createTranslator('pt')('charging.title')).toBe('Carregado a {percent}%')
  })
  it('returns the key itself when no catalog has a translation', () => {
    expect(createTranslator('pt')('nao.existe')).toBe('nao.existe')
  })
})

describe('formatDuration', () => {
  const pt = createTranslator('pt')
  const en = createTranslator('en')

  it('formats hours and minutes like the app does', () => {
    // 835 min = 13h 55min, the value from the screenshot
    expect(formatDuration(835, pt)).toBe('13h e 55min')
    expect(formatDuration(835, en)).toBe('13h 55min')
  })
  it('formats only hours when the minutes are zero', () => {
    expect(formatDuration(120, pt)).toBe('2h')
  })
  it('formats only minutes below one hour', () => {
    expect(formatDuration(45, pt)).toBe('45min')
  })
  it('formats zero as 0min', () => {
    expect(formatDuration(0, pt)).toBe('0min')
  })
})

/**
 * Flattens a catalog into complete dot-separated paths.
 *
 * Today's keys are already flat (`"comfort.mirrors"` is a single key, not two
 * levels), but the format Home Assistant uses is nested, and it takes only
 * someone nesting a branch for a top-level key comparison to start lying:
 * `comfort` would exist on both sides, and the absence of `comfort.mirrors` on
 * one of them would go unnoticed. That's why the whole tree is walked, and it
 * is the complete path that gets compared.
 */
function flattenKeys(node: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value !== null && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path]
  })
}

describe('translation catalogs', () => {
  /*
   * There was no test at all comparing the two catalogs. The 115 names
   * matched only because everyone who touched them was careful: a new key
   * written in only one of the files would still compile, still pass the
   * tests, and the user of the other language would see the English text —
   * or, if the key was missing from `en` too, would see the key itself,
   * because that's what `createTranslator` returns when neither the primary
   * catalog nor the fallback one has it.
   */
  it('en, pt and it have exactly the same keys', () => {
    const enKeys = flattenKeys(en).sort()
    for (const [name, catalogue] of Object.entries({ pt, it: itCatalogue })) {
      const keys = new Set(flattenKeys(catalogue))
      const missing = enKeys.filter(key => !keys.has(key))
      const extra = [...keys].filter(key => !enKeys.includes(key)).sort()
      // The message NAMES the keys on each side: whoever breaks parity
      // needs to know which ones, not just that the counts differ.
      expect({ missing, extra }, `${name}.json — missing: ${missing.join(', ') || '(none)'}; extra: ${extra.join(', ') || '(none)'}`)
        .toEqual({ missing: [], extra: [] })
    }
  })

  it('no catalogue is empty', () => {
    expect(flattenKeys(en).length).toBeGreaterThan(50)
  })

  it('every key the source asks for exists in the English catalogue', () => {
    // The source reads keys as literals (`t('group.climate')`) or builds the
    // ones that follow a fixed pattern (`action.${id}`): both are covered
    // here, so a renamed key cannot leave a dashboard printing the raw key.
    const enKeys = new Set(flattenKeys(en))
    const wanted = [
      'group.charging', 'group.status', 'group.climate', 'group.tires', 'group.trip', 'group.location',
      'action.quickVentilation', 'action.climateOff', 'action.driverSeatHeat', 'action.driverSeatVent',
      'action.passengerSeatHeat', 'action.passengerSeatVent', 'climate.hint', 'trip.odometer', 'trip.outside_temp',
      'error.not_found', 'error.unknown_device', 'error.ambiguous',
    ]
    expect(wanted.filter(key => !enKeys.has(key))).toEqual([])
  })
})
