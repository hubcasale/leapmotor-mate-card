import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import {
  BLOCKED_WHILE_DRIVING, actionIcon, actionLabel, groupActions, isActionAvailable, type ActionEventDetail,
} from '../actions'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

@customElement('leapmotor-mate-actions-row')
export class LeapmotorActionsRow extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap
  @property({ attribute: false }) actions: ActionId[] = []
  @property({ attribute: false }) pending?: ActionId
  /** Functions the owner turned off: they are offered nowhere. */
  @property({ attribute: false }) disabledActions: readonly ActionId[] = []

  private disabled(action: ActionId): boolean {
    if (!isActionAvailable(action, this.state, this.map, this.disabledActions)) return true
    if (this.state.activity === 'driving' && BLOCKED_WHILE_DRIVING.includes(action)) return true
    return this.pending !== undefined
  }

  private fire(action: ActionId) {
    this.dispatchEvent(new CustomEvent<ActionEventDetail>('leapmotor-mate-action', {
      detail: { action }, bubbles: true, composed: true,
    }))
  }

  override render() {
    return html`<div class="groups">
      ${groupActions(this.actions).map(g => html`
        <div class="group" role="group" aria-label=${this.t(`action_group.${g.group}`)}>
          <div class="group-title muted">${this.t(`action_group.${g.group}`)}</div>
          <div class="buttons">
            ${g.actions.map(action => html`
              <button
                class="plain"
                ?disabled=${this.disabled(action)}
                title=${actionLabel(action, this.state, this.t)}
                @click=${() => this.fire(action)}
              >
                <span class="circle ${this.pending === action ? 'busy' : ''}">
                  <ha-icon icon=${actionIcon(action, this.state)}></ha-icon>
                </span>
                <span class="label">${actionLabel(action, this.state, this.t)}</span>
              </button>
            `)}
          </div>
        </div>
      `)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    button.plain { flex-direction: column; width: 54px; }
    /*
     * One block per function, side by side while they fit and wrapping as
     * whole blocks when they do not: a button never ends up alone on a line
     * away from the others of its kind.
     */
    .groups { display: flex; flex-wrap: wrap; gap: 10px 10px; margin-top: var(--lm-gap); }
    .group-title {
      font-size: 0.68rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
      margin: 0 0 6px 4px;
    }
    .buttons { display: flex; gap: 6px; }
    .circle {
      display: grid; place-items: center;
      width: 46px; height: 46px; border-radius: 50%;
      background: var(--lm-chip);
      transition: background 120ms ease, transform 120ms ease;
    }
    button.plain:not([disabled]):active .circle { transform: scale(0.94); }
    .circle.busy { animation: pulse 900ms ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.45; } }
    .label { font-size: 0.7rem; text-align: center; line-height: 1.15; margin-top: 4px; }
    @media (max-width: 360px) {
      button.plain { width: 48px; }
      .circle { width: 42px; height: 42px; }
      .label { font-size: 0.66rem; }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-mate-actions-row': LeapmotorActionsRow }
}
