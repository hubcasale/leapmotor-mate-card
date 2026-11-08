import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatNumber } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

/**
 * Mate keeps the car's trips in its own database and publishes none of them
 * over MQTT, so what this sub-view can honestly show is what the car reports:
 * the odometer and the temperatures around it. The full trip history is in
 * Mate's own web interface.
 */
@customElement('leapmotor-mate-trip')
export class LeapmotorTrip extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) language = 'en'

  private row(label: string, value: string) {
    return html`<div class="row"><span class="muted">${label}</span><span class="value">${value}</span></div>`
  }

  override render() {
    const s = this.state
    const km = s.trip.odometerKm
    return html`<div class="panel">
      <div class="title">${this.t('trip.title')}</div>
      ${this.row(this.t('trip.odometer'), km === undefined ? DASH : `${formatNumber(km, 0)} km`)}
      ${this.row(this.t('trip.outside_temp'), s.climate.outsideC === undefined ? DASH : `${formatNumber(s.climate.outsideC, 0)} °C`)}
      <div class="hint muted">${this.t('trip.hint')}</div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: 0.9rem; }
    .value { font-variant-numeric: tabular-nums; }
    .hint { font-size: 0.75rem; margin-top: 8px; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-mate-trip': LeapmotorTrip }
}
