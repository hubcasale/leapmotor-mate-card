import { describe, expect, it } from 'vitest'
import {
  BLOCKED_WHILE_DRIVING, PAYLOAD_ACTIONS, actionIcon, actionLabel, decideAction, forgetRequest,
  isActionAvailable, lockPillShape, lockToggleAction, pendingValue, pruneRequests, resolveAction, shownLevel,
} from '../src/actions'
import { resolveEntities } from '../src/resolver'
import { buildVehicleState } from '../src/vehicle-state'
import { createTranslator } from '../src/localize'
import type { ActionId } from '../src/types'
import { MATE_NOW as REAL_NOW, mateHass as realHass, id as eid } from './fixtures/mate-states'

/**
 * `Record<ActionId, true>`, not an array literal: an object typed this way
 * has to carry every member of the union, so a new action cannot be added
 * without `npm run typecheck` asking for a label for it here.
 */
const ALL_ACTIONS: Record<ActionId, true> = {
  unlock: true, lock: true, trunk: true, windows: true, sunshade: true,
  quickCool: true, quickHeat: true, quickVentilation: true, defrost: true,
  findVehicle: true, unlockCharger: true, refresh: true,
  climate: true, climateOff: true, steeringWheelHeat: true, mirrorHeat: true, batteryPreheat: true,
  driverSeatHeat: true, driverSeatVent: true, passengerSeatHeat: true, passengerSeatVent: true,
  setChargeLimit: true,
}

const t = createTranslator('it')

function ctx(overrides: Record<string, string | null> = {}) {
  const hass = realHass(overrides)
  const { map } = resolveEntities(hass, { type: 'custom:leapmotor-mate-card' })
  return { map, state: buildVehicleState(hass, map, REAL_NOW) }
}

const press = (slug: string) => ({ domain: 'button', service: 'press', entityId: eid('button', slug) })

describe('resolveAction', () => {
  it('unlocks and locks through the lock domain', () => {
    const { map, state } = ctx()
    expect(resolveAction('unlock', state, map)).toEqual({ domain: 'lock', service: 'unlock', entityId: eid('lock', 'door_lock') })
    expect(resolveAction('lock', state, map)?.service).toBe('lock')
  })

  it('opens the trunk when it is closed and closes it when it is open', () => {
    expect(resolveAction('trunk', ...Object.values(ctx()).reverse() as [never, never])).toEqual(press('open_trunk'))
    const open = ctx({ 'binary_sensor/trunk': 'on' })
    expect(resolveAction('trunk', open.state, open.map)).toEqual(press('close_trunk'))
  })

  it('opens the windows when all are closed and closes them when one is open', () => {
    const closed = ctx()
    expect(resolveAction('windows', closed.state, closed.map)).toEqual(press('open_windows'))
    const open = ctx({ 'binary_sensor/window_rear_left': 'on' })
    expect(resolveAction('windows', open.state, open.map)).toEqual(press('close_windows'))
  })

  it('toggles the sunshade with its two buttons', () => {
    const closed = ctx()
    expect(resolveAction('sunshade', closed.state, closed.map)).toEqual(press('open_sunshade'))
    const open = ctx({ 'binary_sensor/sunshade': 'on', 'sensor/sunshade_position': '40' })
    expect(resolveAction('sunshade', open.state, open.map)).toEqual(press('close_sunshade'))
  })

  it('turns the climate on with A/C Auto and off with A/C Off', () => {
    const off = ctx()
    expect(resolveAction('climate', off.state, off.map)).toEqual(press('a_c_auto'))
    const on = ctx({ 'binary_sensor/climate': 'on' })
    expect(resolveAction('climate', on.state, on.map)).toEqual(press('a_c_off'))
  })

  it('has no climate call when Mate hides A/C Off on this car', () => {
    const on = ctx({ 'binary_sensor/climate': 'on', 'button/a_c_off': null })
    expect(resolveAction('climate', on.state, on.map)).toBeUndefined()
    expect(isActionAvailable('climate', on.state, on.map)).toBe(false)
  })

  it('covers every simple button', () => {
    const { map, state } = ctx()
    const table: [ActionId, string][] = [
      ['quickCool', 'quick_cool'], ['quickHeat', 'quick_heat'], ['quickVentilation', 'quick_ventilation'],
      ['defrost', 'defrost'], ['findVehicle', 'find_car'], ['unlockCharger', 'unlock_charge_cable'],
      ['batteryPreheat', 'preheat_battery'], ['climateOff', 'a_c_off'],
    ]
    for (const [action, slug] of table) expect(resolveAction(action, state, map), action).toEqual(press(slug))
  })

  it('has no refresh button: Mate polls the cloud on its own', () => {
    const { map, state } = ctx()
    expect(resolveAction('refresh', state, map)).toBeUndefined()
  })

  it('toggles the steering wheel and the mirrors with their on/off buttons', () => {
    const off = ctx()
    expect(resolveAction('steeringWheelHeat', off.state, off.map)).toEqual(press('steering_heat_on'))
    expect(resolveAction('mirrorHeat', off.state, off.map)).toEqual(press('mirror_heat_on'))
    const on = ctx({ 'sensor/steering_wheel_heat': '1', 'sensor/mirror_heating_left': '1' })
    expect(resolveAction('steeringWheelHeat', on.state, on.map)).toEqual(press('steering_heat_off'))
    expect(resolveAction('mirrorHeat', on.state, on.map)).toEqual(press('mirror_heat_off'))
  })

  it('toggles each seat function with its own pair of buttons, from the level the car reports', () => {
    const off = ctx()
    expect(resolveAction('driverSeatHeat', off.state, off.map)).toEqual(press('driver_seat_heat_on'))
    expect(resolveAction('passengerSeatVent', off.state, off.map)).toEqual(press('passenger_seat_vent_on'))
    const on = ctx({ 'sensor/seat_heating_driver': '2', 'sensor/seat_ventilation_passenger': '1' })
    expect(resolveAction('driverSeatHeat', on.state, on.map)).toEqual(press('driver_seat_heat_off'))
    expect(resolveAction('passengerSeatVent', on.state, on.map)).toEqual(press('passenger_seat_vent_off'))
    // a seat that is on in one function does not turn the other one off
    expect(resolveAction('driverSeatVent', on.state, on.map)).toEqual(press('driver_seat_vent_on'))
  })

  it('has no call for a function Mate does not publish on this car (the B10 case)', () => {
    const b10 = ctx({ 'button/driver_seat_heat_on': null, 'button/driver_seat_heat_off': null, 'button/steering_heat_on': null, 'button/steering_heat_off': null })
    expect(resolveAction('driverSeatHeat', b10.state, b10.map)).toBeUndefined()
    expect(resolveAction('steeringWheelHeat', b10.state, b10.map)).toBeUndefined()
    expect(resolveAction('mirrorHeat', b10.state, b10.map)).toEqual(press('mirror_heat_on'))
  })

  it('sets the charge limit on the number entity, leaving the value to the slider', () => {
    const { map, state } = ctx()
    expect(resolveAction('setChargeLimit', state, map)).toEqual({ domain: 'number', service: 'set_value', entityId: eid('number', 'charge_limit') })
  })

  it('returns undefined when the entity is not in the map', () => {
    const { map, state } = ctx({ 'lock/door_lock': null })
    expect(resolveAction('lock', state, map)).toBeUndefined()
  })
})

describe('actionLabel and actionIcon', () => {
  it('the trunk and windows labels change with the state', () => {
    const closed = ctx()
    const open = ctx({ 'binary_sensor/trunk': 'on', 'binary_sensor/window_front_left': 'on' })
    expect(actionLabel('trunk', closed.state, t)).not.toBe(actionLabel('trunk', open.state, t))
    expect(actionLabel('windows', closed.state, t)).not.toBe(actionLabel('windows', open.state, t))
  })

  it('the climate label says what the tap will do', () => {
    const off = ctx()
    const on = ctx({ 'binary_sensor/climate': 'on' })
    expect(actionLabel('climate', off.state, t)).toBe(t('action.climate_on'))
    expect(actionLabel('climate', on.state, t)).toBe(t('action.climate_off'))
  })

  it('returns an mdi icon for every action', () => {
    const { state } = ctx()
    for (const action of Object.keys(ALL_ACTIONS) as ActionId[]) expect(actionIcon(action, state), action).toMatch(/^mdi:/)
  })

  it('every action has a translated label — none shows the raw key', () => {
    const { state } = ctx()
    for (const action of Object.keys(ALL_ACTIONS) as ActionId[]) {
      const label = actionLabel(action, state, t)
      expect(label, action).not.toMatch(/^action\./)
      expect(label.length, action).toBeGreaterThan(0)
    }
  })
})

describe('pendingValue', () => {
  // The request stores the reading the car gave when it was made, and it's
  // that comparison — not the difference between two renders — that says
  // whether it has been resolved. That's what lets the request live in the
  // card and survive the climate panel collapsing, which is where this
  // defect was born twice.
  it('with no request at all there is no pending value', () => {
    expect(pendingValue(undefined, 24)).toBeUndefined()
  })

  it('stays while the car reports the reading it had at the moment of the request', () => {
    expect(pendingValue({ wanted: 23, reading: 24 }, 24)).toBe(23)
  })

  it('disappears when the car confirms the requested value', () => {
    expect(pendingValue({ wanted: 23, reading: 24 }, 23)).toBeUndefined()
  })

  it('disappears when the car reports a third value (the app, the car itself)', () => {
    expect(pendingValue({ wanted: 23, reading: 24 }, 26)).toBeUndefined()
  })

  it('stays with no reading at all, which is the case of an unavailable entity', () => {
    expect(pendingValue({ wanted: 23, reading: 24 }, undefined)).toBe(23)
  })

  it('treats a request of false as a request, not as a missing field', () => {
    // An `||` somewhere along this path made recirculation-off pass for "no
    // request", and the next command would restore it to on.
    expect(pendingValue({ wanted: false, reading: true }, true)).toBe(false)
    expect(pendingValue({ wanted: false, reading: true }, false)).toBeUndefined()
  })

  it('a request that starts out equal to the reading resolves anyway', () => {
    // Tapping recirculation twice within the batching window, or raising and
    // then lowering the temperature again, records a request with
    // `wanted === reading`. Without the confirmation check, it would never
    // resolve and the control would stay dimmed as "pending" forever.
    expect(pendingValue({ wanted: false, reading: false }, false)).toBeUndefined()
    expect(pendingValue({ wanted: 23, reading: 23 }, 23)).toBeUndefined()
  })

  it('a request made in the dark yields to a new reading', () => {
    // `reading: undefined` is a request made without the car reporting
    // anything; when a reading shows up, it is the best information there is.
    expect(pendingValue({ wanted: 23, reading: undefined }, 26)).toBeUndefined()
  })
})

describe('pruneRequests', () => {
  const KEYS = ['driverSeatHeat', 'driverSeatVent'] as const

  it('erases from the registry the request the car has already resolved', () => {
    // Erasing isn't tidying: a resolved request left in storage would become
    // valid again as soon as the reading returned to its original value —
    // and for a seat level, "going back to 0" is exactly what the car does
    // on its own.
    const requests = { driverSeatHeat: { wanted: 1, reading: 0 } }
    const live = pruneRequests(requests, KEYS, () => 1)
    expect(live).toEqual({})
    expect(requests.driverSeatHeat).toBeUndefined()
    // And this is why it has to be erased: kept around, it would come back
    // to life right here.
    expect(pendingValue({ wanted: 1, reading: 0 }, 0)).toBe(1)
  })

  it('keeps the request the car has not resolved yet, and returns its value', () => {
    const requests = { driverSeatHeat: { wanted: 2, reading: 0 } }
    const live = pruneRequests(requests, KEYS, () => 0)
    expect(live).toEqual({ driverSeatHeat: 2 })
    expect(requests.driverSeatHeat).toEqual({ wanted: 2, reading: 0 })
  })

  it('a key with no request at all does not appear in the result', () => {
    // `toEqual({})` wasn't enough: Vitest doesn't distinguish `{}` from
    // `{ key: undefined }`, and an implementation that let an `undefined`
    // leak into the result would still pass. It's the keys that count.
    const requests: Partial<Record<typeof KEYS[number], { wanted: number; reading?: number }>> = {}
    const live = pruneRequests(requests, KEYS, () => 3)
    expect(Object.keys(live)).toEqual([])
    expect('driverSeatHeat' in live).toBe(false)
  })
})

describe('forgetRequest', () => {
  it('erases the request whose call failed', () => {
    // Without this, a rejected call would leave the request forever: the
    // car's reading never moves, so nothing would resolve it, and the
    // control would show a value the car never actually had.
    const request = { wanted: 1, reading: 0 }
    const requests: Partial<Record<'driverSeatHeat', typeof request>> = { driverSeatHeat: request }
    expect(forgetRequest(requests, 'driverSeatHeat', request)).toBe(true)
    expect('driverSeatHeat' in requests).toBe(false)
  })

  it('does not erase a new request that has since replaced the one that failed', () => {
    // Between the call and the rejection the user may have tapped again;
    // that request is valid and has not failed.
    const failed = { wanted: 1, reading: 0 }
    const newer = { wanted: 2, reading: 0 }
    const requests = { driverSeatHeat: newer }
    expect(forgetRequest(requests, 'driverSeatHeat', failed)).toBe(false)
    expect(requests.driverSeatHeat).toBe(newer)
  })
})

describe('shownLevel', () => {
  // The two sections that show seat levels — the climate panel's pin and the
  // comfort section's row — go through here. They can be visible at the
  // same time and cannot answer different things about the same seat.
  it('the unconfirmed request wins over the reading, and gets marked', () => {
    expect(shownLevel(2, 0)).toEqual({ level: 2, pending: true })
  })

  it('with no request it shows the reading, unmarked', () => {
    expect(shownLevel(undefined, 3)).toEqual({ level: 3, pending: false })
  })

  it('a request for level 0 is a request like any other', () => {
    // With an `||` instead of the `undefined` check, zero would pass for "no
    // request", and the section would show the old level while the other
    // one showed 0.
    expect(shownLevel(0, 3)).toEqual({ level: 0, pending: true })
  })

  it('with no request and no reading there is no level at all', () => {
    expect(shownLevel(undefined, undefined)).toEqual({ level: undefined, pending: false })
  })
})

describe('decideAction', () => {
  it('blocks an openings action while the car is moving', () => {
    // The check can't live only in the button: a panel already open, or a
    // stale render, would bypass a control that is merely disabled.
    const { map, state } = ctx({ 'sensor/state': 'driving' })
    expect(decideAction('unlock', state, map, undefined).kind).toBe('blocked')
    expect(decideAction('sunshade', state, map, undefined).kind).toBe('blocked')
  })

  it('blocks while moving exactly the actions in the list, and no others', () => {
    const { map, state } = ctx({ 'sensor/state': 'driving' })
    for (const action of Object.keys(ALL_ACTIONS) as ActionId[]) {
      // No payload on purpose: the block is decided before the action is
      // resolved, so a payload action gives 'blocked' or 'unavailable',
      // never 'ready', and it's the 'blocked' case being measured here.
      const blocked = decideAction(action, state, map, []).kind === 'blocked'
      expect(blocked, action).toBe(BLOCKED_WHILE_DRIVING.includes(action))
    }
  })

  it('asks for confirmation for the actions in the list, and the call only goes out with a yes', () => {
    const { map, state } = ctx()
    const decision = decideAction('unlock', state, map, undefined)
    expect(decision.kind).toBe('confirm')
    if (decision.kind !== 'confirm') return
    expect(decision.answer(false)).toBeUndefined()
    expect(decision.answer(true)).toEqual({
      domain: 'lock', service: 'unlock', entityId: eid('lock', 'door_lock'),
    })
  })

  it('respects the confirmation list from the configuration', () => {
    const { map, state } = ctx()
    expect(decideAction('unlock', state, map, ['trunk']).kind).toBe('ready')
    expect(decideAction('trunk', state, map, ['trunk']).kind).toBe('confirm')
    expect(decideAction('trunk', state, map, []).kind).toBe('ready')
  })

  it('an action with no entity is not executable', () => {
    const { state } = ctx()
    expect(decideAction('trunk', state, {}, undefined).kind).toBe('unavailable')
  })

  it('forceConfirm asks even for an action outside the list', () => {
    // The hero's lock pill is a state readout, not a button labelled
    // "Lock": an accidental tap on it must not command the car. It confirms
    // in both directions without `lock` entering DEFAULT_CONFIRM_ACTIONS,
    // which would change the actions-row button for everyone who already
    // uses it.
    const { map, state } = ctx()
    const decision = decideAction('lock', state, map, [], undefined, true)
    expect(decision.kind).toBe('confirm')
    if (decision.kind !== 'confirm') return
    expect(decision.answer(false)).toBeUndefined()
    expect(decision.answer(true)).toEqual({
      domain: 'lock', service: 'lock', entityId: eid('lock', 'door_lock'),
    })
  })

  it('forceConfirm does not get past the while-driving block', () => {
    const { map, state } = ctx({ 'sensor/state': 'driving' })
    expect(decideAction('lock', state, map, [], undefined, true).kind).toBe('blocked')
  })

  it('forceConfirm does not invent a call for an action with no entity', () => {
    const { state } = ctx()
    expect(decideAction('lock', state, {}, [], undefined, true).kind).toBe('unavailable')
  })
})

describe('lockPillShape', () => {
  it('is a live button when the car is parked and there is a lock entity', () => {
    const { map, state } = ctx()
    expect(lockPillShape(state, map, undefined)).toBe('button')
  })

  it('goes back to plain text with no lock entity', () => {
    // Not a disabled button: `button.plain[disabled]` drops to 40% opacity,
    // and dimming the reading would suggest the state itself is doubtful
    // when all that is missing is a way to act on it.
    const { state } = ctx()
    expect(lockPillShape(state, {}, undefined)).toBe('text')
  })

  it('goes back to plain text while the car is moving', () => {
    // What the user asked for, and what the actions row already does: no
    // commanding the locks in motion. Text, not a dimmed button — the
    // reading stays as true and as legible as when parked.
    const { map, state } = ctx({ 'sensor/state': 'driving' })
    expect(lockPillShape(state, map, undefined)).toBe('text')
  })

  it('is a busy button while another action is in flight', () => {
    // A button, and disabled, rather than text: this state lasts for the
    // duration of a service call, the dimming is honest feedback that
    // something is happening, and keeping the element a button keeps the
    // keyboard focus that activated it.
    const { map, state } = ctx()
    expect(lockPillShape(state, map, 'refresh')).toBe('busy')
  })
})

describe('lockToggleAction', () => {
  it('offers unlocking only when the car reports itself locked', () => {
    const { state } = ctx()
    expect(state.lock.locked).toBe(true)
    expect(lockToggleAction(state)).toBe('unlock')
  })

  it('offers locking when the car reports itself unlocked', () => {
    const { state } = ctx({ 'lock/door_lock': 'unlocked' })
    expect(state.lock.locked).toBe(false)
    expect(lockToggleAction(state)).toBe('lock')
  })

  it('offers locking, never unlocking, when the state is unknown', () => {
    // Comparison against `true`, like `toggleSwitch` and `actionIcon`: an
    // unreadable lock must never make the card offer to open the car.
    const { state } = ctx({ 'lock/door_lock': 'unavailable' })
    expect(state.lock.locked).toBeUndefined()
    expect(lockToggleAction(state)).toBe('lock')
  })
})

describe('isActionAvailable', () => {
  it('a normal action is available with its own entity and unavailable without it', () => {
    const { map, state } = ctx()
    expect(isActionAvailable('trunk', state, map)).toBe(true)
    const none = ctx({ 'button/open_trunk': null })
    expect(isActionAvailable('trunk', none.state, none.map)).toBe(false)
  })

  it('the sunshade is available when its buttons exist', () => {
    const { map, state } = ctx()
    expect(isActionAvailable('sunshade', state, map)).toBe(true)
    const none = ctx({ 'button/open_sunshade': null })
    expect(isActionAvailable('sunshade', none.state, none.map)).toBe(false)
  })

  it('setChargeLimit is never a row button: its value comes from the slider', () => {
    const { map, state } = ctx()
    expect(PAYLOAD_ACTIONS).toContain('setChargeLimit')
    expect(isActionAvailable('setChargeLimit', state, map)).toBe(false)
  })

  it('answers for every action without throwing', () => {
    const { map, state } = ctx()
    for (const action of Object.keys(ALL_ACTIONS) as ActionId[]) expect(typeof isActionAvailable(action, state, map)).toBe('boolean')
  })

  it('the while-driving list names only existing actions', () => {
    for (const action of BLOCKED_WHILE_DRIVING) expect(Object.keys(ALL_ACTIONS)).toContain(action)
  })
})
