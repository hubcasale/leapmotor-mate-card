// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest'
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

describe('the confirmation, in the card', () => {
  const rowButton = (el: HTMLElement, label: string) => {
    const row = deep(el.shadowRoot!, 'leapmotor-mate-actions-row')[0] as HTMLElement
    return [...row.shadowRoot!.querySelectorAll('button')].find(b => b.textContent?.includes(label)) as HTMLButtonElement | undefined
  }
  const ask = (el: HTMLElement) => el.shadowRoot!.querySelector('.ask') as HTMLElement | null
  const askButtons = (el: HTMLElement) => [...el.shadowRoot!.querySelectorAll('.ask-btn')] as HTMLButtonElement[]
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

  async function mounted(config: Record<string, unknown> = {}) {
    const el = await mount(config)
    const calls: unknown[][] = []
    el.hass = { ...mateHass(), callService: vi.fn(async (...a: unknown[]) => { calls.push(a) }) } as unknown as HomeAssistant
    await settle(el)
    return { el, calls }
  }

  it('unlocking asks twice, and the car is only commanded after the second yes', async () => {
    const { el, calls } = await mounted()
    rowButton(el, 'Unlock')!.click()
    await settle(el)
    expect(ask(el)).not.toBeNull()
    expect(ask(el)!.textContent).toContain('Confirmation 1 of 2')
    expect(calls).toHaveLength(0)

    askButtons(el).find(b => b.classList.contains('go'))!.click()
    await settle(el)
    expect(ask(el)!.textContent).toContain('Second confirmation')
    expect(ask(el)!.textContent).toContain('This opens the car')
    const go = askButtons(el).find(b => b.classList.contains('go'))!
    // not armed yet: a double tap must not answer both questions
    expect(go.disabled).toBe(true)
    expect(calls).toHaveLength(0)

    await wait(800)
    await settle(el)
    const armed = askButtons(el).find(b => b.classList.contains('go'))!
    expect(armed.disabled).toBe(false)
    armed.click()
    await settle(el)
    expect(ask(el)).toBeNull()
    expect(calls).toEqual([['lock', 'unlock', {}, { entity_id: 'lock.leapmotor_mate_5r1234_door_lock' }]])
  })

  it('the second question puts "confirm" where "cancel" was', async () => {
    const { el } = await mounted()
    rowButton(el, 'Unlock')!.click()
    await settle(el)
    expect(askButtons(el).map(b => b.classList.contains('go'))).toEqual([false, true])
    askButtons(el)[1]!.click()
    await settle(el)
    expect(askButtons(el).map(b => b.classList.contains('go'))).toEqual([true, false])
  })

  it('cancelling at either question commands nothing', async () => {
    const { el, calls } = await mounted()
    rowButton(el, 'Unlock')!.click()
    await settle(el)
    askButtons(el).find(b => !b.classList.contains('go'))!.click()
    await settle(el)
    expect(ask(el)).toBeNull()

    rowButton(el, 'Unlock')!.click()
    await settle(el)
    askButtons(el).find(b => b.classList.contains('go'))!.click()
    await settle(el)
    askButtons(el).find(b => !b.classList.contains('go'))!.click()
    await settle(el)
    expect(ask(el)).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('locking does not ask at all', async () => {
    const { el, calls } = await mounted()
    rowButton(el, 'Lock')!.click()
    await settle(el)
    expect(ask(el)).toBeNull()
    expect(calls).toHaveLength(1)
  })

  it('draws the owner\'s sections under the owner\'s names', async () => {
    const { el } = await mounted({ action_sections: [{ title: 'Ogni giorno', actions: ['lock', 'findVehicle'] }, { title: 'Con attenzione', actions: ['unlock'] }] })
    const row = deep(el.shadowRoot!, 'leapmotor-mate-actions-row')[0] as HTMLElement
    expect([...row.shadowRoot!.querySelectorAll('.group-title')].map(n => n.textContent)).toEqual(['Ogni giorno', 'Con attenzione'])
    expect(row.shadowRoot!.querySelectorAll('button').length).toBe(3)
  })

  it('a function turned off has no button, in the row or in the status sub-view', async () => {
    const { el } = await mounted({ disabled_actions: ['unlock', 'trunk'] })
    expect(rowButton(el, 'Unlock')).toBeUndefined()
    expect(rowButton(el, 'Trunk')).toBeUndefined()
    expect(rowButton(el, 'Lock')).toBeDefined()
  })

  it('with the double list emptied, unlocking goes straight through', async () => {
    const { el, calls } = await mounted({ double_confirm_actions: [] })
    rowButton(el, 'Unlock')!.click()
    await settle(el)
    expect(ask(el)).toBeNull()
    expect(calls).toHaveLength(1)
  })
})

describe('the tap on the car', () => {
  const picture = (el: HTMLElement) => (deep(el.shadowRoot!, 'leapmotor-mate-hero')[0] as HTMLElement).shadowRoot!.querySelector('.image') as HTMLElement

  it('is plain when the card does not know where Mate is', async () => {
    expect(picture(await mount()).localName).toBe('div')
  })

  it('opens Mate when mate_url is set', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const el = await mount({ mate_url: 'https://mate.example.com' })
    expect(picture(el).localName).toBe('button')
    picture(el).click()
    expect(open).toHaveBeenCalledWith('https://mate.example.com', '_blank', 'noreferrer')
    open.mockRestore()
  })

  it('does what image_tap_action says instead, `none` included', async () => {
    const el = await mount({ mate_url: 'https://mate.example.com', image_tap_action: { action: 'none' } })
    expect(picture(el).localName).toBe('div')
  })
})

describe('the card\'s own colour', () => {
  it('keeps the theme\'s look when no colour is set', async () => {
    const el = await mount()
    expect(el.hasAttribute('tinted')).toBe(false)
    expect(el.style.getPropertyValue('--lm-tint')).toBe('')
  })

  it('carries the colour on the host, and drops it when the option goes away', async () => {
    const el = await mount({ color: 'amber' })
    expect(el.hasAttribute('tinted')).toBe(true)
    expect(el.style.getPropertyValue('--lm-tint')).toBe('var(--amber-color, #ffc107)')
    el.setConfig({ type: 'custom:leapmotor-mate-card', language: 'en' })
    expect(el.hasAttribute('tinted')).toBe(false)
    expect(el.style.getPropertyValue('--lm-tint')).toBe('')
  })

  it('ignores a value that is not a colour', async () => {
    const el = await mount({ color: 'red; display: none' })
    expect(el.hasAttribute('tinted')).toBe(false)
  })
})

describe('the editor', () => {
  it('lays the options out in sections, one per function, each field labelled', async () => {
    const ed = document.createElement('leapmotor-mate-card-editor') as unknown as HTMLElement & { hass: HomeAssistant; setConfig(c: unknown): void; updateComplete: Promise<unknown> }
    ed.setConfig({ type: 'custom:leapmotor-mate-card' })
    ed.hass = { ...mateHass(), locale: { language: 'it' } }
    document.body.appendChild(ed)
    await ed.updateComplete
    const form = ed.shadowRoot!.querySelector('ha-form') as unknown as {
      schema: { title: string; schema: { name: string; schema?: { name: string }[] }[] }[]
      computeLabel: (s: { name: string }) => string
      data: Record<string, unknown>
    }
    expect(form.schema.map(s => s.title)).toEqual(['Veicolo', 'Immagine e tocchi', 'Azioni rapide', 'Sicurezza', 'Pneumatici e mappa', 'Aspetto'])
    const names = form.schema.flatMap(s => s.schema.flatMap(f => (f.schema ? f.schema.map(g => g.name) : [f.name])))
    for (const name of names) expect(form.computeLabel({ name }), name).not.toMatch(/^editor\./)
    expect(names).toEqual(expect.arrayContaining(['mate_url', 'image_tap_action', 'double_confirm_actions', 'confirm_actions', 'disabled_actions', 'tire_min', 'tire_max', 'color']))
    expect(form.data.double_confirm_actions).toEqual(['unlock', 'trunk', 'windows', 'sunshade'])
  })

  it('turns the automatic groups into sections that can be renamed, moved and removed', async () => {
    const ed = document.createElement('leapmotor-mate-card-editor') as unknown as HTMLElement & { hass: HomeAssistant; setConfig(c: unknown): void; updateComplete: Promise<unknown> }
    ed.setConfig({ type: 'custom:leapmotor-mate-card' })
    ed.hass = { ...mateHass(), locale: { language: 'it' } }
    document.body.appendChild(ed)
    await ed.updateComplete
    let last: { action_sections?: { title: string; actions: string[] }[] } = {}
    ed.addEventListener('config-changed', e => { last = (e as CustomEvent).detail.config })
    const buttons = () => [...ed.shadowRoot!.querySelectorAll('button.add')] as HTMLElement[]

    buttons()[0]!.click()
    await ed.updateComplete
    expect(last.action_sections!.map(s => s.title)).toEqual(['Accesso', 'Aperture', 'Veicolo', 'Clima', 'Ricarica'])

    // rename the first one
    const form = ed.shadowRoot!.querySelector('.section-card ha-form') as HTMLElement
    form.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { title: 'Chiavi', actions: ['lock', 'unlock'] } } }))
    await ed.updateComplete
    expect(last.action_sections![0]).toEqual({ title: 'Chiavi', actions: ['lock', 'unlock'] })

    // move it down, then delete what is now first
    const tools = () => [...ed.shadowRoot!.querySelectorAll('.section-card')].map(c => [...c.querySelectorAll('ha-icon-button')] as HTMLElement[])
    tools()[0]![1]!.click()
    await ed.updateComplete
    expect(last.action_sections!.map(s => s.title)).toEqual(['Aperture', 'Chiavi', 'Veicolo', 'Clima', 'Ricarica'])
    tools()[0]![2]!.click()
    await ed.updateComplete
    expect(last.action_sections!.map(s => s.title)).toEqual(['Chiavi', 'Veicolo', 'Clima', 'Ricarica'])

    // back to automatic removes the key altogether
    buttons()[1]!.click()
    await ed.updateComplete
    expect('action_sections' in last).toBe(false)
  })

  it('writes only what differs from the defaults', async () => {
    const ed = document.createElement('leapmotor-mate-card-editor') as unknown as HTMLElement & { hass: HomeAssistant; setConfig(c: unknown): void; updateComplete: Promise<unknown> }
    ed.setConfig({ type: 'custom:leapmotor-mate-card' })
    ed.hass = mateHass()
    document.body.appendChild(ed)
    await ed.updateComplete
    const got: unknown[] = []
    ed.addEventListener('config-changed', e => got.push((e as CustomEvent).detail.config))
    const form = ed.shadowRoot!.querySelector('ha-form') as unknown as HTMLElement & { data: Record<string, unknown> }
    form.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { ...form.data, disabled_actions: ['windows'], tire_min: 2.2, tire_max: 2.8 } } }))
    expect(got).toEqual([{ type: 'custom:leapmotor-mate-card', disabled_actions: ['windows'], tire_range: [2.2, 2.8] }])
  })
})
