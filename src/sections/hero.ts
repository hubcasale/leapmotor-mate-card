import { LitElement, css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import { actionLabel, lockPillShape, lockToggleAction } from '../actions'
import { formatAgo, formatNumber, formatTimeOfDay, formatUpdated } from '../format'
import { DASH, formatDuration, type TranslateFn } from '../localize'
import type { TapDecision } from '../tap-action'
import { batteryColor, sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'
import { carSilhouette } from '../car-silhouette'
import type { CarModel } from '../car-models'

@customElement('leapmotor-mate-hero')
export class LeapmotorHero extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) now!: Date
  @property({ type: String }) name = ''
  @property({ type: String }) language = 'en'
  @property({ type: String }) imageUrl?: string
  @property({ type: Boolean }) showImage = true
  // Mirrors the rule from spec §6: in `image: 'entity'` mode there's no
  // fallback to the silhouette, not even when the `entity_picture` (with a
  // signed token) expires later and the <img> errors out. `showImage`
  // already handles the "no input URL" case; this prop covers the "URL that
  // fails after mounting" case.
  @property({ type: Boolean }) allowSilhouette = true
  /** Which Leapmotor to draw when there is no photo, and the tint of its body. */
  @property({ type: String }) model: CarModel = 'b10'
  @property({ type: String }) carColor?: string

  /**
   * The one-row shape, for when a sub-view is open: name, range, battery and
   * locks, with no photo and no activity label. What's left is what
   * identifies the car and what you want to know without thinking; the rest
   * gives way to the sub-view's data. See spec §3.3.
   */
  @property({ type: Boolean }) compact = false

  /**
   * The tap on the range, ALREADY decided by the card: this section never
   * sees `hass` or the configuration, the same contract as the map in
   * `leapmotor-mate-location`. `none` is what puts the number back to being
   * inert text.
   */
  @property({ attribute: false }) rangeTap: TapDecision = { kind: 'none' }

  /**
   * The two the lock pill needs to know whether it can command the car:
   * `map` says whether there is a lock entity at all, `pending` whether
   * another action is already in flight. Same pair the actions row receives,
   * and for the same reason.
   */
  @property({ attribute: false }) map: EntityMap = {}
  @property({ attribute: false }) pending?: ActionId

  @internalState() private imageFailed = false

  override willUpdate(changed: PropertyValues) {
    if (changed.has('imageUrl')) this.imageFailed = false
  }

  private lockLabel(): string {
    const { locked } = this.state.lock
    if (locked === undefined) return this.t('doors_unknown')
    return this.t(locked ? 'doors_locked' : 'doors_unlocked')
  }

  private chargingChip() {
    const c = this.state.charging
    if (c.phase === 'unplugged') return nothing

    const parts: string[] = []
    if (c.phase === 'complete') parts.push(this.t('charging.complete'))
    else if (c.phase === 'scheduled') {
      parts.push(this.t('charging.scheduled', {
        start: this.state.schedule.start ?? DASH,
        end: this.state.schedule.end ?? DASH,
      }))
    } else if (c.phase === 'plugged') parts.push(this.t('charging.plugged'))
    else parts.push(this.t(c.speed === 'fast' ? 'charging.fast' : 'charging.slow'))

    if (c.remainingMinutes !== undefined) {
      parts.push(this.t('charging.remaining', { duration: formatDuration(c.remainingMinutes, this.t) }))
    } else if (c.finishTime) {
      parts.push(this.t('charging.finish', { time: formatTimeOfDay(c.finishTime, this.language) }))
    }

    return html`<div class="chip charge">
      <ha-icon icon="mdi:lightning-bolt"></ha-icon>${parts.join(', ')}
    </div>`
  }

  private bar() {
    const battery = this.state.battery
    const limit = this.state.chargeLimit
    return html`<div class="bar" role="img" aria-label="${formatNumber(battery)}%">
      ${limit !== undefined
        ? html`<div class="limit" style="width:${Math.min(100, Math.max(0, limit))}%"></div>`
        : nothing}
      <div class="fill" style="width:${Math.min(100, Math.max(0, battery ?? 0))}%;background:${batteryColor(battery)}"></div>
    </div>`
  }

  private renderCompact() {
    const { range, lock } = this.state
    return html`<div class="compact-row">
      <div class="compact-name">${this.name || DASH}</div>
      <div class="compact-range">
        ${range ? formatNumber(range.km) : DASH}<span class="unit muted">${range ? ` ${range.unit}` : ''}</span>
      </div>
      ${this.bar()}
      <ha-icon
        class="compact-lock ${lock.stale ? 'stale' : ''}"
        role="img"
        aria-label=${this.lockLabel()}
        title=${this.lockLabel()}
        icon=${lock.locked === false ? 'mdi:lock-open-variant-outline' : 'mdi:lock-outline'}
      ></ha-icon>
    </div>`
  }

  private fire(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }

  /** The number and its unit, the same in both shapes of the block. */
  private rangeValue() {
    const { range } = this.state
    return html`
      <span class="big">${range ? formatNumber(range.km) : DASH}</span>
      <span class="unit muted">${range?.unit ?? ''}</span>`
  }

  /**
   * The range, as a button when the tap does something and as the text it
   * always was when it does not. A `<button>` and not a `@click` on the div:
   * keyboard, focus ring and the `Enter`/`Space` keys come with it, and
   * `button` is already in `INTERACTIVE_SELECTOR`, which is what exempts it
   * from the swipe between sub-views.
   */
  private rangeBlock() {
    if (this.rangeTap.kind === 'none') return html`<div class="value">${this.rangeValue()}</div>`
    const { range } = this.state
    const reading = range ? `${formatNumber(range.km)} ${range.unit}` : DASH
    return html`<button
      class="plain value"
      title=${this.t('range_tap')}
      aria-label="${reading} — ${this.t('range_tap')}"
      @click=${() => this.fire('leapmotor-mate-range-tap')}
    >${this.rangeValue()}</button>`
  }

  /** The padlock and its two lines of text, the same in both shapes. */
  private lockBody() {
    const { lock } = this.state
    return html`
      <ha-icon icon=${lock.locked === false ? 'mdi:lock-open-variant-outline' : 'mdi:lock-outline'}></ha-icon>
      <div class="lock-text">
        <div>${this.lockLabel()}</div>
        ${lock.stale && lock.ageSeconds !== undefined
          ? html`<div class="ago muted">${formatAgo(lock.ageSeconds, this.t)}</div>`
          : nothing}
      </div>`
  }

  /**
   * The lock state in whichever of the three shapes `lockPillShape` decides
   * — the plain readout it always was, a live button, or a disabled one
   * while a call is in flight. The action comes from `lockToggleAction`,
   * the same function the card calls to decide the service: this way what
   * the tooltip promises and what the car receives cannot disagree.
   */
  private lockBlock() {
    const { lock } = this.state
    const classes = `lock ${lock.stale ? 'stale' : ''}`
    const shape = lockPillShape(this.state, this.map, this.pending)
    if (shape === 'text') return html`<div class=${classes}>${this.lockBody()}</div>`
    const label = actionLabel(lockToggleAction(this.state), this.state, this.t)
    return html`<button
      class="plain ${classes}"
      ?disabled=${shape === 'busy'}
      title=${label}
      aria-label="${this.lockLabel()} — ${label}"
      @click=${() => this.fire('leapmotor-mate-lock-tap')}
    >${this.lockBody()}</button>`
  }

  override render() {
    if (this.compact) return this.renderCompact()
    const { activity } = this.state
    return html`
      <div class="head">
        <div class="title">${this.name || DASH}</div>
        <div class="sub muted">${formatUpdated(this.state.lastUpdate, this.now, this.t, this.language)}</div>
      </div>

      <div class="row main">
        <div class="range">
          ${this.rangeBlock()}
          ${this.bar()}
          ${this.chargingChip()}
        </div>

        ${this.lockBlock()}
      </div>

      ${this.showImage
        ? html`<div class="image">
            ${this.imageUrl && !this.imageFailed
              ? html`<img src=${this.imageUrl} alt=${this.name} @error=${() => { this.imageFailed = true }} />`
              : (this.allowSilhouette ? carSilhouette(this.model, this.carColor) : nothing)}
          </div>`
        : nothing}

      ${activity === 'unknown'
        ? nothing
        : html`<div class="activity muted">${this.t(`activity.${activity}`)}</div>`}
    `
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.4rem; font-weight: 600; }
    .sub { font-size: 0.8rem; margin-top: 2px; }
    .main { margin-top: var(--lm-gap); align-items: flex-start; }
    .range { min-width: 0; flex: 1 1 auto; }
    .value { display: flex; align-items: baseline; gap: 6px; }
    /*
     * Compound selectors, and not .value / .lock: button.plain from theme.ts
     * does all: unset at (0,1,1) and would strip the display, the alignment
     * and the gap these two boxes depend on — the interactive shape would
     * come out laid out differently from the inert one, on the same card,
     * depending only on whether there is a lock entity. See the warning in
     * theme.ts: this family of defect has already reached a user's
     * dashboard six times in this project.
     */
    button.plain.value { display: flex; align-items: baseline; gap: 6px; text-align: start; }
    button.plain.lock { display: flex; align-items: flex-start; gap: 8px; text-align: start; flex: 0 0 auto; }
    .big { font-size: 2.6rem; font-weight: 300; line-height: 1; }
    .unit { font-size: 1rem; }
    .bar {
      position: relative; height: 6px; border-radius: 999px;
      background: var(--lm-chip); margin: 10px 0; max-width: 220px; overflow: hidden;
    }
    .bar .limit, .bar .fill { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: 999px; }
    .bar .limit { background: var(--leapmotor-battery-high, #2fbf5c); opacity: 0.28; }
    .chip.charge { margin-top: 4px; }
    .lock { display: flex; align-items: flex-start; gap: 8px; text-align: start; flex: 0 0 auto; }
    .lock.stale { opacity: 0.55; }
    .lock-text { font-size: 1.05rem; line-height: 1.2; }
    .ago { font-size: 0.75rem; }
    .image { display: flex; justify-content: center; margin: var(--lm-gap) 0 4px; }
    .image img, .image svg { max-width: 100%; height: auto; max-height: 160px; }
    .activity { text-align: center; font-size: 0.95rem; }
    .compact-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .compact-name {
      flex: 1 1 auto; min-width: 0; font-size: 1.05rem; font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .compact-range { flex: 0 0 auto; font-size: 1.05rem; }
    /*
     * The bar is the same one as the full hero, but here it lives in a row:
     * it loses the vertical margin and the 220px max-width, which there
     * served a column.
     */
    .compact-row .bar { flex: 0 0 64px; margin: 0; max-width: 64px; }
    .compact-lock { flex: 0 0 auto; --mdc-icon-size: 20px; }
    .compact-lock.stale { opacity: 0.55; }
    /*
     * On a narrow screen the bar SHRINKS, it doesn't disappear: it's the
     * only representation of the battery in this shape — there's no
     * percentage in text — and display: none would also take its role=img
     * and its aria-label with it, leaving screen reader users with no
     * charge information at all. The squeeze is absorbed by the name, which
     * has flex: 1 1 auto and ellipsis.
     */
    @media (max-width: 360px) {
      .big { font-size: 2.1rem; }
      .lock-text { font-size: 0.9rem; }
      .compact-row .bar { flex-basis: 40px; max-width: 40px; }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-mate-hero': LeapmotorHero }
}
