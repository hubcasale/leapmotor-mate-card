import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatAgo } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { GESTURE_OWNER_CLASS } from '../swipe'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

@customElement('leapmotor-mate-location')
export class LeapmotorLocation extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  /**
   * Home Assistant's `map` card, already created and fed `hass` by the main
   * element. This section never sees `hass` — see the note in Task 3.
   */
  @property({ attribute: false }) mapElement?: HTMLElement

  override render() {
    const loc = this.state.location
    return html`<div class="panel">
      <div class="row head">
        <div class="title">${this.t('location.title')}</div>
        ${loc?.stale && loc.ageSeconds !== undefined
          ? html`<span class="chip stale">${formatAgo(loc.ageSeconds, this.t)}</span>`
          : nothing}
      </div>

      ${loc
        ? html`
            <div class="zone muted">${loc.zone ?? DASH}</div>
            ${this.mapElement
              // GESTURE_OWNER_CLASS has to stay on this container: it's what
              // exempts the map from the swipe between sub-views, and the
              // other side of the contract is INTERACTIVE_SELECTOR in
              // `swipe.ts` — touching one end without the other brings the
              // defect back. Leaflet drags on `touchstart` and never sees
              // our `pointerdown`, so it doesn't defend itself on its own.
              ? html`<div class="map ${GESTURE_OWNER_CLASS} ${loc.stale ? 'stale' : ''}">${this.mapElement}</div>`
              : html`<div class="fallback muted">${this.t('location.map_unavailable')}</div>`}
          `
        : html`<div class="fallback muted">${this.t('location.unknown')}</div>`}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .head { align-items: center; }
    .title { font-size: 1.05rem; font-weight: 600; }
    .chip.stale { opacity: 0.7; }
    .zone { font-size: 0.85rem; margin-top: 4px; }
    .map { margin-top: 10px; border-radius: 12px; overflow: hidden; }
    /* A stale position is drawn dimmed, for the same reason as the locks
       pill: the card doesn't present as current what it knows to be old. */
    .map.stale { opacity: 0.72; }
    .fallback { margin-top: 10px; font-size: 0.85rem; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-mate-location': LeapmotorLocation }
}
