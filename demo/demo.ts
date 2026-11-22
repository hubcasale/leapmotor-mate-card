/**
 * A stand-alone page that mounts the real card against a fake Home Assistant
 * with a Leapmotor Mate car in it. It is how the screenshots in the README are
 * made (`npm run demo`, then open demo/index.html), and a quick way to look at
 * a change without a Home Assistant at hand. It stubs the handful of Home
 * Assistant elements the card uses: nothing here ships in the card.
 */
import * as mdi from '@mdi/js'
import '../src/leapmotor-mate-card'
import '../src/leapmotor-mate-card-editor'
import type { HassEntity, HomeAssistant } from '../src/ha-types'

const camel = (name: string) => 'mdi' + name.replace(/^mdi:/, '').split('-').map(p => p[0]!.toUpperCase() + p.slice(1)).join('')

class HaIcon extends HTMLElement {
  static observedAttributes = ['icon']
  private _icon = ''
  set icon(v: string) { this._icon = v; this.draw() }
  get icon() { return this._icon }
  attributeChangedCallback(_n: string, _o: string, v: string) { this._icon = v; this.draw() }
  connectedCallback() { this.draw() }
  private draw() {
    const path = (mdi as Record<string, string>)[camel(this._icon)] ?? mdi.mdiHelpCircleOutline
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);vertical-align:middle}svg{width:100%;height:100%;fill:currentColor}</style><svg viewBox="0 0 24 24"><path d="${path}"/></svg>`
  }
}
class HaCard extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return
    this.attachShadow({ mode: 'open' }).innerHTML = `<style>:host{display:block;background:var(--card-background-color);color:var(--primary-text-color);border-radius:12px;border:1px solid var(--divider-color);overflow:hidden}</style><slot></slot>`
  }
}
class HaAlert extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return
    this.attachShadow({ mode: 'open' }).innerHTML = `<style>:host{display:block;padding:10px 12px;border-radius:8px;background:rgba(245,166,35,.15);margin-bottom:8px;font-size:.9rem}</style><slot></slot>`
  }
}
customElements.define('ha-icon', HaIcon)
customElements.define('ha-card', HaCard)
customElements.define('ha-alert', HaAlert)

const CAR = '5r1234'
const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity =>
  ({ entity_id, state, attributes, last_changed: '', last_updated: '' })

function hass(overrides: Record<string, string> = {}): HomeAssistant {
  const now = new Date()
  const base: Record<string, [string, Record<string, unknown>?]> = {
    'sensor/battery': ['64', { unit_of_measurement: '%' }], 'sensor/range': ['231', { unit_of_measurement: 'km' }],
    'sensor/odometer': ['12345'], 'sensor/speed': ['0'], 'sensor/gear': ['P'], 'sensor/state': ['parked'],
    'sensor/last_seen': [new Date(now.getTime() - 120000).toISOString()], 'sensor/data_age': ['40'],
    'sensor/charge_power': ['unknown'], 'sensor/charge_voltage': ['unknown'], 'sensor/charge_current': ['unknown'],
    'sensor/charge_time_remaining': ['0'],
    'sensor/tyre_fl': ['2.5'], 'sensor/tyre_fr': ['2.5'], 'sensor/tyre_rl': ['2.4'], 'sensor/tyre_rr': ['2.4'],
    'sensor/inside_temp': ['19'], 'sensor/outside_temp': ['11'], 'sensor/ac_target': ['22'], 'sensor/climate_mode': ['unknown'],
    'sensor/sunshade_position': ['0'], 'sensor/seat_heating_driver': ['0'], 'sensor/seat_heating_passenger': ['0'],
    'sensor/seat_ventilation_driver': ['0'], 'sensor/seat_ventilation_passenger': ['0'],
    'sensor/steering_wheel_heat': ['0'], 'sensor/mirror_heating_left': ['0'],
    'lock/door_lock': ['locked'], 'number/fan_level': ['3'], 'number/charge_limit': ['80', { min: 50, max: 100, step: 1 }],
    'switch/air_recirculation': ['off'], 'device_tracker/location': ['home', { latitude: 41.8902, longitude: 12.4922 }],
  }
  for (const b of ['charging', 'plug_connected', 'climate', 'ready', 'door_front_left', 'door_front_right', 'door_rear_left', 'door_rear_right', 'trunk', 'window_front_left', 'window_front_right', 'window_rear_left', 'window_rear_right', 'sunshade']) base[`binary_sensor/${b}`] = ['off']
  for (const b of ['open_trunk', 'close_trunk', 'open_windows', 'close_windows', 'open_sunshade', 'close_sunshade', 'find_car', 'preheat_battery', 'unlock_charge_cable', 'a_c_auto', 'a_c_off', 'quick_cool', 'quick_heat', 'quick_ventilation', 'defrost', 'steering_heat_on', 'steering_heat_off', 'mirror_heat_on', 'mirror_heat_off', 'driver_seat_heat_on', 'driver_seat_heat_off', 'passenger_seat_heat_on', 'passenger_seat_heat_off', 'driver_seat_vent_on', 'driver_seat_vent_off', 'passenger_seat_vent_on', 'passenger_seat_vent_off']) base[`button/${b}`] = ['unknown']
  const states: Record<string, HassEntity> = {}
  for (const [key, [state, attrs]] of Object.entries(base)) {
    const [domain, slug] = key.split('/')
    const id = `${domain}.leapmotor_mate_${CAR}_${slug}`
    states[id] = st(id, overrides[key] ?? state, attrs)
  }
  return {
    states, entities: {}, devices: {}, locale: { language: 'it' },
    callService: async (d, s, _data, target) => { console.log('service', d, s, target) },
    callWS: async () => [] as never,
  }
}

Object.defineProperty(window, 'loadCardHelpers', {
  value: async () => ({ createCardElement: async () => Object.assign(document.createElement('div'), { style: 'height:180px;background:linear-gradient(135deg,#9bc4a0,#c9d8b6);border-radius:8px' }) }),
})

type Card = HTMLElement & { hass: HomeAssistant; setConfig(c: unknown): void; updateComplete: Promise<unknown> }

async function mount(host: HTMLElement, config: Record<string, unknown>, overrides: Record<string, string>, open?: number, tap?: string) {
  const card = document.createElement('leapmotor-mate-card') as Card
  card.setConfig({ type: 'custom:leapmotor-mate-card', name: 'La mia B10', language: params.get('lang') ?? 'it', ...config })
  card.hass = hass(overrides)
  host.appendChild(card)
  await card.updateComplete
  await new Promise(r => setTimeout(r, 50))
  if (open !== undefined) {
    const grid = card.shadowRoot!.querySelector('leapmotor-mate-group-grid') as HTMLElement
    ;(grid.shadowRoot!.querySelectorAll('button')[open] as HTMLElement).click()
    // The sub-view takes the focus when it opens; a screenshot has no use for the ring.
    setTimeout(() => {
      let active: Element | null = document.activeElement
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
      ;(active as HTMLElement | null)?.blur()
    }, 400)
  }
  if (tap) {
    const row = card.shadowRoot!.querySelector('leapmotor-mate-actions-row') as HTMLElement
    ;([...row.shadowRoot!.querySelectorAll('button')].find(b => b.textContent?.includes(tap)) as HTMLElement | undefined)?.click()
    if (params.get('step') === '2') {
      await card.updateComplete
      ;(card.shadowRoot!.querySelector('.ask-btn.go') as HTMLElement | null)?.click()
    }
  }
}

const params = new URLSearchParams(location.search)
const view = params.get('view') ?? 'all'
const charging = { 'binary_sensor/plug_connected': 'on', 'binary_sensor/charging': 'on', 'sensor/charge_power': '6.8', 'sensor/charge_voltage': '230', 'sensor/charge_current': '29.6', 'sensor/charge_time_remaining': '95' }
const VIEWS: Record<string, [Record<string, unknown>, Record<string, string>, number?, string?][]> = {
  home: [[{}, {}]],
  charging: [[{}, charging, 0]],
  status: [[{}, { 'binary_sensor/window_rear_left': 'on', 'binary_sensor/trunk': 'on' }, 1]],
  climate: [[{}, { 'binary_sensor/climate': 'on', 'sensor/seat_heating_driver': '2', 'sensor/steering_wheel_heat': '1' }, 2]],
  tires: [[{}, { 'sensor/tyre_rr': '1.8' }, 3]],
  confirm: [[{}, {}, undefined, params.get('tap') ?? 'Sblocca']],
}
VIEWS.all = [...VIEWS.home!, ...VIEWS.charging!, ...VIEWS.status!, ...VIEWS.climate!, ...VIEWS.tires!]
const wrap = document.getElementById('cards')!
for (const [config, overrides, open, tap] of VIEWS[view] ?? VIEWS.home!) {
  const host = document.createElement('div')
  host.className = 'cell'
  wrap.appendChild(host)
  void mount(host, config, overrides, open, tap)
}
if (params.get('theme') === 'dark') document.documentElement.classList.add('dark')
