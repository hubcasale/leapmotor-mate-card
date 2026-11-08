import { describe, expect, it } from 'vitest'
import { resolveEntities } from '../src/resolver'
import { buildVehicleState } from '../src/vehicle-state'
import { MATE_NOW, mateHass } from './fixtures/mate-states'

const CONFIG = { type: 'custom:leapmotor-mate-card' }

function build(overrides: Record<string, string | null> = {}) {
  const hass = mateHass(overrides)
  const { map } = resolveEntities(hass, CONFIG)
  return buildVehicleState(hass, map, MATE_NOW)
}

describe('buildVehicleState — a parked B10', () => {
  it('reads battery, range, odometer and the age of the last message', () => {
    const s = build()
    expect(s.battery).toBe(64)
    expect(s.range).toMatchObject({ km: 231, unit: 'km' })
    expect(s.trip.odometerKm).toBe(12345)
    expect(s.lock.ageSeconds).toBe(40)
    expect(s.lastUpdate?.toISOString()).toBe('2026-11-08T11:58:00.000Z')
    expect(s.online).toBe(true)
  })

  it('is parked, locked and has the charge limit of the number entity', () => {
    const s = build()
    expect(s.activity).toBe('parked')
    expect(s.lock.locked).toBe(true)
    expect(s.chargeLimit).toBe(80)
  })

  it('reads the tyre pressures', () => {
    expect(build().tires).toEqual({ fl: 2.5, fr: 2.5, rl: 2.4, rr: 2.4 })
  })
})

describe('buildVehicleState — activity', () => {
  it('is driving when Mate says so', () => {
    expect(build({ 'sensor/state': 'driving' }).activity).toBe('driving')
  })
  it('is driving with speed even if the state is stale', () => {
    expect(build({ 'sensor/state': 'unknown', 'sensor/speed': '42' }).activity).toBe('driving')
  })
  it('is ready when the car is on but stopped', () => {
    expect(build({ 'sensor/state': 'unknown', 'binary_sensor/ready': 'on' }).activity).toBe('ready')
  })
})

describe('buildVehicleState — charging', () => {
  it('is unplugged by default', () => {
    expect(build().charging.phase).toBe('unplugged')
  })
  it('is plugged when the cable is in but nothing flows', () => {
    expect(build({ 'binary_sensor/plug_connected': 'on' }).charging.phase).toBe('plugged')
  })
  it('is charging with power, voltage, current and the time left', () => {
    const s = build({
      'binary_sensor/plug_connected': 'on', 'binary_sensor/charging': 'on',
      'sensor/charge_power': '6.8', 'sensor/charge_voltage': '230', 'sensor/charge_current': '29.6', 'sensor/charge_time_remaining': '95',
    })
    expect(s.charging).toMatchObject({ phase: 'charging', powerKw: 6.8, voltageV: 230, currentA: 29.6, remainingMinutes: 95, speed: 'slow' })
    expect(s.charging.finishTime?.toISOString()).toBe('2026-11-08T13:35:00.000Z')
  })
  it('calls 7.4 kW and above fast', () => {
    expect(build({ 'binary_sensor/charging': 'on', 'sensor/charge_power': '50' }).charging.speed).toBe('fast')
  })
  it('gives no remaining time when idle: Mate reports 0 then', () => {
    expect(build({ 'sensor/charge_time_remaining': '0' }).charging.remainingMinutes).toBeUndefined()
  })
})

describe('buildVehicleState — openings', () => {
  it('counts a door, a window and the trunk', () => {
    const s = build({ 'binary_sensor/door_front_left': 'on', 'binary_sensor/window_rear_right': 'on', 'binary_sensor/trunk': 'on' })
    expect(s.openings.doors.driver).toBe(true)
    expect(s.openings.doors.passenger).toBe(false)
    expect(s.openings.windows.rr.open).toBe(true)
    expect(s.openings.trunk).toBe(true)
    expect(s.openings.openCount).toBe(3)
  })
  it('reports the sunshade as open with its percentage', () => {
    const s = build({ 'binary_sensor/sunshade': 'on', 'sensor/sunshade_position': '60' })
    expect(s.openings.roof).toBe(true)
    expect(s.openings.sunshadePct).toBe(60)
  })
  it('does not claim a closed door it cannot read', () => {
    expect(build({ 'binary_sensor/door_rear_left': null }).openings.doors.rearLeft).toBeUndefined()
  })
})

describe('buildVehicleState — climate', () => {
  it('reads inside, outside, target, fan and recirculation', () => {
    const c = build({ 'switch/air_recirculation': 'on' }).climate
    expect(c).toMatchObject({ on: false, interiorC: 19, outsideC: 11, targetC: 22, fan: 3, recirculating: true })
  })
  it('is on when the climate binary sensor is on', () => {
    expect(build({ 'binary_sensor/climate': 'on' }).climate.on).toBe(true)
  })
})

describe('buildVehicleState — comfort', () => {
  it('reads seat levels as numbers', () => {
    const c = build({ 'sensor/seat_heating_driver': '2', 'sensor/seat_ventilation_passenger': '1' }).comfort
    expect(c.driverSeatHeat).toBe(2)
    expect(c.passengerSeatVent).toBe(1)
    expect(c.driverSeatVent).toBe(0)
  })
  it('reads the steering wheel and mirrors, which Mate reports as levels, as on/off', () => {
    expect(build().comfort).toMatchObject({ steeringWheelHeat: false, mirrorHeat: false })
    expect(build({ 'sensor/steering_wheel_heat': '1', 'sensor/mirror_heating_left': '1' }).comfort).toMatchObject({ steeringWheelHeat: true, mirrorHeat: true })
  })
  it('knows nothing of a function the car does not report (the B10 case)', () => {
    const c = build({ 'sensor/seat_heating_driver': null, 'sensor/steering_wheel_heat': null }).comfort
    expect(c.driverSeatHeat).toBeUndefined()
    expect(c.steeringWheelHeat).toBeUndefined()
  })
})

describe('buildVehicleState — location', () => {
  it('reads the coordinates and the age of the last message', () => {
    const l = build().location
    expect(l).toMatchObject({ latitude: 41.8902, longitude: 12.4922, ageSeconds: 40, stale: false })
  })
  it('names no zone: Mate\'s tracker says "home" whenever it has coordinates', () => {
    expect(build().location?.zone).toBeUndefined()
  })
  it('is stale when the car has been silent for a long time', () => {
    expect(build({ 'sensor/data_age': '3600' }).location?.stale).toBe(true)
  })
  it('has no location without coordinates', () => {
    const hass = mateHass()
    const id = Object.keys(hass.states).find(k => k.startsWith('device_tracker.'))!
    hass.states[id]!.attributes = {}
    const { map } = resolveEntities(hass, CONFIG)
    expect(buildVehicleState(hass, map, MATE_NOW).location).toBeUndefined()
  })
})
