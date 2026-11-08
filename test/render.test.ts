// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import type { HomeAssistant } from '../src/ha-types'
import { MATE_NOW, mateHass } from './fixtures/mate-states'

/**
 * Renders the real card in a DOM against the Mate fixture. The unit tests
 * check the logic; this one checks that the pieces are wired together:
 * every custom element the card uses exists, every tag closes, and the
 * silhouette, the grid and the sub-views come out.
 */
type CardEl = HTMLElement & { hass: HomeAssistant; setConfig(c: Record<string, unknown>): void; updateComplete: Promise<boolean> }

/** Lets the card and every Lit element inside it finish rendering, however deep. */
async function settle(root: HTMLElement): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await new Promise(r => setTimeout(r, 0))
    const all = [root, ...deepEls(root)]
    await Promise.all(all.map(e => (e as CardEl).updateComplete))
  }
}
const deepEls = (root: Element | ShadowRoot): Element[] => {
  const base: ParentNode = (root as Element).shadowRoot ?? root
  const out: Element[] = []
  for (const el of base.querySelectorAll('*')) { out.push(el); out.push(...deepEls(el)) }
  return out
}

async function mount(config: Record<string, unknown> = {}, overrides: Record<string, string | null> = {}): Promise<CardEl> {
  const el = document.createElement('leapmotor-mate-card') as unknown as CardEl
  document.body.appendChild(el)
  el.setConfig({ type: 'custom:leapmotor-mate-card', language: 'en', ...config })
  el.hass = mateHass(overrides)
  await settle(el)
  return el
}

const deep = (root: ParentNode | ShadowRoot, sel: string): Element[] => {
  const out: Element[] = [...root.querySelectorAll(sel)]
  for (const el of root.querySelectorAll('*')) if (el.shadowRoot) out.push(...deep(el.shadowRoot, sel))
  return out
}

beforeAll(async () => {
  Object.defineProperty(window, 'loadCardHelpers', { value: async () => ({ createCardElement: async () => document.createElement('div') }) })
  await import('../src/leapmotor-mate-card')
  await import('../src/leapmotor-mate-card-editor')
})

describe('the card in a DOM', () => {
  it('registers itself and its editor', () => {
    expect(customElements.get('leapmotor-mate-card')).toBeDefined()
    expect(customElements.get('leapmotor-mate-card-editor')).toBeDefined()
  })

  it('renders the hero with the car drawing and the six group tiles', async () => {
    const el = await mount()
    expect(el.shadowRoot!.querySelector('ha-card')).not.toBeNull()
    const hero = deep(el.shadowRoot!, 'leapmotor-mate-hero')[0] as HTMLElement
    expect(hero).toBeDefined()
    expect(hero.shadowRoot!.querySelector('svg[part="silhouette"]')).not.toBeNull()
    const grid = deep(el.shadowRoot!, 'leapmotor-mate-group-grid')[0]!
    expect(grid.shadowRoot!.querySelectorAll('button').length).toBe(6)
  })

  it('shows the car\'s own picture from Mate when mate_url is set, and the drawing otherwise', async () => {
    const withUrl = await mount({ mate_url: 'http://192.168.1.10:4000/' })
    const hero = deep(withUrl.shadowRoot!, 'leapmotor-mate-hero')[0] as HTMLElement
    expect(hero.shadowRoot!.querySelector('img')?.getAttribute('src')).toBe('http://192.168.1.10:4000/api/car-picture')
    const without = await mount()
    const hero2 = deep(without.shadowRoot!, 'leapmotor-mate-hero')[0] as HTMLElement
    expect(hero2.shadowRoot!.querySelector('img')).toBeNull()
    expect(hero2.shadowRoot!.querySelector('svg[part="silhouette"]')).not.toBeNull()
  })

  it('names the missing entities and where it looked for them', async () => {
    const el = await mount({}, { 'lock/door_lock': null })
    const missing = el.shadowRoot!.querySelector('.missing') as HTMLElement
    expect(missing.textContent).toContain('lock')
    expect(missing.getAttribute('title')).toContain('lock: lock.leapmotor_mate_5r1234_door_lock')
  })

  it('shows the action row with the buttons Mate publishes', async () => {
    const el = await mount()
    const row = deep(el.shadowRoot!, 'leapmotor-mate-actions-row')[0] as HTMLElement
    expect(row.shadowRoot!.querySelectorAll('button').length).toBeGreaterThanOrEqual(5)
  })

  it('shows an error asking to turn MQTT on when there is no Mate entity', async () => {
    const el = document.createElement('leapmotor-mate-card') as unknown as CardEl
    document.body.appendChild(el)
    el.setConfig({ type: 'custom:leapmotor-mate-card', language: 'en' })
    el.hass = { ...mateHass(), states: {} } as HomeAssistant
    await el.updateComplete
    expect(el.shadowRoot!.textContent).toContain('MQTT')
  })

  it('opens every sub-view without leaving an unknown element behind', async () => {
    for (const group of ['charging', 'status', 'climate', 'tires', 'trip', 'location']) {
      const el = await mount({ default_group: group })
      const tile = deep(el.shadowRoot!, 'leapmotor-mate-group-grid')[0]!.shadowRoot!.querySelectorAll('button')
      expect(tile.length, group).toBeGreaterThan(0)
    }
    const el = await mount()
    const grid = deep(el.shadowRoot!, 'leapmotor-mate-group-grid')[0]!
    const tiles = [...grid.shadowRoot!.querySelectorAll('button')] as HTMLElement[]
    for (const tile of tiles) {
      tile.click()
      await settle(el)
      const detail = deep(el.shadowRoot!, 'leapmotor-mate-group-detail')[0]
      expect(detail, 'a sub-view opens').toBeDefined()
      // every custom element used inside must be a defined one
      const unknown = deep(el.shadowRoot!, '*').filter(n => n.localName.startsWith('leapmotor-') && !customElements.get(n.localName))
      expect(unknown.map(n => n.localName)).toEqual([])
      ;(detail!.shadowRoot!.querySelector('button.close, [part="close"], button') as HTMLElement | null)?.click()
      await settle(el)
    }
    expect(MATE_NOW).toBeDefined()
  })
})
