import type { HomeAssistant } from '../../src/ha-types'
import { fakeHass, type FakeEntitySpec } from '../helpers/fake-hass'

/**
 * A parked, locked Leapmotor B10 as Leapmotor Mate publishes it over MQTT
 * discovery: the entity_ids are `<domain>.leapmotor_mate_<vin6>_<slug>`, with
 * the slug of Mate's English entity name. The vin6 here is invented, the
 * coordinates are those of the Colosseum, a public monument — nothing points
 * to a real car or address.
 *
 * Overrides are keyed `domain/slug`; a value of `null` removes the entity,
 * which is how a car that does not have it (or whose Mate hides it) looks.
 */

/** Reference instant for the fixtures. */
export const MATE_NOW = new Date('2026-11-08T12:00:00+00:00')

export const CAR = '5r1234'
export const id = (domain: string, slug: string, car = CAR) => `${domain}.leapmotor_mate_${car}_${slug}`

type Spec = { state: string; unit?: string; attributes?: Record<string, unknown> }

const buttons = [
  'open_trunk', 'close_trunk', 'open_windows', 'close_windows', 'open_sunshade', 'close_sunshade', 'find_car',
  'preheat_battery', 'unlock_charge_cable', 'a_c_auto', 'a_c_off', 'quick_cool', 'quick_heat', 'quick_ventilation',
  'defrost', 'steering_heat_on', 'steering_heat_off', 'mirror_heat_on', 'mirror_heat_off',
  'driver_seat_heat_on', 'driver_seat_heat_off', 'passenger_seat_heat_on', 'passenger_seat_heat_off',
  'driver_seat_vent_on', 'driver_seat_vent_off', 'passenger_seat_vent_on', 'passenger_seat_vent_off',
]
const closedBinaries = [
  'charging', 'plug_connected', 'climate', 'ready', 'door_front_left', 'door_front_right', 'door_rear_left',
  'door_rear_right', 'trunk', 'window_front_left', 'window_front_right', 'window_rear_left', 'window_rear_right',
  'sunshade',
]
const zeroSensors = [
  'seat_heating_driver', 'seat_heating_passenger', 'seat_ventilation_driver', 'seat_ventilation_passenger',
  'steering_wheel_heat', 'mirror_heating_left',
]

export const MATE_SPECS: Record<string, Spec> = {
  'sensor/battery': { state: '64', unit: '%' },
  'sensor/range': { state: '231', unit: 'km' },
  'sensor/odometer': { state: '12345', unit: 'km' },
  'sensor/speed': { state: '0', unit: 'km/h' },
  'sensor/gear': { state: 'P' },
  'sensor/state': { state: 'parked' },
  'sensor/last_seen': { state: '2026-11-08T11:58:00+00:00' },
  'sensor/data_age': { state: '40', unit: 's' },
  'sensor/data_timestamp': { state: '2026-11-08T11:58:00+00:00' },
  'sensor/climate_power': { state: 'unknown', unit: 'W' },
  'sensor/charge_power': { state: 'unknown', unit: 'kW' },
  'sensor/charge_voltage': { state: 'unknown', unit: 'V' },
  'sensor/charge_current': { state: 'unknown', unit: 'A' },
  'sensor/charge_time_remaining': { state: '0', unit: 'min' },
  'sensor/tyre_fl': { state: '2.5', unit: 'bar' },
  'sensor/tyre_fr': { state: '2.5', unit: 'bar' },
  'sensor/tyre_rl': { state: '2.4', unit: 'bar' },
  'sensor/tyre_rr': { state: '2.4', unit: 'bar' },
  'sensor/inside_temp': { state: '19', unit: '°C' },
  'sensor/outside_temp': { state: '11', unit: '°C' },
  'sensor/ac_target': { state: '22', unit: '°C' },
  'sensor/battery_temp': { state: '16', unit: '°C' },
  'sensor/climate_mode': { state: 'unknown' },
  'sensor/sunshade_position': { state: '0', unit: '%' },
  'lock/door_lock': { state: 'locked' },
  'number/fan_level': { state: '3', attributes: { min: 1, max: 7, step: 1 } },
  'number/charge_limit': { state: '80', unit: '%', attributes: { min: 50, max: 100, step: 1 } },
  'switch/air_recirculation': { state: 'off' },
  'device_tracker/location': { state: 'home', attributes: { latitude: 41.8902, longitude: 12.4922 } },
  ...Object.fromEntries(zeroSensors.map(s => [`sensor/${s}`, { state: '0' }])),
  ...Object.fromEntries(closedBinaries.map(s => [`binary_sensor/${s}`, { state: 'off' }])),
  ...Object.fromEntries(buttons.map(s => [`button/${s}`, { state: 'unknown' }])),
}

export function mateSpecs(overrides: Record<string, string | null> = {}, car = CAR): FakeEntitySpec[] {
  const specs: FakeEntitySpec[] = []
  for (const [key, spec] of Object.entries(MATE_SPECS)) {
    const o = overrides[key]
    if (o === null) continue
    const [domain, slug] = key.split('/') as [string, string]
    specs.push({ entity_id: id(domain, slug, car), ...spec, ...(o !== undefined ? { state: o } : {}) })
  }
  return specs
}

export function mateHass(overrides: Record<string, string | null> = {}): HomeAssistant {
  return fakeHass(mateSpecs(overrides))
}
