import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import {
  actionLabel, shownLevel,
  type ActionEventDetail, type ActionPayload, type SeatLevels,
} from '../actions'
import { CABIN_TOPVIEW } from '../cabin-topview'
import { formatNumber } from '../format'
import type { LogicalKey, SeatLevelKey } from '../keys'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'


/**
 * The spot of a control overlaid on the cabin view. `left`/`top` are
 * percentages of the view's box, not pixels: the view scales with the
 * card's width and the controls have to follow it.
 */
interface Spot { left: string; top: string }

@customElement('leapmotor-mate-climate-panel')
export class LeapmotorClimatePanel extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap
  /** Maximum seat level, read from the `max` attribute of the number entities. */
  @property({ type: Number }) maxLevel = 3
  /**
   * The levels the panel shows: already reconciled by the card, which is
   * what stores the requests (`SeatRequests`). They are numbers, not
   * requests — hence the distinct name.
   */
  @property({ attribute: false }) shownLevels: SeatLevels = {}

  private fire(action: ActionId, payload?: ActionPayload) {
    this.dispatchEvent(new CustomEvent<ActionEventDetail>('leapmotor-mate-action', {
      detail: { action, payload }, bubbles: true, composed: true,
    }))
  }

  private setNumber(key: LogicalKey, value: number) {
    this.dispatchEvent(new CustomEvent<{ key: LogicalKey; value: number }>('leapmotor-mate-set-number', {
      detail: { key, value }, bubbles: true, composed: true,
    }))
  }

  /** Mate takes the recirculation as a plain on/off switch. */
  private toggleRecirc() {
    const shown = this.state.climate.recirculating
    this.dispatchEvent(new CustomEvent<{ key: LogicalKey; on: boolean }>('leapmotor-mate-set-switch', {
      detail: { key: 'recirculation', on: shown === undefined ? true : !shown }, bubbles: true, composed: true,
    }))
  }

  /** The fan is a number entity: the speed goes out when the slider is released. */
  private onFan(e: Event) {
    this.setNumber('fanLevel', Number((e.target as HTMLInputElement).value))
  }

  /** A switch overlaid on the view, in a chip all its own: mirrors, steering wheel. */
  private chipToggle(action: ActionId, key: LogicalKey, icon: string, label: string, on: boolean | undefined, at: Spot) {
    if (!this.map[key]) return nothing
    return html`<button
      class="plain chip-btn ${on ? 'on' : ''}"
      style="left:${at.left};top:${at.top}"
      @click=${() => this.fire(action)}
      title=${label}
      aria-label=${label}
      aria-pressed=${on === undefined ? nothing : (on ? 'true' : 'false')}
    ><ha-icon icon=${icon}></ha-icon></button>`
  }

  /**
   * A seat's pill: heat and ventilation side by side, like in the app. The
   * pill just groups them and nothing more — each half is its own button, it
   * commands its own entity and shows its own level; tapping one doesn't
   * touch the other.
   *
   * A half whose entity isn't in the map isn't drawn, and the pill narrows to
   * the size of a single control instead of being left with a hole. Without
   * either of the two, there's no pill at all.
   */
  private seatPill(seat: string, heatKey: SeatLevelKey, ventKey: SeatLevelKey, at: Spot) {
    const halves = [
      { key: heatKey, icon: 'mdi:car-seat-heater', label: `${seat} · ${this.t('comfort.heating')}` },
      { key: ventKey, icon: 'mdi:car-seat-cooler', label: `${seat} · ${this.t('comfort.ventilation')}` },
    ].filter(half => this.map[half.key])
    if (halves.length === 0) return nothing
    return html`<div
      class="seat-pill ${halves.length === 2 ? 'two' : 'one'}"
      style="left:${at.left};top:${at.top}"
    >${halves.map(half => this.seatLevel(half.key, half.icon, half.label))}</div>`
  }

  /**
   * Half a pill. Mate commands a seat with an on and an off button and
   * reports a level in a sensor, so a tap is a toggle: the level is shown,
   * but it cannot be chosen. The request is kept by the card, which marks it
   * pending until the car's reading moves.
   */
  private seatLevel(key: SeatLevelKey, icon: string, label: string) {
    const { level, pending } = shownLevel(this.shownLevels[key], this.state.comfort[key])
    // `formatNumber` already returns DASH for `undefined`.
    const shown = formatNumber(level, 0)
    // The level goes in the label because `aria-label` covers the button's
    // content: without it, a screen reader would announce the seat without
    // saying what level it's at.
    const spoken = `${label} · ${shown}`
    return html`<button
      class="plain seat-btn ${level ? 'on' : ''} ${pending ? 'pending' : ''}"
      @click=${() => this.dispatchEvent(new CustomEvent('leapmotor-mate-seat', { detail: { key }, bubbles: true, composed: true }))}
      title=${spoken}
      aria-label=${spoken}
      aria-pressed=${level === undefined ? nothing : (level > 0 ? 'true' : 'false')}
    >
      <ha-icon icon=${icon}></ha-icon>
      <span class="level">${shown}</span>
    </button>`
  }

  private button(action: ActionId, key: LogicalKey, icon: string, label: string, on = false) {
    if (!this.map[key]) return nothing
    return html`<button class="plain tile-btn ${on ? 'on' : ''}" @click=${() => this.fire(action)} title=${label}>
      <span class="circle"><ha-icon icon=${icon}></ha-icon></span>
      <span class="label">${label}</span>
    </button>`
  }

  /**
   * Where there's a control there's no drawing: neither the steering wheel
   * nor the mirrors are drawn (see `cabin-topview.ts`). The chip IS the
   * part, and that's why its position isn't "over the part it commands" but
   * "in the place of the part it commands", in the drawing's coordinates
   * (viewBox 200 x 240 — the `left` values resolve against 200, the `top`
   * values against 240):
   *   - mirrors: TWO chips, one at each front corner, 7.5% and 92.5% / 9.5%
   *     (centers at 15; 22.8 and 185; 22.8). This is where the ears of an
   *     exterior rearview mirror are — outside the cabin, ahead of the doors
   *     — and it's where the app places its own two chips, flush against the
   *     margins. They sit ABOVE the fascia's line, without touching it: the
   *     highest point of the line under a chip is y = 39.6 (at the inner
   *     edge, x = 27.5 and x = 172.5) and the chip ends at y = 35.3, so 4.3
   *     units of clearance. That leaves 2.5 units (4 px) for the box's
   *     margin, which is the "more to the side" that was asked for;
   *   - steering wheel: ahead of the driver's seat, 28.5% / 22.29% (center
   *     at 57; 53.5 — the same x as the driver's pill, so plumb with it).
   *     This chip no longer has the fascia's line passing behind it: the
   *     lowest point of the line across the chip's width is at y = 35.05
   *     (left edge, x = 44.5) and the chip starts at y = 41.0, i.e. 5.9
   *     units below it; and it ends at y = 66.0, 6.0 from the driver's
   *     headrest (y = 72). It sits between the two, flush against the
   *     driver and not the fascia, which is where a steering wheel belongs.
   *     It was to fit here that the drawing's box grew from 228 to 240;
   *   - pills: over the backrest of each seat, 28.5% and 71.5% / 47.5%
   *     (centers 57 and 143 in x, 114 in y; backrest from y = 90 to y = 138).
   *     These stay over the drawing because the backrest is BIGGER than the
   *     pill and isn't the same shape: the seat is visible around it, and it
   *     reads as a seat with a control on top of it. That's what the 38 x 28
   *     wheel under a 25 chip couldn't do — two round shapes of almost the
   *     same size, one on top of the other, read as a smudge.
   *
   * TWO CHIPS, ONE SWITCH. The integration exposes a single
   * `switch/rearview_mirror_heat` for the mirror pair — the two always heat
   * together, there's no way to heat just one. The two chips in this view
   * say exactly that: they both read the SAME `c.mirrorHeat` (so they light
   * up and turn off together, and one's `aria-pressed` is always the
   * other's) and both fire the SAME `mirrorHeat`, which is a single service
   * request no matter which side it comes from. There's no per-chip state
   * here, nor half an entity: what would be a lie is two chips that look
   * like they command one mirror each.
   *
   * What the drawing can't say, the accessible names say: each chip
   * announces itself as "Mirrors · both · left/right button". The "both"
   * comes first and is what matters — whoever reaches the left chip by
   * keyboard learns they're commanding the pair; the "left button" part
   * only serves to distinguish one chip from the other, and it talks about
   * the BUTTON, never the mirror.
   *
   * The mirrors' icon is `mdi:mirror`: an oval with two highlights, which is
   * the glass of a rearview mirror. The `mdi:mirror-rectangle` that used to
   * be here is a rectangle with another rectangle inside and read as a
   * mobile phone or a door. The app uses a heated-glass icon, and the MDI
   * equivalent would be `mdi:car-defrost-rear` — but that one is, stroke for
   * stroke, the `mdi:car-defrost-front` of the Defrost button further down
   * in this SAME panel (a windshield with three heat waves), just with
   * rectangular glass instead of trapezoidal. At 18px they're the same
   * icon. The heat is conveyed by the label and by the panel this lives in;
   * the shape says "mirror".
   */
  private topview() {
    const c = this.state.comfort
    return html`<div class="topview">
      ${CABIN_TOPVIEW}
      ${this.chipToggle('mirrorHeat', 'mirrorHeat', 'mdi:mirror', this.t('comfort.mirrors_both_left'), c.mirrorHeat, { left: '7.5%', top: '9.5%' })}
      ${this.chipToggle('mirrorHeat', 'mirrorHeat', 'mdi:mirror', this.t('comfort.mirrors_both_right'), c.mirrorHeat, { left: '92.5%', top: '9.5%' })}
      ${this.chipToggle('steeringWheelHeat', 'steeringWheelHeat', 'mdi:steering', this.t('comfort.steering_wheel'), c.steeringWheelHeat, { left: '28.5%', top: '22.29%' })}
      ${this.seatPill(this.t('comfort.driver_seat'), 'driverSeatHeat', 'driverSeatVent', { left: '28.5%', top: '47.5%' })}
      ${this.seatPill(this.t('comfort.passenger_seat'), 'passengerSeatHeat', 'passengerSeatVent', { left: '71.5%', top: '47.5%' })}
    </div>`
  }

  override render() {
    const c = this.state.climate
    const climateOn = c.on === true
    const recirc = c.recirculating
    // The toggle's label says what the tap does (turn off while it runs).
    const acLabel = actionLabel('climate', this.state, this.t)
    const recircLabel = this.t('climate.recirculation')
    const fan = c.fan

    return html`<div class="panel">
      <div class="title">${this.t('climate.title')}</div>

      ${this.topview()}

      <div class="stepper">
        <div class="value">
          <span class="big">${formatNumber(c.targetC, 0)}</span><span class="unit muted">°C</span>
        </div>
      </div>
      <div class="hint muted">${this.t('climate.hint')}</div>

      ${this.map.fanLevel ? html`
        <div class="line">
          <span class="muted"><ha-icon icon="mdi:fan"></ha-icon> ${this.t('climate.fan')}</span>
          <span class="reading">${formatNumber(fan, 0)}</span>
        </div>
        <input
          class="slider" type="range" min="1" max="7" step="1"
          aria-label=${this.t('climate.fan')}
          .value=${String(fan ?? 1)}
          @change=${this.onFan}
        />` : nothing}

      ${this.map.recirculation ? html`
        <div class="line">
          <span class="muted"><ha-icon icon="mdi:air-filter"></ha-icon> ${recircLabel}</span>
          <button
            class="plain toggle ${recirc ? 'on' : ''}"
            title=${recircLabel}
            aria-label=${recircLabel}
            aria-pressed=${recirc === undefined ? nothing : (recirc ? 'true' : 'false')}
            @click=${this.toggleRecirc}
          >
            <ha-icon icon=${recirc === undefined
              ? 'mdi:help-circle-outline'
              : recirc ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'}></ha-icon>
          </button>
        </div>` : nothing}

      <div class="grid">
        ${this.button('climate', climateOn ? 'climateOff' : 'climateAuto', 'mdi:air-conditioner', acLabel, climateOn)}
        ${this.button('quickCool', 'quickCool', 'mdi:snowflake', this.t('action.quickCool'))}
        ${this.button('quickHeat', 'quickHeat', 'mdi:fire', this.t('action.quickHeat'))}
        ${this.button('quickVentilation', 'quickVentilation', 'mdi:fan', this.t('action.quickVentilation'))}
        ${this.button('defrost', 'windshieldDefrost', 'mdi:car-defrost-front', this.t('action.defrost'))}
      </div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; }
    /*
     * The view's width isn't decoration, it's geometry. The SVG has viewBox
     * 200x240 and no dimensions of its own, so the box measures W x 1.2W and
     * the controls' percentages resolve against it — the "left" values
     * against W, the "top" values against the HEIGHT. Since max-width is
     * 320px, min(40px, 12.5%) is always the percentage: the geometry below,
     * in viewBox units, is the same at any width. At the design width
     * (W = 320px, so H = 384px, 1.6px per unit), with the origin at the
     * top-left corner:
     *   - chip: 40 x 40px = 25 x 25 units. A seat's pill: 88 x 44px
     *     = 55 x 27.5 units, two targets of 44 x 44px.
     *   - left mirror chip: 7.5% / 9.5% -> center (15; 22.8), box
     *     x 2.5..27.5, y 10.3..35.3. The right one mirrors this, 92.5% / 9.5%
     *     -> center (185; 22.8), box x 172.5..197.5, y 10.3..35.3.
     *   - steering wheel chip: 28.5% / 22.29% -> center (57; 53.5), box
     *     x 44.5..69.5, y 41.0..66.0.
     *   - pills: 28.5% and 71.5% / 47.5% -> centers (57; 114) and (143; 114),
     *     boxes x 29.5..84.5 and x 115.5..170.5, y 100.25..127.75.
     *
     * Clearances between controls (none negative, so no overlap; a single
     * axis separation is enough for two boxes not to touch):
     *   - left mirror -> steering wheel: 44.5 - 27.5 = 17 units (27.2px) in x.
     *   - left mirror -> driver's pill: 29.5 - 27.5 = 2 units
     *     (3.2px) in x, and 100.25 - 35.3 = 64.95 units (103.9px) in y.
     *   - right mirror -> passenger's pill: 172.5 - 170.5 = 2 units
     *     in x, and the same 64.95 in y. (Symmetric to the one above.)
     *   - left mirror -> right mirror: 172.5 - 27.5 = 145 units.
     *   - steering wheel -> driver's pill: 100.25 - 66.0 = 34.25 units
     *     (54.8px) in y, with the same center in x (57), so plumb.
     *   - pill -> pill: 115.5 - 84.5 = 31 units (49.6px).
     *
     * Clearances to the box's margins (everything inside, in units / px):
     *   - left: 2.5 / 4.0 (left mirror chip, the one closest to the edge).
     *   - right: 200 - 197.5 = 2.5 / 4.0 (right mirror chip, symmetric).
     *   - top: 10.3 / 16.5 (both mirror chips).
     *   - bottom: 240 - 127.75 = 112.25 / 179.6 (the pills).
     *
     * Clearances to the drawing, which is what the two top chips gained:
     *   - mirrors -> fascia line: the line is highest at the inner edge of
     *     each chip (x = 27.5 and x = 172.5), at y = 39.6; the chip ends at
     *     y = 35.3, so 4.3 units (6.9px).
     *   - mirrors -> top of the door panels (y = 46): 10.7 (17.1px).
     *   - steering wheel -> fascia line: the line is lowest at the chip's
     *     left edge (x = 44.5), at y = 35.05; the chip starts at y = 41.0,
     *     so 5.95 units (9.5px) — and the line rises to the right, so this
     *     is the minimum clearance. The line no longer passes behind any
     *     chip.
     *   - steering wheel -> driver's headrest (y = 72): 6.0 (9.6px).
     * No target drops below 40px, none touches another and none leaves the
     * box.
     *
     * The container-type serves the cqw of the content, below: 1cqw is 1% of
     * W, so icon and digit scale with the box instead of staying at fixed
     * pixels, which used to overflow the control on narrow cards.
     */
    .topview {
      position: relative; width: 100%; max-width: 320px; margin: 12px auto 4px;
      container-type: inline-size;
    }
    .topview svg { display: block; width: 100%; height: auto; }
    /*
     * The pill is a <div> and not a <button>: it groups two controls, it
     * doesn't merge them into one. That's why it escapes all: unset and a
     * single class selector is enough for it.
     *
     * The height comes from aspect-ratio and not from a percentage: a height
     * percentage would resolve against the view's HEIGHT (1.14W) and would
     * give a deformed box. With aspect-ratio: 2 and 88px of width, the
     * height that comes out is exactly 44px, and the two halves stretch to
     * that height through the align-items: stretch that flex already
     * brings.
     *
     * The border-radius in percentage resolves against the box ITSELF: 15%
     * of 88px and 30% of 44px are the same 13.2px, so the corner is round
     * and follows the pill's size without depending on the card's width.
     */
    .seat-pill {
      position: absolute; box-sizing: border-box;
      transform: translate(-50%, -50%);
      display: flex; overflow: hidden;
      background: var(--card-background-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    .seat-pill.two { width: min(88px, 27.5%); aspect-ratio: 2; border-radius: 15% / 30%; }
    .seat-pill.one { width: min(44px, 13.75%); aspect-ratio: 1; border-radius: 30%; }
    /*
     * button.plain (theme.ts) does all: unset at (0,1,1) — box-sizing,
     * width, height, padding, background, corners, position AND the flex
     * properties are lost, going back to the initial 0 1 auto. Without
     * flex: 1 1 0 the two halves would shrink to the content's size and
     * stop being 44px targets. That's why the box lives in the compound
     * selector, just like button.plain.chip-btn and button.plain.step-btn
     * below, or button.tile.plain in group-grid.ts.
     */
    button.plain.seat-btn {
      box-sizing: border-box; flex: 1 1 0; min-width: 0;
      display: grid; place-items: center; gap: 0; padding: 0;
      background: transparent; color: var(--lm-muted);
      transition: background 120ms ease, transform 120ms ease;
    }
    button.plain.seat-btn.on { color: var(--primary-color); }
    button.plain.seat-btn.pending { opacity: 0.6; }
    /*
     * The global focus ring (theme.ts) uses outline-offset: 2px, which here
     * was clipped by the pill's overflow: hidden and overflowed into the
     * other half. On the inside, the ring fits within the half that's about
     * to fire, and that's what the user needs to see. (0,3,1) beats the
     * (0,2,1) from there.
     */
    button.plain.seat-btn:focus-visible { outline-offset: -3px; }
    /*
     * The same for the single-icon chips (mirrors, steering wheel), with an
     * extra warning: without position: absolute they'd fall into flow below
     * the view and none of them would sit over the part it commands.
     */
    button.plain.chip-btn {
      position: absolute; box-sizing: border-box;
      transform: translate(-50%, -50%);
      display: grid; place-items: center; gap: 0;
      width: min(40px, 12.5%); aspect-ratio: 1; padding: 0;
      border-radius: 30%; background: var(--card-background-color);
      color: var(--lm-muted);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: box-shadow 120ms ease, transform 120ms ease;
    }
    button.plain.chip-btn.on { color: var(--primary-color); }
    /*
     * Response to the pointer and to touch, in line with what
     * actions-row.ts already did with its .circle. Without it, the user
     * taps the seat heater, sees nothing move while Home Assistant hasn't
     * returned the new level yet, and taps again — shownLevel absorbs the
     * second tap and no command is lost, but the extra level is
     * unnecessary.
     *
     * The :hover is behind an @media (hover: hover) so the state doesn't
     * stay stuck on a touch screen, where the browser keeps it after the
     * tap. The chip's :active repeats translate(-50%, -50%) because
     * transform is ONE property: writing only the scale would erase the
     * centering and the chip would jump down and to the right when tapped.
     * Both rules are at (0,3,1), above button.plain (0,1,1) and the boxes
     * themselves (0,2,1).
     */
    @media (hover: hover) {
      button.plain.seat-btn:hover { background: var(--lm-chip); }
      button.plain.chip-btn:hover { box-shadow: 0 2px 7px rgba(0, 0, 0, 0.32); }
    }
    button.plain.seat-btn:active { transform: scale(0.9); }
    button.plain.chip-btn:active { transform: translate(-50%, -50%) scale(0.9); }
    /*
     * In fixed pixels the content overflowed the box below a view of
     * ~223px. 5.6cqw and 3.1cqw are exactly the 18px and the 9.9px of a
     * 320px view, but expressed in the same unit as the boxes (12.5cqw the
     * chip, 13.75cqw each half of the pill): the relationship between
     * content and box stops depending on the width.
     *
     * The fallback has to be an @supports and not a second declaration: the
     * value of a CUSTOM property is any sequence of tokens, so no browser
     * discards a --mdc-icon-size: 5.6cqw at parse time, whether or not it
     * knows what cqw is — and whoever doesn't ends up with the ha-icon's
     * width: var(...) invalid at computed-value time, i.e. with auto, and
     * not with the 18px. Inside the @supports, whoever has no container
     * queries is left with the declarations in pixels, which is what's
     * intended.
     */
    button.plain.seat-btn ha-icon,
    button.plain.chip-btn ha-icon { --mdc-icon-size: 18px; }
    .level { font-size: 0.62rem; line-height: 1; font-variant-numeric: tabular-nums; }
    @supports (container-type: inline-size) {
      button.plain.seat-btn ha-icon,
      button.plain.chip-btn ha-icon { --mdc-icon-size: 5.6cqw; }
      .level { font-size: 3.1cqw; }
    }
    .stepper { display: flex; align-items: center; justify-content: center; gap: 20px; margin: 14px 0; }
    /*
     * button.plain (theme.ts) does all: unset at (0,1,1); an isolated
     * .step-btn rule at (0,1,0) would lose display, place-items, width,
     * height, border-radius and background. That's why the button's box
     * lives in the compound selector, just like button.tile.plain in
     * group-grid.ts.
     */
    button.plain.step-btn {
      display: grid; place-items: center; width: 44px; height: 44px;
      border-radius: 50%; background: var(--lm-chip);
    }
    .value { display: flex; align-items: baseline; gap: 4px; }
    .value.pending { opacity: 0.6; }
    .big { font-size: 2.2rem; font-weight: 300; line-height: 1; }
    .unit { font-size: 0.9rem; }
    .hint { font-size: 0.75rem; text-align: center; margin-bottom: 14px; }
    .line { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.88rem; }
    .line ha-icon { --mdc-icon-size: 18px; vertical-align: -3px; }
    .reading { font-variant-numeric: tabular-nums; }
    .slider { width: 100%; margin: 6px 0 2px; accent-color: var(--primary-color); }
    /*
     * Here too the whole box, not just the color: the recirculation button
     * sits next to 40-44px controls and, without a box of its own, only
     * the 18px icon was the touch area. The cursor and opacity properties
     * are left out on purpose — button.plain[disabled] is at the same
     * specificity (0,2,1) and it is the one that should declare them.
     */
    button.plain.toggle {
      box-sizing: border-box; display: grid; place-items: center;
      width: 40px; height: 40px; padding: 0;
      border-radius: 50%; background: transparent;
    }
    button.plain.toggle.on { color: var(--primary-color); }
    /*
     * :not([disabled]) because (0,3,1) would beat button.plain[disabled]
     * (0,2,1) and a button that's pending and disabled at the same time —
     * tapping recirculation and the A/C turning off right after — would
     * show up at 0.6 instead of the 0.4 of disabled.
     */
    button.plain.toggle.pending:not([disabled]) { opacity: 0.6; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); gap: 8px; margin-top: 14px; }
    button.plain.tile-btn { flex-direction: column; }
    /* button.plain (theme.ts) sits at specificity (0,1,1); a bare .on class
       (0,1,0) cannot override it, so the on/off color needs the same
       compound-selector treatment as the grid tile's button.tile.plain.warn
       (group-grid.ts). */
    button.plain.tile-btn.on { color: var(--primary-color); }
    .circle { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: var(--lm-chip); }
    .label { font-size: 0.72rem; text-align: center; line-height: 1.15; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-mate-climate-panel': LeapmotorClimatePanel }
}
