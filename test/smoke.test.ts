import { describe, expect, it } from 'vitest'
import pkg from '../package.json'
import cardSource from '../src/leapmotor-mate-card.ts?raw'

/**
 * The `1 + 1 === 2` that used to be here didn't distinguish any implementation.
 * This does: the version the card announces in the console and in the card
 * picker is a constant in `src/`, and the one HACS installs comes from
 * `package.json`. If the two drift apart — and they always drift when a bump
 * forgets one of the two sides — the user sees one version and gets another.
 */
describe('version', () => {
  it('CARD_VERSION matches the package.json version', () => {
    expect(cardSource).toContain(`export const CARD_VERSION = '${pkg.version}'`)
  })

  it('the version has the shape of a semantic version', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
