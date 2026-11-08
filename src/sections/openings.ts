import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import {
  BLOCKED_WHILE_DRIVING, actionIcon, actionLabel, isActionAvailable,
  type ActionEventDetail,
} from '../actions'
import { areDoorsUnknown, areWindowsUnknown, formatNumber, isWindowOpen } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

interface Row {
  key: string
  icon: string
  label: string
  value: string
  /** Detail underneath the value, when there's more than one thing to say. */
  detail?: string
  warn: boolean
  /** The action the row commands. Absent on a read-only row. */
  action?: ActionId
}

@customElement('leapmotor-openings')
export class LeapmotorOpenings extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap
  @property({ type: String }) pending?: ActionId

  private openWindowCount(): number {
    return Object.values(this.state.openings.windows).filter(isWindowOpen).length
  }

  /** The open doors, named one by one. */
  private openDoors(): string[] {
    const { doors } = this.state.openings
    const named: [boolean | undefined, string][] = [
      [doors.driver, 'openings.door_driver'],
      [doors.passenger, 'openings.door_passenger'],
      [doors.rearLeft, 'openings.door_rear_left'],
      [doors.rearRight, 'openings.door_rear_right'],
    ]
    return named.filter(([open]) => open === true).map(([, key]) => this.t(key))
  }

  private openWindowNames(): string[] {
    const { windows } = this.state.openings
    const named: [keyof typeof windows, string][] = [
      ['fl', 'openings.window_fl'], ['fr', 'openings.window_fr'],
      ['rl', 'openings.window_rl'], ['rr', 'openings.window_rr'],
    ]
    return named.filter(([side]) => isWindowOpen(windows[side])).map(([, key]) => this.t(key))
  }

  /**
   * The value of a count row. Zero openings with zero readings is not
   * "everything closed" — it's ignorance, and that's written as DASH. See
   * spec §9.
   */
  private closedOrUnknown(nothingKnown: boolean, count: number, oneKey: string, manyKey: string): string {
    if (count === 0) return nothingKnown ? DASH : this.t('openings.all_closed')
    return this.t(count === 1 ? oneKey : manyKey, { count })
  }

  /**
   * The value of a boolean row. The keys come from outside, not by default,
   * on purpose: in Portuguese the adjective agrees with the row's noun, and
   * this card has both genders — the trunk is "Aberta", the roof is
   * "Aberto". Each call declares the gender it wants, so that no new row
   * inherits one by accident. Don't merge the two pairs into one: in English
   * the four keys say the same word and the duplication looks redundant, but
   * it's what separates the two genders in Portuguese.
   */
  private boolValue(v: boolean | undefined, openKey: string, closedKey: string): string {
    if (v === undefined) return DASH
    return this.t(v ? openKey : closedKey)
  }

  /** The roof row: the state word and, when Mate reports it, how far the sunshade is open. */
  private roofValue(roof: boolean | undefined): string {
    const word = this.boolValue(roof, 'openings.open', 'openings.closed')
    const pct = this.state.openings.sunshadePct
    return roof === true && pct !== undefined ? `${word} · ${formatNumber(pct)} %` : word
  }

  private rows(): Row[] {
    const o = this.state.openings
    const { locked } = this.state.lock
    const openWindows = this.openWindowCount()
    const openDoors = this.openDoors()

    return [
      {
        key: 'locks',
        // The icon reports the reading, like every other row in this section
        // (it's the button that carries the action) — and for an unknown
        // reading the closed padlock is what asserts nothing, unlike the open
        // one, which would assert "unlocked". It's also what the hero shows
        // for the same unknown state; do not change it to agree with the
        // action.
        icon: locked === false ? 'mdi:lock-open-variant-outline' : 'mdi:lock-outline',
        label: this.t('openings.locks'),
        // DASH, and not `doors_unknown`: this row already has a label
        // column, and "Locks → Doors" is not a value. In the hero the same
        // key is correct, because there the chip is the label and the value
        // at the same time.
        value: locked === undefined ? DASH : this.t(locked ? 'doors_locked' : 'doors_unlocked'),
        warn: locked === false && !this.state.lock.stale,
        // The action is the opposite of the state, and unknown counts as
        // unlocked: locking an already-locked car does no harm, unlocking a
        // car whose state is unknown does. Hence the comparison is against
        // `true` and not against `false` — with `locked === false ? 'lock' :
        // 'unlock'`, the unknown state fell into unlocking, which is exactly
        // the wrong side.
        action: locked === true ? 'unlock' : 'lock',
      },
      {
        key: 'windows',
        icon: actionIcon('windows', this.state),
        label: this.t('openings.windows'),
        value: this.closedOrUnknown(areWindowsUnknown(o.windows), openWindows, 'openings.open_one', 'openings.open_count'),
        detail: openWindows > 0 ? this.openWindowNames().join(' · ') : undefined,
        warn: openWindows > 0,
        action: 'windows',
      },
      {
        key: 'doors',
        icon: 'mdi:car-door',
        label: this.t('openings.doors'),
        // "Porta" is feminine and a single door isn't "abertas": the `_fem`
        // keys exist just for this, and the singular follows the same rule
        // the windows already applied. In English the four keys say the
        // same thing.
        value: this.closedOrUnknown(areDoorsUnknown(o.doors), openDoors.length, 'openings.open_one_fem', 'openings.open_count_fem'),
        detail: openDoors.length > 0 ? openDoors.join(' · ') : undefined,
        warn: openDoors.length > 0,
        // No action, on purpose: the integration doesn't expose a door
        // command. A row with a button that does nothing is worse than a
        // row without a button. See spec §4.1.
      },
      {
        key: 'trunk',
        icon: actionIcon('trunk', this.state),
        label: this.t('openings.trunk'),
        value: this.boolValue(o.trunk, 'openings.open_fem', 'openings.closed_fem'),
        warn: o.trunk === true,
        action: 'trunk',
      },
      {
        key: 'roof',
        icon: 'mdi:window-shutter',
        label: this.t('openings.roof'),
        value: this.roofValue(o.roof),
        warn: o.roof === true,
        // Mate has an open and a close button: the tap picks the one that reverses the reading.
        action: 'sunshade',
      },
    ]
  }

  private disabled(action: ActionId): boolean {
    if (!isActionAvailable(action, this.state, this.map)) return true
    if (this.state.activity === 'driving' && BLOCKED_WHILE_DRIVING.includes(action)) return true
    return this.pending !== undefined
  }

  private fire(action: ActionId) {
    this.dispatchEvent(new CustomEvent<ActionEventDetail>('leapmotor-action', {
      detail: { action }, bubbles: true, composed: true,
    }))
  }

  /**
   * A row's button only exists if the action is actually resolvable:
   * without an entity behind it, `isActionAvailable` says no and the row
   * stays read-only, instead of offering a command that would fail
   * silently.
   */
  private button(action: ActionId | undefined) {
    if (!action || !isActionAvailable(action, this.state, this.map)) return nothing
    const label = actionLabel(action, this.state, this.t)
    return html`<button
      class="do plain ${this.pending === action ? 'busy' : ''}"
      ?disabled=${this.disabled(action)}
      aria-label=${label}
      title=${label}
      @click=${() => this.fire(action)}
    >${label}</button>`
  }

  override render() {
    return html`<div class="panel">
      <div class="title">${this.t('openings.title')}</div>
      ${this.rows().map(row => html`
        <div class="line ${row.warn ? 'warn' : ''}">
          <ha-icon icon=${row.icon}></ha-icon>
          <div class="text">
            <div class="label">${row.label}</div>
            ${row.detail ? html`<div class="detail muted">${row.detail}</div>` : nothing}
          </div>
          <div class="value">${row.value}</div>
          ${this.button(row.action)}
        </div>
      `)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
    .line {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto auto;
      align-items: center; gap: 10px;
      padding: 8px 0; font-size: 0.9rem;
      border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.18));
    }
    .line:last-child { border-bottom: none; }
    .line ha-icon { --mdc-icon-size: 20px; color: var(--lm-muted); }
    .line.warn ha-icon, .line.warn .value { color: var(--lm-warn); }
    .text { min-width: 0; }
    .detail { font-size: 0.72rem; margin-top: 1px; }
    .value { white-space: nowrap; }
    /*
     * Compound selector: button.plain from theme.ts does all: unset at
     * (0,1,1) and would strip background, padding, corners and box-sizing
     * from this button.
     */
    button.do.plain {
      box-sizing: border-box; display: inline-flex; justify-content: center;
      padding: 5px 10px; border-radius: 999px;
      background: var(--lm-chip); color: var(--lm-text);
      font-size: 0.76rem; white-space: nowrap;
    }
    button.do.plain.busy { animation: pulse 900ms ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.45; } }
    @media (max-width: 360px) {
      .line { grid-template-columns: 20px minmax(0, 1fr) auto; row-gap: 4px; }
      button.do.plain { grid-column: 3; }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-openings': LeapmotorOpenings }
}
