import { isWindowOpen } from './format'
import type { TranslateFn } from './localize'
import { DEFAULT_CONFIRM_ACTIONS, type ActionId, type EntityMap, type VehicleState } from './types'
import type { LogicalKey, SeatLevelKey } from './keys'

export interface ServiceCall {
  domain: string
  service: string
  entityId: string
  data?: Record<string, unknown>
}

function press(map: EntityMap, key: LogicalKey): ServiceCall | undefined {
  const entityId = map[key]
  return entityId ? { domain: 'button', service: 'press', entityId } : undefined
}

/**
 * Mate commands the comfort functions with a pair of buttons (`…_on` /
 * `…_off`) and reports the state in a separate sensor: pressing the one that
 * reverses the reading is the toggle. With no reading it offers "on", like
 * every other toggle in this card — never an unrequested "off".
 */
function pressPair(map: EntityMap, onKey: LogicalKey, offKey: LogicalKey, on: boolean | undefined): ServiceCall | undefined {
  return press(map, on === true ? offKey : onKey)
}

function anyWindowOpen(state: VehicleState): boolean {
  return Object.values(state.openings.windows).some(isWindowOpen)
}

/**
 * A user request the car hasn't confirmed yet, along with the reading the
 * car was giving at the moment it was made.
 */
export interface PendingRequest<T> {
  wanted: T
  reading?: T
}

/**
 * The value of a request while it still matters, or `undefined` once it no
 * longer does. The rule is the usual one — the request stops being relevant
 * once the car confirms the requested value or reports some other one (from
 * the app, or the car itself) — but written against the reading stored with
 * the request, not against the previous render's reading. That's what keeps
 * this a pure function, evaluable anywhere and at any time, and it's what
 * lets the request live in the card and survive the panel being destroyed.
 */
export function pendingValue<T>(request: PendingRequest<T> | undefined, reported: T | undefined): T | undefined {
  if (request === undefined) return undefined
  // With no reading at all there's no way to know if the car reacted: the request stands.
  if (reported === undefined) return request.wanted
  // The car reports the requested value: request fulfilled. This has to come
  // before the comparison with the origin reading, otherwise a request that's
  // born equal to the reading — tapping recirculation twice within the
  // window, raising and then lowering the temperature back, cycling a seat
  // back to its starting point — would never resolve and would stay marked
  // as pending forever.
  if (reported === request.wanted) return undefined
  // The car is still reporting what it was reporting when the request was
  // made, so it hasn't reacted yet. Any other reading resolves the request;
  // so does a new reading after a request made blind (`reading` undefined),
  // since it's the best information there is.
  return reported === request.reading ? request.wanted : undefined
}

/**
 * The unconfirmed seat level requests (what the card stores) and the already
 * resolved levels the sections display. Two types and two names on purpose:
 * the same name for both shapes has already produced, in this project, six
 * defects of the same family — and here the link between the card and the
 * sections is a Lit property binding, which TypeScript doesn't check.
 */
export type SeatRequests = Partial<Record<SeatLevelKey, PendingRequest<number>>>
export type SeatLevels = Partial<Record<SeatLevelKey, number>>

/**
 * What to do with a tap on an action, decided without touching the DOM or
 * `hass`.
 *
 * The `confirm` variant doesn't carry the call: it carries a function that
 * **requires** the user's answer to return it. This is on purpose — this way
 * there's no way to skip confirmation without breaking the build, and the
 * same goes for the first two cases, which have no `call` at all to read.
 */
export type CommandDecision =
  | { kind: 'blocked' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; call: ServiceCall }
  | { kind: 'confirm'; answer: (confirmed: boolean) => ServiceCall | undefined }

export function decideAction(
  action: ActionId,
  state: VehicleState,
  map: EntityMap,
  confirmActions: ActionId[] | undefined,
  payload?: ActionPayload,
  /**
   * Confirms regardless of the configuration. It exists for the hero's lock
   * pill, which is a state READOUT and not a button labelled "Lock": an
   * accidental tap on it must not command the car, in either direction. The
   * alternative — putting `lock` in `DEFAULT_CONFIRM_ACTIONS` — would add a
   * dialog to the actions-row button for everyone who already uses it, which
   * nobody asked for. Note where it sits: AFTER the block and after
   * availability, so it can neither get past a car in motion nor invent a
   * call that `resolveAction` did not produce.
   */
  forceConfirm?: boolean,
): CommandDecision {
  // The while-driving block has to be decided here, not only in the button: a
  // panel that's already open, or a stale render, would bypass a check that
  // only disabled controls.
  if (state.activity === 'driving' && BLOCKED_WHILE_DRIVING.includes(action)) return { kind: 'blocked' }
  const call = resolveAction(action, state, map, payload)
  if (!call) return { kind: 'unavailable' }
  if (!forceConfirm && !(confirmActions ?? DEFAULT_CONFIRM_ACTIONS).includes(action)) {
    return { kind: 'ready', call }
  }
  return { kind: 'confirm', answer: confirmed => (confirmed ? call : undefined) }
}

/**
 * How the hero's lock pill presents itself. Here, and not in the section,
 * for the same reason as `decideAction`: availability, the motion block and
 * the in-flight action are rules, and a rule that lives in a `render()` is
 * a rule no test can reach.
 *
 * The three shapes are not interchangeable. `text` is the pill exactly as
 * it has always looked — it is what a car with no lock entity gets, and
 * what a MOVING car gets, because `button.plain[disabled]` drops to 40%
 * opacity and dimming a state readout would suggest the reading itself is
 * doubtful when all that is missing is permission to act on it. `busy` stops
 * being about the reading and starts being about the call: it lasts as long
 * as one service call, the dimming is honest feedback that something is
 * happening, and staying a `<button>` keeps the keyboard focus of whoever
 * activated it.
 */
export function lockPillShape(
  state: VehicleState,
  map: EntityMap,
  pending: ActionId | undefined,
): 'text' | 'button' | 'busy' {
  const action = lockToggleAction(state)
  if (!isActionAvailable(action, state, map)) return 'text'
  // Through the constant, and not `activity === 'driving'` on its own:
  // which actions motion blocks is decided in a single place, and
  // `decideAction` refuses this same tap on those same grounds.
  if (state.activity === 'driving' && BLOCKED_WHILE_DRIVING.includes(action)) return 'text'
  return pending === undefined ? 'button' : 'busy'
}

/**
 * Which of the two lock actions a tap on the state offers. Comparison
 * against `true`, like `toggleSwitch` and `actionIcon`: an unreadable lock
 * offers to LOCK, never to open the car. The hero's pill shows the closed
 * padlock in that same case, so what it promises and what it does agree.
 */
export function lockToggleAction(state: VehicleState): ActionId {
  return state.lock.locked === true ? 'unlock' : 'lock'
}

/**
 * Applies `pendingValue` to a set of requests with the same shape: returns
 * the ones that still hold and **deletes** from the registry itself the ones
 * that no longer do. The deletion isn't housekeeping: a resolved request left
 * in storage would become valid again as soon as the reading went back to
 * the value it had when it was made — for a seat level, "going back to 0" is
 * what the car does on its own after some time, and the pin would end up
 * showing a level the seat no longer had.
 */
export function pruneRequests<K extends string, T>(
  requests: Partial<Record<K, PendingRequest<T>>>,
  keys: readonly K[],
  reported: (key: K) => T | undefined,
): Partial<Record<K, T>> {
  const live: Partial<Record<K, T>> = {}
  for (const key of keys) {
    const value = pendingValue(requests[key], reported(key))
    if (value === undefined) delete requests[key]
    else live[key] = value
  }
  return live
}

/**
 * Gives up on a request whose service call failed. Without this the request
 * would stay forever: the car's reading never gets to move, so `pendingValue`
 * would keep returning it — the control would show a value the car never
 * had, and the next tap would start from that phantom value.
 *
 * Only deletes if it's still the SAME request: between the call and the
 * rejection the user may have tapped again, and that new request is valid
 * and hasn't failed yet. Returns whether it deleted anything, so the caller
 * knows whether it needs to request a render.
 */
export function forgetRequest<K extends string, T>(
  requests: Partial<Record<K, PendingRequest<T>>>,
  key: K,
  request: PendingRequest<T>,
): boolean {
  if (requests[key] !== request) return false
  delete requests[key]
  return true
}

/**
 * What a section shows for a seat level: the unconfirmed request wins over
 * the car's reading, and gets marked as pending. The two sections that show
 * levels — the climate panel's pin and the comfort section's row — go
 * through here, so they can't disagree about the same seat on the same
 * screen.
 *
 * `pending === undefined` and not a falsy value: a level **0** request is a
 * request like any other, and a `||` here would make it pass as "no
 * request".
 */
export function shownLevel(
  pending: number | undefined,
  reported: number | undefined,
): { level: number | undefined; pending: boolean } {
  return pending === undefined ? { level: reported, pending: false } : { level: pending, pending: true }
}

/**
 * What an action needs beyond the vehicle state, with one field per action
 * instead of a loose number. The previous `value: number` meant different
 * things depending on the action, and that ambiguity produced this project's
 * worst defects.
 */
export interface ActionPayload {
  /** Reserved: no action takes a value any more, but the event shape stays stable. */
  readonly _?: never
}

/**
 * The `detail` of the `leapmotor-mate-action` event. Sections don't call
 * services: what they emit is this object, and `leapmotor-mate-card.ts` is what
 * resolves it. It exists as a type — and not as a literal repeated in every
 * emitter — because a swapped `value:` or `payload:` in one of them would
 * compile, pass the tests, and only show up on a user's dashboard with a
 * control that stopped commanding the car.
 */
export interface ActionEventDetail {
  action: ActionId
  payload?: ActionPayload
}

export function resolveAction(
  action: ActionId,
  state: VehicleState,
  map: EntityMap,
  _payload?: ActionPayload,
): ServiceCall | undefined {
  switch (action) {
    case 'unlock':
    case 'lock': {
      const entityId = map.lock
      return entityId ? { domain: 'lock', service: action, entityId } : undefined
    }
    case 'trunk':
      return press(map, state.openings.trunk === true ? 'closeTrunk' : 'openTrunk')
    case 'windows':
      return press(map, anyWindowOpen(state) ? 'closeWindows' : 'openWindows')
    case 'sunshade':
      // Mate only has open and close for the sunshade (the position it
      // reports is read-only), so this is a toggle on the roof's state.
      return press(map, state.openings.roof === true ? 'closeSunshade' : 'openSunshade')
    case 'quickCool': return press(map, 'quickCool')
    case 'quickHeat': return press(map, 'quickHeat')
    case 'quickVentilation': return press(map, 'quickVentilation')
    case 'defrost': return press(map, 'windshieldDefrost')
    case 'findVehicle': return press(map, 'findVehicle')
    case 'unlockCharger': return press(map, 'unlockCharger')
    case 'refresh': return press(map, 'refreshData')
    // Auto is the plain "on" (the car picks cooling or heating itself); off
    // is its own button, which Mate hides on the cars where it does nothing.
    case 'climate': return state.climate.on === true ? press(map, 'climateOff') : press(map, 'climateAuto')
    case 'climateOff': return press(map, 'climateOff')
    case 'steeringWheelHeat': return pressPair(map, 'steeringWheelHeatOn', 'steeringWheelHeatOff', state.comfort.steeringWheelHeat)
    case 'mirrorHeat': return pressPair(map, 'mirrorHeatOn', 'mirrorHeatOff', state.comfort.mirrorHeat)
    case 'driverSeatHeat': return pressPair(map, 'driverSeatHeatOn', 'driverSeatHeatOff', seatOn(state.comfort.driverSeatHeat))
    case 'driverSeatVent': return pressPair(map, 'driverSeatVentOn', 'driverSeatVentOff', seatOn(state.comfort.driverSeatVent))
    case 'passengerSeatHeat': return pressPair(map, 'passengerSeatHeatOn', 'passengerSeatHeatOff', seatOn(state.comfort.passengerSeatHeat))
    case 'passengerSeatVent': return pressPair(map, 'passengerSeatVentOn', 'passengerSeatVentOff', seatOn(state.comfort.passengerSeatVent))
    case 'batteryPreheat': return press(map, 'batteryPreheat')
    case 'setChargeLimit': {
      // Returns the call without `data` on purpose: the value comes from the
      // charging panel's slider, which `onLimit` passes as `extra` to
      // `doCall`.
      const entityId = map.chargeLimitSet
      return entityId ? { domain: 'number', service: 'set_value', entityId } : undefined
    }
  }
}

/** A seat level as a plain on/off, `undefined` when the car does not say. */
function seatOn(level: number | undefined): boolean | undefined {
  return level === undefined ? undefined : level > 0
}

export function actionLabel(action: ActionId, state: VehicleState, t: TranslateFn): string {
  if (action === 'trunk') return t(state.openings.trunk === true ? 'action.trunk_close' : 'action.trunk_open')
  if (action === 'windows') return t(anyWindowOpen(state) ? 'action.windows_close' : 'action.windows_open')
  // Climate is the only toggle in this list whose label didn't say what the
  // tap does: the state could only be read from the button's highlight, and
  // a user who wanted to turn it off had no way to know it was there. The
  // condition is the SAME as `toggleSwitch`'s in `resolveAction` — comparison
  // against `true`, so that an unknown state promises "turn on", which is
  // what it will actually do. The neutral `action.climate` key stays confined
  // to the editor, where the action is chosen and not executed.
  if (action === 'climate') return t(state.climate.on === true ? 'action.climate_off' : 'action.climate_on')
  return t(`action.${action}`)
}

export function actionIcon(action: ActionId, state: VehicleState): string {
  switch (action) {
    case 'unlock': return 'mdi:lock-open-variant-outline'
    case 'lock': return 'mdi:lock-outline'
    case 'trunk': return state.openings.trunk === true ? 'mdi:car-back' : 'mdi:car-estate'
    case 'windows': return anyWindowOpen(state) ? 'mdi:car-door' : 'mdi:car-door-lock'
    case 'sunshade': return 'mdi:window-shutter'
    case 'quickCool': return 'mdi:snowflake'
    case 'quickHeat': return 'mdi:fire'
    case 'defrost': return 'mdi:car-defrost-front'
    case 'findVehicle': return 'mdi:map-marker-radius-outline'
    case 'unlockCharger': return 'mdi:ev-plug-type2'
    case 'refresh': return 'mdi:refresh'
    case 'climate': return 'mdi:fan'
    case 'climateOff': return 'mdi:fan-off'
    case 'quickVentilation': return 'mdi:fan'
    case 'driverSeatHeat':
    case 'passengerSeatHeat': return 'mdi:car-seat-heater'
    case 'driverSeatVent':
    case 'passengerSeatVent': return 'mdi:car-seat-cooler'
    case 'steeringWheelHeat': return 'mdi:steering'
    case 'mirrorHeat': return 'mdi:car-side'
    case 'batteryPreheat': return 'mdi:battery-heart-variant'
    case 'setChargeLimit': return 'mdi:battery-charging-80'
  }
}

/** Actions that must not be possible while the car is driving. */
export const BLOCKED_WHILE_DRIVING: ActionId[] = ['unlock', 'lock', 'trunk', 'windows', 'sunshade']

/**
 * Mate publishes no action that needs a value from a panel, so there is no
 * expandable panel and every action is a plain button. The type stays so
 * the card's expansion plumbing keeps one definition.
 */
export type ExpandPanel = never

/** Actions whose `resolveAction` needs a value that only a control supplies. */
export const PAYLOAD_ACTIONS: ActionId[] = ['setChargeLimit']

/** Which panel each action opens, when it opens one at all: none. */
export const CONTROL_PANEL: Partial<Record<ActionId, ExpandPanel>> = {}

/**
 * Can this action be a button here? Payload actions have no panel, so they
 * cannot be a button even if the car is addressable.
 */
export function isActionAvailable(action: ActionId, state: VehicleState, map: EntityMap): boolean {
  if (PAYLOAD_ACTIONS.includes(action)) return false
  return resolveAction(action, state, map) !== undefined
}
