import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { AlertLevel, ResolvedGroup } from '../groups'
import { batteryColor, sharedStyles } from '../theme'
import type { GroupId, VehicleState } from '../types'

export interface GridTile {
  group: ResolvedGroup
  /** Already resolved: the user's override, or the translation. */
  title: string
  summary: string
  alert: AlertLevel
}

@customElement('leapmotor-mate-group-grid')
export class LeapmotorGroupGrid extends LitElement {
  @property({ attribute: false }) tiles: GridTile[] = []
  @property({ attribute: false }) state!: VehicleState

  /**
   * Returns focus to the tile that opened a sub-view. Called by the card
   * after closing: without this, focus went back to the top of the
   * document and keyboard navigation lost its place.
   */
  public focusTile(id: GroupId): void {
    this.renderRoot.querySelector<HTMLButtonElement>(`button[data-group="${id}"]`)?.focus()
  }

  private open(id: GroupId) {
    this.dispatchEvent(new CustomEvent('leapmotor-mate-open-group', {
      detail: { group: id }, bubbles: true, composed: true,
    }))
  }

  /**
   * The color of the icon and the summary. Charging is the exception and
   * doesn't go through the alert level: it uses the battery color, which
   * already gives green, amber and red by percentage, and which the hero
   * already shows on the bar right above. See spec §4.2.
   */
  private accent(tile: GridTile): string {
    if (tile.group.id === 'charging') return batteryColor(this.state.battery)
    if (tile.alert === 'alert') return 'var(--lm-alert)'
    if (tile.alert === 'warn') return 'var(--lm-warn)'
    return 'var(--lm-text)'
  }

  override render() {
    return html`<div class="grid">
      ${this.tiles.map(tile => html`
        <button
          class="tile plain ${tile.alert}"
          data-group=${tile.group.id}
          aria-label="${tile.title}: ${tile.summary}"
          @click=${() => this.open(tile.group.id)}
        >
          <span class="icon" style="color:${this.accent(tile)}">
            <ha-icon icon=${tile.group.icon}></ha-icon>
          </span>
          <span class="text">
            <span class="tile-title">${tile.title}</span>
            <span class="tile-summary" style="color:${this.accent(tile)}">${tile.summary}</span>
          </span>
        </button>
      `)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px; margin-top: var(--lm-gap);
    }
    /*
     * Compound selector, and not .tile: button.plain from theme.ts does
     * all: unset at (0,1,1) and would strip background, padding, corners,
     * dimensions and box-sizing. See the warning in theme.ts — this has
     * already produced six defects in this project, two of them visible on
     * a user's dashboard.
     */
    button.tile.plain {
      box-sizing: border-box; display: flex; align-items: center; gap: 12px;
      width: 100%; min-width: 0; padding: 12px;
      background: var(--lm-chip); border-radius: var(--lm-radius);
      text-align: start; color: var(--lm-text);
      transition: transform 120ms ease;
    }
    button.tile.plain:active { transform: scale(0.985); }
    button.tile.plain.warn { box-shadow: inset 0 0 0 1px var(--lm-warn); }
    button.tile.plain.alert { box-shadow: inset 0 0 0 1px var(--lm-alert); }
    .icon {
      display: grid; place-items: center; flex: 0 0 auto;
      width: 38px; height: 38px; border-radius: 50%;
      background: var(--card-background-color);
    }
    .text { display: flex; flex-direction: column; min-width: 0; }
    .tile-title { font-size: 0.9rem; font-weight: 600; }
    .tile-summary {
      font-size: 0.8rem; margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    @media (max-width: 320px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-mate-group-grid': LeapmotorGroupGrid }
}
