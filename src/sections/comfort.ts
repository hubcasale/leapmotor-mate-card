import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { shownLevel, type ActionEventDetail, type SeatLevels } from '../actions'
import type { LogicalKey, SeatLevelKey } from '../keys'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

interface LevelRow { key: SeatLevelKey; label: string; value: number | undefined; icon: string }

@customElement('leapmotor-comfort')
export class LeapmotorComfort extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap
  /** Kept for the card's bindings; seats are on/off with Mate. */
  @property({ type: Number }) maxLevel = 1
  /**
   * The levels this section shows, already reconciled by the card. The
   * climate panel's pin commands these same four entities and receives
   * exactly the same object; without it here, a tap in one section would
   * leave the other still flagging the old level, and the same seat would
   * show two different values on the same screen.
   */
  @property({ attribute: false }) shownLevels: SeatLevels = {}

  private fireAction(action: ActionId) {
    this.dispatchEvent(new CustomEvent<ActionEventDetail>('leapmotor-action', {
      detail: { action }, bubbles: true, composed: true,
    }))
  }

  /**
   * A seat. Mate commands it with an on and an off button and reports a
   * level, so the control is a toggle that shows the level the car reports.
   */
  private levelRow(row: LevelRow) {
    if (!this.map[row.key]) return nothing
    const { level: shown, pending } = shownLevel(this.shownLevels[row.key], row.value)
    return html`<div class="line">
      <span class="muted"><ha-icon icon=${row.icon}></ha-icon> ${row.label}${shown ? ` · ${shown}` : ''}</span>
      <button
        class="plain toggle ${shown ? 'on' : ''} ${pending ? 'pending' : ''}"
        @click=${() => this.dispatchEvent(new CustomEvent('leapmotor-seat', { detail: { key: row.key }, bubbles: true, composed: true }))}
        title=${row.label}
        aria-label=${row.label}
        aria-pressed=${shown === undefined ? nothing : (shown > 0 ? 'true' : 'false')}
      >
        <ha-icon icon=${shown ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'}></ha-icon>
      </button>
    </div>`
  }

  private toggleRow(action: ActionId, key: LogicalKey, label: string, on: boolean | undefined, icon: string) {
    if (!this.map[key === 'batteryPreheat' ? 'batteryPreheat' : key === 'steeringWheelHeat' ? 'steeringWheelHeatOn' : 'mirrorHeatOn']) return nothing
    return html`<div class="line">
      <span class="muted"><ha-icon icon=${icon}></ha-icon> ${label}</span>
      <button class="plain toggle ${on ? 'on' : ''}" @click=${() => this.fireAction(action)}>
        <ha-icon icon=${on ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'}></ha-icon>
      </button>
    </div>`
  }

  override render() {
    const c = this.state.comfort
    const wheelSuffix = c.steeringWheelHeat && c.steeringWheelHeatRemaining !== undefined
      ? ` · ${this.t('comfort.remaining', { minutes: c.steeringWheelHeatRemaining })}`
      : ''

    return html`<div class="panel">
      <div class="title">${this.t('comfort.title')}</div>
      ${this.levelRow({ key: 'driverSeatHeat', label: `${this.t('comfort.driver_seat')} · ${this.t('comfort.heating')}`, value: c.driverSeatHeat, icon: 'mdi:car-seat-heater' })}
      ${this.levelRow({ key: 'driverSeatVent', label: `${this.t('comfort.driver_seat')} · ${this.t('comfort.ventilation')}`, value: c.driverSeatVent, icon: 'mdi:car-seat-cooler' })}
      ${this.levelRow({ key: 'passengerSeatHeat', label: `${this.t('comfort.passenger_seat')} · ${this.t('comfort.heating')}`, value: c.passengerSeatHeat, icon: 'mdi:car-seat-heater' })}
      ${this.levelRow({ key: 'passengerSeatVent', label: `${this.t('comfort.passenger_seat')} · ${this.t('comfort.ventilation')}`, value: c.passengerSeatVent, icon: 'mdi:car-seat-cooler' })}
      ${this.toggleRow('steeringWheelHeat', 'steeringWheelHeat', `${this.t('comfort.steering_wheel')}${wheelSuffix}`, c.steeringWheelHeat, 'mdi:steering')}
      ${this.toggleRow('mirrorHeat', 'mirrorHeat', this.t('comfort.mirrors'), c.mirrorHeat, 'mdi:mirror')}
      ${this.toggleRow('batteryPreheat', 'batteryPreheat', this.t('comfort.battery_preheat'), c.batteryPreheat, 'mdi:battery-heart-variant')}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
    .line { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: 0.88rem; }
    /* Request pending confirmation, same as the climate panel's pin:
       (0,2,0) over .steps (0,1,0), and no button involved, so no all: unset
       trap. */
    button.plain.toggle.pending { opacity: 0.6; }
    button.plain.step {
      width: 28px; height: 28px; border-radius: 50%;
      display: grid; place-items: center; background: var(--card-background-color); font-size: 0.8rem;
    }
    button.plain.step.active { background: var(--primary-color); color: var(--text-primary-color, #fff); }
    /* button.plain (theme.ts) is at (0,1,1): the project's convention is
       the compound selector, so that no rule in this sheet depends on
       counting classes against all: unset. */
    button.plain.toggle.on { color: var(--primary-color); }
    ha-icon { --mdc-icon-size: 18px; vertical-align: -3px; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-comfort': LeapmotorComfort }
}
