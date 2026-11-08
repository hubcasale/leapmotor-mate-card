import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import type { TranslateFn } from '../localize'
import { INTERACTIVE_SELECTOR, decideSwipe } from '../swipe'
import { sharedStyles } from '../theme'

@customElement('leapmotor-mate-group-detail')
export class LeapmotorGroupDetail extends LitElement {
  @property({ attribute: false }) t!: TranslateFn
  @property({ type: String }) heading = ''
  /** False when there's only one group: navigating to itself is not navigation. */
  @property({ type: Boolean }) navigable = false
  /** The "Updated at…", already formatted by the card. */
  @property({ type: String }) updatedLabel = ''

  @query('.wrap') private wrapEl?: HTMLElement

  private pointerId?: number
  private startX = 0
  private startY = 0

  override firstUpdated() {
    // Focus goes to the frame, and not to the first button: without this,
    // the keyboard arrows and Esc only worked after someone pressed Tab.
    // `preventScroll` because on a phone the card can be half off-screen:
    // without this, opening the sub-view would yank the viewport to the
    // focus.
    this.wrapEl?.focus({ preventScroll: true })
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }

  private nav(delta: -1 | 1) { this.emit('leapmotor-mate-nav', { delta }) }
  private close() { this.emit('leapmotor-mate-close') }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); this.close(); return }
    if (!this.navigable) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.nav(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.nav(1) }
  }

  private onPointerDown(e: PointerEvent) {
    // Touch and pen only: with the mouse, dragging over the card is text
    // selection, not a gesture.
    if (e.pointerType === 'mouse') return
    // No swiping when the gesture starts on a control — the list and the
    // reason for each entry are in `INTERACTIVE_SELECTOR`. The composed
    // path, and not `e.target`: the sub-view's content arrives via `<slot>`,
    // comes from the card's light DOM, and the target re-targeted by the
    // shadow doesn't give away the control the finger landed on. The scan
    // covers the whole path, and not just the first node, because the
    // finger lands on a tile or an icon and the control is an ancestor of
    // it.
    if (e.composedPath().some(node => node instanceof Element && node.matches(INTERACTIVE_SELECTOR))) return
    this.pointerId = e.pointerId
    this.startX = e.clientX
    this.startY = e.clientY
  }

  private onPointerEnd(e: PointerEvent) {
    if (this.pointerId !== e.pointerId) return
    this.pointerId = undefined
    if (e.type === 'pointercancel' || !this.navigable) return
    const decision = decideSwipe(e.clientX - this.startX, e.clientY - this.startY)
    if (decision === 'prev') this.nav(-1)
    else if (decision === 'next') this.nav(1)
  }

  override render() {
    return html`<div
      class="wrap"
      role="group"
      aria-label=${this.heading}
      tabindex="-1"
      @keydown=${this.onKeyDown}
      @pointerdown=${this.onPointerDown}
      @pointerup=${this.onPointerEnd}
      @pointercancel=${this.onPointerEnd}
    >
      <div class="bar">
        <button class="nav plain" aria-label=${this.t('detail.close')} @click=${this.close}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
        <div class="heading">${this.heading}</div>
        ${this.navigable
          ? html`
            <button class="nav plain" aria-label=${this.t('detail.previous')} @click=${() => this.nav(-1)}>
              <ha-icon icon="mdi:chevron-left"></ha-icon>
            </button>
            <button class="nav plain" aria-label=${this.t('detail.next')} @click=${() => this.nav(1)}>
              <ha-icon icon="mdi:chevron-right"></ha-icon>
            </button>`
          : nothing}
      </div>

      <div class="body"><slot></slot></div>

      ${this.updatedLabel
        ? html`<div class="updated muted">${this.updatedLabel}</div>`
        : nothing}
    </div>`
  }

  static override styles = [sharedStyles, css`
    /*
     * pan-y hands the vertical drag to the browser and leaves us only the
     * horizontal one: it's half of coexisting with the dashboard's scroll.
     * The other half is decideSwipe.
     */
    .wrap { touch-action: pan-y; outline: none; }
    .wrap:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; border-radius: var(--lm-radius); }
    .bar {
      display: flex; align-items: center; gap: 4px;
      margin-top: var(--lm-gap);
    }
    .heading { flex: 1 1 auto; min-width: 0; font-size: 1.05rem; font-weight: 600; }
    /*
     * Compound selector: button.plain from theme.ts does all: unset at
     * (0,1,1) and would strip the dimensions, the radius and the
     * box-sizing from these buttons.
     */
    button.nav.plain {
      box-sizing: border-box; display: grid; place-items: center; flex: 0 0 auto;
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--lm-chip); color: var(--lm-text);
    }
    button.nav.plain ha-icon { --mdc-icon-size: 20px; }
    .updated { margin-top: 10px; font-size: 0.72rem; text-align: center; }
    /*
     * The animation moved to .body, which is the same box that .content
     * used to wrap. With the height reserved outside the card, .content
     * only existed to stretch up to a min-height that no longer exists, and
     * .body's flex column only existed to stretch it: what's left is a
     * block, which is all .content ever was. The animation stays because it
     * still marks the sub-view's opening — the element is created anew on
     * every open from the grid (only navigation between groups reuses it,
     * and there it doesn't play).
     */
    @media (prefers-reduced-motion: no-preference) {
      .body { animation: enter 160ms ease-out; }
      @keyframes enter { from { opacity: 0; transform: translateY(4px); } }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-mate-group-detail': LeapmotorGroupDetail }
}
