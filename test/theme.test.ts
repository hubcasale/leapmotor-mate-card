import { describe, expect, it } from 'vitest'
import { tintColor } from '../src/theme'

describe('tintColor', () => {
  it('follows the theme for a name from Home Assistant\'s palette', () => {
    expect(tintColor('blue')).toBe('var(--blue-color, #2196f3)')
    expect(tintColor('deep-purple')).toBe('var(--deep-purple-color, #6e41ab)')
  })

  it('follows the theme\'s own primary and accent colours', () => {
    expect(tintColor('primary')).toBe('var(--primary-color)')
    expect(tintColor('accent')).toBe('var(--accent-color)')
  })

  it('lets a colour written by hand in the YAML through', () => {
    expect(tintColor('#7E57C2')).toBe('#7e57c2')
    expect(tintColor(' rgb(126, 87, 194) ')).toBe('rgb(126, 87, 194)')
    expect(tintColor('rgba(126,87,194,0.5)')).toBe('rgba(126,87,194,0.5)')
  })

  it('tints nothing when there is no colour, or the picker says none', () => {
    for (const none of [undefined, null, '', '  ', 'none', 'default']) expect(tintColor(none), String(none)).toBeUndefined()
  })

  it('tints nothing for what is not a colour', () => {
    for (const bad of [42, ['blue'], 'bluish', 'red; background: url(x)', 'var(--x)', '#12', 'rgb(1,2,3); x']) {
      expect(tintColor(bad), String(bad)).toBeUndefined()
    }
  })
})
