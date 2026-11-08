import { LitElement, css, html, nothing, type TemplateResult } from 'lit'
import { customElement, state as internalState } from 'lit/decorators.js'
import {
  actionLabel, decideAction, forgetRequest, lockToggleAction,
  pruneRequests, resolveAction,
  type ActionEventDetail, type ActionPayload,
  type SeatLevels, type SeatRequests, type ServiceCall,
} from './actions'
import { formatUpdated } from './format'
import {
  GROUP_ORDER, alertFor, estimateCardSize, missingForGroups, resolveGrid, summaryFor,
  type ResolvedGroup,
} from './groups'
import type { HomeAssistant } from './ha-types'
import { SEAT_LEVEL_KEYS, type LogicalKey, type SeatLevelKey } from './keys'
import { createTranslator, pickLanguage, type TranslateFn } from './localize'
import { resolveEntities, type ResolveResult } from './resolver'
import type { GridTile, LeapmotorGroupGrid } from './sections/group-grid'
import { resolveTapAction, type TapDecision } from './tap-action'
import { sharedStyles } from './theme'
import {
  DEFAULT_ACTIONS, clampMapZoom, clampTireRange, mapRequestChanged,
  type ActionId, type GroupId, type LeapmotorCardConfig, type MapRequest, type VehicleState,
} from './types'
import { attr, buildVehicleState } from './vehicle-state'

import './sections/hero'
import './sections/actions-row'
import './sections/charging'
import './sections/location'
import './sections/climate-panel'
import './sections/openings'
import './sections/group-grid'
import './sections/group-detail'
import './sections/tires'
import './sections/trip'
import './sections/comfort'

export const CARD_VERSION = '0.4.13'


console.info(
  `%c LEAPMOTOR-CARD %c ${CARD_VERSION} `,
  'color:#fff;background:#1f6feb;border-radius:3px 0 0 3px',
  'color:#1f6feb;background:#e8f0fe;border-radius:0 3px 3px 0',
)

;(window as unknown as { customCards?: unknown[] }).customCards ||= []
;(window as unknown as { customCards: unknown[] }).customCards.push({
  type: 'leapmotor-mate-card',
  name: 'Leapmotor Mate Card',
  description: 'Leapmotor vehicle card for Leapmotor Mate: battery, charging, climate, openings, tyres and location',
  preview: true,
  documentationURL: 'https://github.com/hubcasale/leapmotor-mate-card',
})

/**
 * The keys whose absence is always reported, regardless of the grid: without
 * battery and without locks the card has nothing to say, even with an empty
 * grid. Each group's keys come from the catalog, via `missingForGroups`.
 */
const CORE_KEYS: LogicalKey[] = ['battery', 'lock']

@customElement('leapmotor-card')
export class LeapmotorCard extends LitElement {
  @internalState() private _hass?: HomeAssistant
  @internalState() private _config?: LeapmotorCardConfig
  @internalState() private _pending?: ActionId
  @internalState() private _openGroup?: GroupId
  /** The group to return focus to after closing. See spec §4.5. */
  private _focusGroup?: GroupId
  /**
   * The seat levels requested and not yet confirmed, for the same reason and
   * (Mate confirms a command a minute or so later): the panel used to store
   * them, and nothing cleared them once resolved — a heating that switched
   * itself off made the old request take effect again, the pin ended up
   * showing a level the seat no longer had, and the next tap skipped a
   * level. A request's lifecycle rule is a single one, and it lives in a
   * single place.
   */
  private _seatRequests: SeatRequests = {}

  private _resolveCache?: { count: number; entities: unknown; config: unknown; result: ResolveResult }
  private _mapElement?: HTMLElement
  private _mapRequested = false
  private _mapRequest?: MapRequest

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this._seatRequests = {}
  }

  public static async getConfigElement() {
    await import('./leapmotor-card-editor')
    return document.createElement('leapmotor-card-editor')
  }

  public static getStubConfig(hass: HomeAssistant): LeapmotorCardConfig {
    const devices = [...new Set(
      Object.values(hass?.entities ?? {})
        .filter(e => e.platform === 'leapmotor')
        .map(e => e.device_id)
        .filter((d): d is string => !!d),
    )]
    return { type: 'custom:leapmotor-card', ...(devices.length === 1 ? { device: devices[0] } : {}) }
  }

  public setConfig(config: LeapmotorCardConfig): void {
    if (!config) throw new Error('Invalid configuration')
    this._config = { ...config }
    this._resolveCache = undefined
    // Everything that follows belonged to the previous car. Without this,
    // changing `device` in the editor left the map pinning the old car
    // (`ensureMap` bails out right at the start because of `_mapRequested`)
    // and showed one car's unconfirmed requests as if they belonged to the
    // other.
    this._mapRequested = false
    this._mapElement = undefined
    this._mapRequest = undefined
    this._seatRequests = {}
  }

  public set hass(hass: HomeAssistant) {
    this._hass = hass
    if (this._mapElement) (this._mapElement as unknown as { hass?: HomeAssistant }).hass = hass
  }

  /**
   * The height that the HA sections view reserves. It no longer adds section
   * by section because there is no longer a column of sections: the
   * calculation lives in `estimateCardSize`, which is pure and tested, and
   * here only the group count remains.
   */
  public getCardSize(): number {
    const config = this._config
    const result = this.resolved()
    const resolved = config && result && !result.error
    // Without a resolution yet, it isn't known which groups the car exposes,
    // but it is known how many were requested — and reporting the size of
    // the loading line made the masonry balance the columns around a card
    // that was about to grow.
    const count = resolved
      ? resolveGrid(config, result.map).groups.length
      : (config?.grid?.length ?? GROUP_ORDER.length)
    return estimateCardSize(count)
  }

  /**
   * Creates the Home Assistant `map` card and stores it. Only the main
   * element can do this, because an HA card needs `hass` and the sections
   * cannot see it. The section receives the already-built element.
   *
   * `loadCardHelpers` is a semi-public global of the HA frontend. If it does
   * not exist, or if it fails, we are left without `_mapElement` and the
   * section shows its fallback text — the card does not break because of
   * this.
   *
   * Called on every `render()`, so `_mapRequested` may only fall when the
   * request actually changes — entity or zoom — never on every state
   * update, or the map would be destroyed and rebuilt for no reason at all
   * (see `mapRequestChanged`, tested without a DOM in `types.ts`).
   */
  private ensureMap(entityId: string): void {
    const request: MapRequest = { entityId, zoom: clampMapZoom(this._config?.map_zoom) }
    if (this._mapRequested && mapRequestChanged(this._mapRequest, request)) {
      this._mapRequested = false
      this._mapElement = undefined
    }
    if (this._mapRequested) return
    this._mapRequested = true
    this._mapRequest = request
    const loader = (window as unknown as {
      loadCardHelpers?: () => Promise<{ createCardElement: (c: Record<string, unknown>) => HTMLElement }>
    }).loadCardHelpers
    if (!loader) return
    loader()
      .then(helpers => {
        // A more recent request may have arrived while this one was in
        // flight (e.g., the zoom changed again before this `then` ran).
        // Without this guard, the delayed response from the old request
        // would replace the correct map with the map at the zoom from a
        // moment ago.
        if (this._mapRequest !== request) return
        const el = helpers.createCardElement({
          type: 'map',
          entities: [entityId],
          aspect_ratio: '16:9',
          hours_to_show: 0,
          default_zoom: request.zoom,
        })
        if (this._hass) (el as unknown as { hass?: HomeAssistant }).hass = this._hass
        this._mapElement = el
        this.requestUpdate()
      })
      .catch(() => { /* the section shows location.map_unavailable */ })
  }

  private resolved(): ResolveResult | undefined {
    const hass = this._hass
    const config = this._config
    if (!hass || !config) return undefined

    // Mate's entities are found by the shape of their entity_id, so the
    // resolution only changes when entities appear or disappear: the count of
    // states is the cheap signal for that, and it keeps the per-update cost
    // at one comparison instead of a scan of every entity in the house.
    const count = Object.keys(hass.states).length
    const cache = this._resolveCache
    if (cache && cache.count === count && cache.entities === hass.entities && cache.config === config) {
      return cache.result
    }

    const result = resolveEntities(hass, config)
    this._resolveCache = { count, entities: hass.entities, config, result }

    return result
  }

  private async callAction(
    action: ActionId,
    state: VehicleState,
    map: ResolveResult['map'],
    t: TranslateFn,
    payload?: ActionPayload,
    /** See `decideAction`: it is the hero's lock pill that asks for this. */
    forceConfirm?: boolean,
  ) {
    // The decision is made by `decideAction`, which is pure and tested: an
    // in-progress lock, availability, and the need for confirmation cannot
    // live here, where no test can reach them. What remains here is the DOM
    // wiring.
    const decision = decideAction(action, state, map, this._config?.confirm_actions, payload, forceConfirm)
    if (decision.kind === 'blocked' || decision.kind === 'unavailable') return

    // `answer` requires the user's response as an argument, and it is the
    // only way to obtain the call in a case that requires confirmation:
    // skipping `confirm` does not compile. `actionLabel`, and not
    // `t(\`action.${action}\`)`, because `trunk` and `windows` are
    // alternating and their keys are `action.trunk_open` / `action.trunk_close`
    // and `action.windows_open` / `action.windows_close`.
    const call = decision.kind === 'confirm'
      ? decision.answer(window.confirm(t('confirm', { action: actionLabel(action, state, t) })))
      : decision.call
    if (!call || !this._hass) return

    this._pending = action
    try {
      await this.doCall(call).catch(err => this.notifyError(err))
    } finally {
      this._pending = undefined
    }
  }

  /**
   * Carries out a tap already decided by `resolveTapAction`. It is the dirty
   * half — events, history, `window`, `hass` — deliberately kept apart from
   * the pure half, which is the one the tests can reach.
   */
  private performTap(decision: TapDecision): void {
    switch (decision.kind) {
      case 'none':
        return
      case 'more-info':
        // The event Home Assistant's frontend listens for to open the
        // dialog, which for a sensor already comes with the history graph.
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          detail: { entityId: decision.entityId }, bubbles: true, composed: true,
        }))
        return
      case 'navigate':
        // `pushState` plus `location-changed` is how HA navigates inside the
        // app. Assigning to `window.location` would work too, and would
        // reload the whole dashboard to get to the next view.
        history.pushState(null, '', decision.path)
        window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }))
        return
      case 'url':
        // `noreferrer` also implies `noopener`: the opened page gets no
        // handle on the dashboard's window.
        window.open(decision.url, '_blank', 'noreferrer')
        return
      case 'perform-action':
        if (!this._hass) return
        void this._hass.callService(decision.domain, decision.service, decision.data, decision.target)
          .catch(err => this.notifyError(err))
    }
  }

  private async doCall(call: ServiceCall, extra?: Record<string, unknown>) {
    const data = { ...call.data, ...extra }
    await this._hass!.callService(call.domain, call.service, data, { entity_id: call.entityId })
  }

  // `hass.callService` rejects silently in a custom card — HA does not show
  // anything on its own. `hass-notification` is the event the HA frontend
  // listens for to present a toast, so it is the only place where a service
  // error (e.g., a failed unlock) becomes visible to the user.
  private notifyError(err: unknown): void {
    this.dispatchEvent(new CustomEvent('hass-notification', {
      detail: { message: String((err as Error)?.message ?? err) },
      bubbles: true,
      composed: true,
    }))
  }

  private imageUrl(map: ResolveResult['map']): string | undefined {
    const mode = this._config?.image ?? 'auto'
    if (mode === 'none') return undefined
    if (mode !== 'auto' && mode !== 'entity') return mode
    const hass = this._hass
    if (!hass) return undefined
    return attr<string>(hass, map, 'vehiclePicture', 'entity_picture')
  }

  /**
   * An open group can stop existing without anyone closing it: the
   * configuration changes, or its entities disappear. It is closed here, in
   * `willUpdate`, which is where Lit allows touching state before the
   * render — doing it inside `render()` would be asking for a second render
   * triggered by the first.
   */
  override willUpdate() {
    if (!this._openGroup || !this._config) return
    const result = this.resolved()
    if (!result || result.error) return
    const { groups } = resolveGrid(this._config, result.map)
    if (!groups.some(group => group.id === this._openGroup)) this.showGroup(undefined)
  }

  /**
   * Switches view, always closing the expandable panel. Only two views show
   * it: the grid, below the actions row, and the status sub-view, below the
   * roof line. A panel that survived the switch would reappear where nobody
   * asked for it — in the grid when closing the sub-view, or in the status
   * sub-view when returning to it via the arrows — and a panel orphaned
   * from the control that opened it is clutter on screen. The rule holds in
   * both directions, so it lives here and not on one side.
   */
  private showGroup(group: GroupId | undefined): void {
    this._openGroup = group
  }

  /**
   * Returns focus to the tile that opened the sub-view that just closed. It
   * has to be after the render: the tile only exists again once the grid
   * comes back.
   */
  override updated() {
    const id = this._focusGroup
    if (!id) return
    this._focusGroup = undefined
    this.renderRoot.querySelector<LeapmotorGroupGrid>('leapmotor-group-grid')?.focusTile(id)
  }

  override render() {
    const hass = this._hass
    const config = this._config
    if (!hass || !config) return nothing

    const language = pickLanguage(config.language, hass.locale?.language ?? hass.language)
    const t = createTranslator(language)
    const result = this.resolved()

    if (!result) {
      return html`<ha-card><div class="body loading">${t('loading')}</div></ha-card>`
    }

    if (result.error) {
      const candidates = result.candidates.map(c => `${c.name} (${c.id})`).join(', ') || '—'
      return html`<ha-card><div class="body">
        <ha-alert alert-type="error">${t(`error.${result.error}`, { candidates })}</ha-alert>
      </div></ha-card>`
    }

    const { map } = result
    const now = new Date()
    const state = buildVehicleState(hass, map, now)
    const tireRange = clampTireRange(config.tire_range)
    const grid = resolveGrid(config, map)
    const openGroup = grid.groups.find(group => group.id === this._openGroup)
    const actions = config.actions ?? DEFAULT_ACTIONS
    const name = config.name ?? result.deviceName ?? ''
    const imageMode = config.image ?? 'auto'
    const imageUrl = this.imageUrl(map)
    // Spec §6: in `entity` mode there is no fallback to the silhouette — the
    // space stays empty whether due to a missing URL (showImage=false), or
    // because the URL fails after being mounted (allowSilhouette=false, see
    // leapmotor-hero).
    const showImage = imageMode !== 'none' && !(imageMode === 'entity' && !imageUrl)
    const allowSilhouette = imageMode !== 'entity'

    // Decided here, and not in the hero: the section sees neither the
    // configuration nor `hass`. The default target is the sensor the number
    // on screen actually came from — `buildVehicleState` picks between
    // three, and `state.range.entityId` is the one that won.
    const rangeTap = resolveTapAction(config.range_tap_action, state.range?.entityId)

    const onAction = (e: CustomEvent<ActionEventDetail>) => {
      void this.callAction(e.detail.action, state, map, t, e.detail.payload)
    }
    const onRangeTap = () => {
      this.performTap(rangeTap)
    }
    const onLockTap = () => {
      // `forceConfirm`: the pill is a state readout, and an accidental tap
      // on it must not command the car — not even to lock it, which is
      // outside DEFAULT_CONFIRM_ACTIONS. The action comes from the same
      // function the hero used for the tooltip, so what was promised and
      // what gets called cannot diverge.
      void this.callAction(lockToggleAction(state), state, map, t, undefined, true)
    }
    const onLimit = (e: CustomEvent<{ value: number }>) => {
      const call = resolveAction('setChargeLimit', state, map)
      if (call) void this.doCall(call, { value: e.detail.value }).catch(err => this.notifyError(err))
    }
    const onSetNumber = (e: CustomEvent<{ key: LogicalKey; value: number }>) => {
      const { key, value } = e.detail
      const entityId = map[key]
      if (!entityId || !this._hass) return
      void this._hass.callService('number', 'set_value', { value }, { entity_id: entityId })
        .catch(err => this.notifyError(err))
    }
    /**
     * A seat on/off. Mate reports the result a minute or so later, so the
     * request is kept here — not in the section, which can be destroyed
     * meanwhile — and shown as pending until the car's reading moves.
     */
    const onSeat = (e: CustomEvent<{ key: SeatLevelKey }>) => {
      const key = e.detail.key
      const wanted = (state.comfort[key] ?? 0) > 0 ? 0 : 1
      const request = { wanted, reading: state.comfort[key] }
      this._seatRequests[key] = request
      this.requestUpdate()
      const call = resolveAction(key, state, map)
      if (!call) { forgetRequest(this._seatRequests, key, request); return }
      void this.doCall(call).catch(err => {
        if (forgetRequest(this._seatRequests, key, request)) this.requestUpdate()
        this.notifyError(err)
      })
    }
    const onSetSwitch = (e: CustomEvent<{ key: LogicalKey; on: boolean }>) => {
      const entityId = map[e.detail.key]
      if (entityId && this._hass) {
        void this._hass.callService('switch', e.detail.on ? 'turn_on' : 'turn_off', {}, { entity_id: entityId })
          .catch(err => this.notifyError(err))
      }
    }
    const onOpenGroup = (e: CustomEvent<{ group: GroupId }>) => {
      this.showGroup(e.detail.group)
    }
    const onCloseGroup = () => {
      this._focusGroup = this._openGroup
      this.showGroup(undefined)
    }
    const onNav = (e: CustomEvent<{ delta: -1 | 1 }>) => {
      const index = grid.groups.findIndex(group => group.id === this._openGroup)
      if (index < 0) return
      const size = grid.groups.length
      // Wraps around: from the last to the first, and back.
      this.showGroup(grid.groups[(index + e.detail.delta + size) % size]!.id)
    }

    // The same cleanup for the seat levels, and in the same place. Here it
    // fits into a helper because the four requests have the same shape; the
    // two climate-intent fields have different types and stay in the two
    // lines above.
    const shownLevels: SeatLevels = pruneRequests(this._seatRequests, SEAT_LEVEL_KEYS, key => state.comfort[key])

    /**
     * Instantiates a group's sections. A local function, not a method, so
     * it can close over `state`, `map`, `t` and the rest without passing a
     * ten-field context. The card is what instantiates them; the sub-view
     * receives them through the `slot`.
     */
    const panelsFor = (group: ResolvedGroup): TemplateResult => {
      switch (group.id) {
        case 'charging':
          return html`
            <leapmotor-charging
              .state=${state} .t=${t} .language=${language}
              .limitEditable=${!!map.chargeLimitSet}
              .limitMin=${attr<number>(hass, map, 'chargeLimitSet', 'min') ?? 50}
              .limitMax=${attr<number>(hass, map, 'chargeLimitSet', 'max') ?? 100}
              .limitStep=${attr<number>(hass, map, 'chargeLimitSet', 'step') ?? 5}
            ></leapmotor-charging>`
        case 'status':
          return html`
            <leapmotor-openings
              .state=${state} .t=${t} .map=${map} .pending=${this._pending}
            ></leapmotor-openings>
            `
        case 'climate':
          return html`
            <leapmotor-climate-panel
              .state=${state} .t=${t} .map=${map}
              .shownLevels=${shownLevels}
              .maxLevel=${attr<number>(hass, map, 'driverSeatHeat', 'max') ?? 3}
            ></leapmotor-climate-panel>
            <leapmotor-comfort
              .state=${state} .t=${t} .map=${map} .shownLevels=${shownLevels}
              .maxLevel=${attr<number>(hass, map, 'driverSeatHeat', 'max') ?? 3}
            ></leapmotor-comfort>`
        case 'tires':
          return html`<leapmotor-tires .state=${state} .t=${t} .limits=${tireRange}></leapmotor-tires>`
        case 'trip':
          return html`<leapmotor-trip .state=${state} .t=${t} .language=${language}></leapmotor-trip>`
        case 'location':
          return html`<leapmotor-location
            .state=${state} .t=${t} .mapElement=${this._mapElement}
          ></leapmotor-location>`
      }
    }

    // The map is only built when its sub-view is open, instead of on every
    // dashboard load. See spec §5.5.
    if (this._openGroup === 'location' && map.location) this.ensureMap(map.location)

    return html`<ha-card
      @leapmotor-action=${onAction}
      @leapmotor-set-charge-limit=${onLimit}
      @leapmotor-set-number=${onSetNumber}
      @leapmotor-set-switch=${onSetSwitch}
      @leapmotor-seat=${onSeat}
      @leapmotor-range-tap=${onRangeTap}
      @leapmotor-lock-tap=${onLockTap}
    >
      <div class="body">
        ${/*
           * `sections` is no longer a field of `LeapmotorCardConfig`, so
           * reading it has to go through an index: it is a key that no
           * longer exists in the type but still exists in the YAML of
           * whoever has not migrated, and that is precisely why it is read.
           */
          (config as unknown as Record<string, unknown>).sections !== undefined
          ? html`<ha-alert alert-type="warning">${t('error.sections_removed')}</ha-alert>`
          : nothing}

        ${grid.unknown.length > 0
          ? html`<ha-alert alert-type="warning">${t('error.unknown_group', { groups: grid.unknown.join(', ') })}</ha-alert>`
          : nothing}

        <leapmotor-hero
          .state=${state} .t=${t} .now=${now} .name=${name}
          .language=${language} .imageUrl=${imageUrl}
          .showImage=${showImage} .allowSilhouette=${allowSilhouette}
          .compact=${openGroup !== undefined}
          .rangeTap=${rangeTap} .map=${map} .pending=${this._pending}
        ></leapmotor-hero>

        ${openGroup === undefined
          ? html`
            <leapmotor-actions-row
              .state=${state} .t=${t} .map=${map} .actions=${actions} .pending=${this._pending}
            ></leapmotor-actions-row>

            ${grid.groups.length > 0
              ? html`<leapmotor-group-grid
                  .state=${state}
                  .tiles=${grid.groups.map((group): GridTile => ({
                    group,
                    title: group.titleOverride ?? t(group.titleKey),
                    summary: summaryFor(group, state, t, language),
                    alert: alertFor(group, state, tireRange),
                  }))}
                  @leapmotor-open-group=${onOpenGroup}
                ></leapmotor-group-grid>`
              : nothing}`
          : html`
            <leapmotor-group-detail
              .t=${t}
              .heading=${openGroup.titleOverride ?? t(openGroup.titleKey)}
              .navigable=${grid.groups.length > 1}
              .updatedLabel=${formatUpdated(state.lastUpdate, now, t, language)}
              @leapmotor-close=${onCloseGroup}
              @leapmotor-nav=${onNav}
            >${panelsFor(openGroup)}</leapmotor-group-detail>`}

        ${(() => {
          // The core keys are always reported; the groups' keys, only with a
          // hand-written `grid:`. In a default grid a group without entities
          // is simply omitted, and warning about what is not shown would be
          // noise — see `resolveGrid`.
          const missing = [
            ...CORE_KEYS.filter(key => result.missing.includes(key)),
            ...(grid.explicit ? missingForGroups(grid.groups, result.missing) : []),
          ]
          const unique = [...new Set(missing)]
          return unique.length === 0
            ? nothing
            : html`<div class="missing muted" title=${t('missing_entity', { keys: unique.join(', ') })}>
                <ha-icon icon="mdi:alert-outline"></ha-icon>
                ${t('missing_entity_count', { count: unique.length })}
              </div>`
        })()}
      </div>
    </ha-card>`
  }

  static override styles = [sharedStyles, css`
    ha-card { overflow: hidden; }
    .body { padding: var(--lm-gap); }
    .loading { color: var(--lm-muted); }
    .missing { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 0.75rem; }
    .missing ha-icon { --mdc-icon-size: 16px; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-card': LeapmotorCard }
}
