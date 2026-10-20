import { fakeHass, type FakeEntitySpec } from '../helpers/fake-hass'

/**
 * Copy of the real output of the `leapmotor` integration, with personal data
 * replaced: the vehicle identifier is `000000`, the device name is `Demo`,
 * and the coordinates are those of the Torre de Belém, a public monument.
 * The SHAPE is the real one and that's what matters — same keys, same units,
 * same value formats — because this fixture is the only description the
 * project has of what the integration produces. Nothing here points to a car
 * or to an address.
 */

/** Reference instant for the fixtures: 2026-08-27 13:36 UTC. */
export const REAL_NOW = new Date('2026-08-27T13:36:00+00:00')

const P = 'leapmotor_b10_000000_demo'
const M = 'leapmotor_b10_000000_main'

/**
 * The per-day breakdown behind the two seven-day sensors, which BOTH carry
 * this same block of attributes — the repetition is the integration's, and
 * it is what lets the card read the rows from whichever of the two it has.
 *
 * Three properties of the real payload are reproduced deliberately, because
 * they are what the card has to survive:
 *
 *  - **EIGHT days on a sensor named for seven.** The API decides the length
 *    of the period, and on the real car it answered with eight. Anything in
 *    the card that assumes seven has to fail against this fixture.
 *  - **The last day comes in zeroed**, odometer included — an odometer that
 *    drops to zero is impossible, and it is what the API sends for the day
 *    still in progress. The card does not read `odometer_km`, and the row
 *    still counts as a genuine day at 0 km.
 *  - **Energy in whole kilowatt-hours.** Never a tenth, on any day. The
 *    card no longer reads `energy_kwh` at all — see `parseDailyDetail` — and
 *    it stays in the payload precisely because this fixture is what the
 *    integration sends, not what the card keeps: the parser dropping it is
 *    asserted against these rows.
 *
 * What these numbers are answerable to, since a fixture nobody can check is
 * a fixture that drifts:
 *
 *  - The distances add up to the 642 km of `last_7_days_mileage_km`, the
 *    energies to the 115.0 kWh of `last_7_days_energy_kwh`, and the running
 *    odometer arrives at the 659 km of `odometer_km`, each day's step being
 *    that day's `mileage_km`.
 *  - They agree with `weekly_consumption`, which the sub-view draws three
 *    lines above this block and which was here first. The four days of week
 *    2026-08-17…23 that fall inside this window are 363 km on 75 kWh, or
 *    20.7 kWh/100 km, which is what that week reports to the tenth. The four
 *    of week 2026-08-24…30 are 279 km on 40 kWh, or 14.3 against the 14.2
 *    reported — the gap is the whole kilowatt-hour these rows are quantized
 *    to, and it is the closest agreement integers allow.
 *
 * What they are NOT answerable to, and it predates them: `total_energy_kwh`
 * over `total_mileage_km` is 131.0 / 661 = 19.8 kWh/100 km, well above the
 * 17.9 these eight days come to. That tension is between the lifetime totals
 * and `weekly_consumption`, both captured from the real car at different
 * moments, and it existed before there were any daily rows — 642 of those
 * 661 km are the two weeks reporting 20.7 and 14.2. These rows take the side
 * of the weekly series, which is the block they sit next to and the one they
 * would visibly contradict; rewriting the lifetime totals instead would mean
 * editing numbers a dozen other tests assert.
 */
const DAILY_DETAIL = [
  { date: '2026-08-20', timestamp: 1787184000000, odometer_km: 77.0, mileage_km: 60.0, mileage_mi: 37.3, energy_kwh: 12.0 },
  { date: '2026-08-21', timestamp: 1787270400000, odometer_km: 172.0, mileage_km: 95.0, mileage_mi: 59.0, energy_kwh: 20.0 },
  { date: '2026-08-22', timestamp: 1787356800000, odometer_km: 260.0, mileage_km: 88.0, mileage_mi: 54.7, energy_kwh: 18.0 },
  { date: '2026-08-23', timestamp: 1787443200000, odometer_km: 380.0, mileage_km: 120.0, mileage_mi: 74.6, energy_kwh: 25.0 },
  { date: '2026-08-24', timestamp: 1787529600000, odometer_km: 427.0, mileage_km: 47.0, mileage_mi: 29.2, energy_kwh: 7.0 },
  { date: '2026-08-25', timestamp: 1787616000000, odometer_km: 560.0, mileage_km: 133.0, mileage_mi: 82.6, energy_kwh: 19.0 },
  { date: '2026-08-26', timestamp: 1787702400000, odometer_km: 659.0, mileage_km: 99.0, mileage_mi: 61.5, energy_kwh: 14.0 },
  { date: '2026-08-27', timestamp: 1787788800000, odometer_km: 0.0, mileage_km: 0.0, mileage_mi: 0.0, energy_kwh: 0.0 },
]

/**
 * The same eight days as the card ends up holding them once the parser has
 * had them, ON THE INTEGRATION ABOVE: the day and the distance, and nothing
 * else. `odometer_km`, `mileage_mi` and `timestamp` are dropped because the
 * card has no use for them and a structure carrying them would invite one;
 * `energy_kwh` is dropped because this payload declares neither an
 * `energy_scope` nor an `energy_unit`, which together are the gate
 * `parseDailyDetail` in `src/vehicle-state.ts` puts in front of the energy.
 * `EXPECTED_DAYS_WITH_ENERGY` below is the same eight days as they come out
 * of the integration that declares both.
 *
 * It is therefore also what the card holds on v0.7.2, which declares the
 * scope and no unit, and on a T03, whose unit is `null`.
 *
 * It lives beside the payload it is the projection of, so that a change to
 * one is made in sight of the other, and it is shared by the parser's tests
 * and the section's.
 */
export const EXPECTED_DAYS = [
  { date: '2026-08-20', distanceKm: 60 },
  { date: '2026-08-21', distanceKm: 95 },
  { date: '2026-08-22', distanceKm: 88 },
  { date: '2026-08-23', distanceKm: 120 },
  { date: '2026-08-24', distanceKm: 47 },
  { date: '2026-08-25', distanceKm: 133 },
  { date: '2026-08-26', distanceKm: 99 },
  // The day still in progress, which the API sends zeroed. A day at 0 km is
  // a day, and it keeps its place in the period.
  { date: '2026-08-27', distanceKm: 0 },
]

/**
 * The attribute block both seven-day sensors publish on integration v0.7.0
 * and v0.7.1, byte for byte — which is what the card's author is running and
 * what the great majority of installations are. There is no `energy_scope`
 * anywhere in it, and that absence is load-bearing: it is what keeps the
 * per-day energy off the screen for every test that renders this fixture.
 */
export const SEVEN_DAY_ATTRIBUTES = {
  daily_detail: DAILY_DETAIL,
  energy_complete: true,
  detail_days: 8,
  detail_mileage_km: 642.0,
  covered_mileage_km: 642.0,
  period_mileage_km: 642.0,
}

/**
 * The same eight days as integration v0.7.2 sends them: every row gains a
 * `driving_energy_kwh` beside the `energy_kwh` it always had, carrying the
 * SAME value. The duplication is upstream's, kept for compatibility with
 * whatever already read the old name, and it is the whole reason the card
 * prefers one key and falls back to the other.
 */
const DAILY_DETAIL_V072 = DAILY_DETAIL.map(day => ({ ...day, driving_energy_kwh: day.energy_kwh }))

/**
 * The attribute block of integration v0.7.2, which changed no value and only
 * what the values claim: the three `energy_*` attributes below are new, the
 * seven-day energy sensor was renamed "Last 7 days driving energy (presumed)"
 * upstream, and its documentation states these figures are not the vehicle's
 * total energy consumption.
 *
 * **It names what the figures are presumed to count and not what they are
 * measured in, so the card prints no energy on it.** That is load-bearing and
 * it is half the point of keeping this fixture beside the v0.7.3 one below: a
 * scope alone stopped being enough when upstream shipped a car whose unit it
 * could not vouch for, and this payload is what "half a label" looks like.
 */
export const SEVEN_DAY_ATTRIBUTES_SCOPED = {
  ...SEVEN_DAY_ATTRIBUTES,
  daily_detail: DAILY_DETAIL_V072,
  energy_source: 'accumulatedEnergyConsume',
  energy_scope: 'presumed_driving_only',
  energy_scope_confirmed: false,
}

/**
 * The same eight days as integration v0.7.3 sends them on a B10: every row
 * gains the cloud's untouched `energy_raw` and the `energy_unit` that says
 * what it is in, beside the two figures v0.7.2 already carried. `energy_raw`
 * equals the rest here because on this car the cloud's number IS kilowatt
 * hours; the card reads none of it and takes `driving_energy_kwh`.
 */
const DAILY_DETAIL_V073 = DAILY_DETAIL_V072.map(day => ({
  ...day, energy_raw: day.energy_kwh, energy_unit: 'kWh',
}))

/**
 * The attribute block of integration v0.7.3 on a B10 — the first version that
 * says what the per-day figures ARE and not only what they are presumed to
 * count, and therefore the first on which this card prints them.
 *
 * `energy_unit` is the addition that matters: `kWh` here, `null` on the T03
 * below until v0.7.4. The other three are read by nothing —
 * `energy_precision` is upstream stating that the whole-kilowatt-hour
 * rounding happened in the cloud before the integration ever saw the values, `energy_complete_scope` names what
 * `energy_complete` covers, and `energy_unavailable_reason` is `null` because
 * nothing is being withheld.
 *
 * `energy_scope_confirmed` is `false`, and stays `false` here, because that
 * is what the integration ships: the maintainer cannot confirm the
 * driving-only reading from his own captures. The tests that need the other
 * answer override this one field, which is exactly the change the card has to
 * survive without a string being edited.
 */
export const SEVEN_DAY_ATTRIBUTES_LABELED = {
  ...SEVEN_DAY_ATTRIBUTES_SCOPED,
  daily_detail: DAILY_DETAIL_V073,
  energy_unit: 'kWh',
  energy_unavailable_reason: null,
  energy_precision: 'as_reported_by_cloud',
  energy_complete_scope: 'fields_and_mileage_coverage',
}

/**
 * Integration v0.7.3 on a T03, which is the case the unit gate exists for.
 * The cloud's magnitudes contradict the kilowatt-hour contract, upstream
 * refuses to guess a factor of a thousand, so it publishes the bare number in
 * `energy_raw`, leaves both kilowatt-hour fields as `None`, and says why in
 * `energy_unavailable_reason`.
 *
 * Both halves matter to the card. The rows are what it looks like today —
 * nothing usable to print, by luck rather than by rule — and the `null` unit
 * is the rule: even if a future payload put a number back in one of those
 * fields, an unverified unit keeps it off the screen.
 */
const DAILY_DETAIL_T03 = DAILY_DETAIL.map(day => ({
  ...day,
  energy_kwh: null,
  driving_energy_kwh: null,
  energy_raw: day.energy_kwh,
  energy_unit: null,
}))

export const SEVEN_DAY_ATTRIBUTES_T03 = {
  ...SEVEN_DAY_ATTRIBUTES_LABELED,
  daily_detail: DAILY_DETAIL_T03,
  energy_unit: null,
  energy_unavailable_reason: 'unverified_unit',
}

/**
 * A T03 on integration v0.7.4, from the payload published in
 * https://github.com/kerniger/leapmotor-ha/issues/67 on 2026-09-23 (vehicle in
 * Europe/Rome). Upstream matched the day's `1250` against the cloud's own
 * 1.3 kWh for the same day and settled on watt-hours for this model, so the
 * rows now carry kilowatt-hours converted from them: `energy_unit` is `kWh`,
 * `energy_source_unit` says what the cloud sent, and `energy_raw` keeps the
 * cloud's number.
 *
 * Two other v0.7.4 changes show here. `date` is the local calendar day of the
 * row's local-midnight `timestamp`, where v0.7.3 wrote the UTC day before it,
 * and `source_date` keeps the cloud's label; the card reads `date` and nothing
 * else. And the figures have three decimals, which is what the column's
 * precision has to follow.
 */
const DAILY_DETAIL_T03_V074 = [
  { date: '2026-09-17', source_date: '2026-09-16', mileage_km: 2, energy_raw: 274 },
  { date: '2026-09-18', source_date: '2026-09-17', mileage_km: 0, energy_raw: 0 },
  { date: '2026-09-19', source_date: '2026-09-18', mileage_km: 0, energy_raw: 0 },
  { date: '2026-09-20', source_date: '2026-09-19', mileage_km: 5, energy_raw: 721 },
  { date: '2026-09-21', source_date: '2026-09-20', mileage_km: 0, energy_raw: 0 },
  { date: '2026-09-22', source_date: '2026-09-21', mileage_km: 4, energy_raw: 529 },
  { date: '2026-09-23', source_date: '2026-09-22', mileage_km: 13, energy_raw: 1250 },
].map(day => ({
  ...day,
  driving_energy_kwh: day.energy_raw / 1000,
  energy_kwh: day.energy_raw / 1000,
  energy_unit: 'kWh',
  energy_source_unit: 'Wh',
}))

export const SEVEN_DAY_ATTRIBUTES_T03_V074 = {
  ...SEVEN_DAY_ATTRIBUTES_LABELED,
  daily_detail: DAILY_DETAIL_T03_V074,
  energy_unit: 'kWh',
  energy_source_unit: 'Wh',
  history_timezone: 'Europe/Rome',
  energy_unavailable_reason: null,
}

/**
 * A hypothetical later integration that verified the unit to be something
 * else, and said so. It is synthetic, and it is the sharpest test of the gate
 * there is: the compatibility keys upstream never renamed still read
 * `..._kwh`, and they now hold watt-hours. A card that trusted the key name
 * instead of the declared unit would print `12000 kWh` for a sixty-kilometer
 * day.
 */
const DAILY_DETAIL_WH = DAILY_DETAIL.map(day => ({
  ...day,
  energy_kwh: day.energy_kwh * 1000,
  driving_energy_kwh: day.energy_kwh * 1000,
  energy_raw: day.energy_kwh * 1000,
  energy_unit: 'Wh',
}))

export const SEVEN_DAY_ATTRIBUTES_UNKNOWN_UNIT = {
  ...SEVEN_DAY_ATTRIBUTES_LABELED,
  daily_detail: DAILY_DETAIL_WH,
  energy_unit: 'Wh',
}

/**
 * The eight days as the card holds them from `SEVEN_DAY_ATTRIBUTES_LABELED`:
 * the distances unchanged, and the energy alongside them because that
 * integration says both what it counts and what it is in. Written out rather
 * than derived from `EXPECTED_DAYS`, so that the pairing of a distance with an
 * energy is visible to whoever reviews a change to either.
 */
export const EXPECTED_DAYS_WITH_ENERGY = [
  { date: '2026-08-20', distanceKm: 60, energyKwh: 12 },
  { date: '2026-08-21', distanceKm: 95, energyKwh: 20 },
  { date: '2026-08-22', distanceKm: 88, energyKwh: 18 },
  { date: '2026-08-23', distanceKm: 120, energyKwh: 25 },
  { date: '2026-08-24', distanceKm: 47, energyKwh: 7 },
  { date: '2026-08-25', distanceKm: 133, energyKwh: 19 },
  { date: '2026-08-26', distanceKm: 99, energyKwh: 14 },
  // The day in progress: zero driven and zero spent, and both are readings.
  { date: '2026-08-27', distanceKm: 0, energyKwh: 0 },
]

export const REAL_SPECS: FakeEntitySpec[] = [
  { key: 'sensor/battery_percent', entity_id: `sensor.${P}_battery`, state: '60', unit: '%' },
  { key: 'sensor/battery_percent_precise', entity_id: `sensor.${P}_precise_battery`, state: '60.3', unit: '%' },
  { key: 'sensor/remaining_range_km', entity_id: `sensor.${P}_range`, state: '217', unit: 'km' },
  { key: 'sensor/live_remaining_range_km', entity_id: `sensor.${M}_live_range`, state: '261', unit: 'km' },
  { key: 'sensor/wltp_max_range_km', entity_id: `sensor.${M}_cltc_remaining_range`, state: '434', unit: 'km' },
  { key: 'sensor/range_mode', entity_id: `sensor.${P}_range_mode`, state: 'CLTC' },
  { key: 'sensor/last_vehicle_update', entity_id: `sensor.${P}_last_vehicle_update`, state: '2026-08-27T10:16:33+00:00' },
  { key: 'sensor/last_successful_refresh', entity_id: `sensor.${P}_last_cloud_refresh`, state: '2026-08-27T13:35:24+00:00' },
  { key: 'image/vehicle_picture', entity_id: `image.${P}_vehicle_picture`, state: '2026-08-22T19:14:33.693886+00:00', attributes: { entity_picture: '/api/image_proxy/image.vehicle_picture' } },
  { key: 'device_tracker/location', entity_id: `device_tracker.${P}_location`, state: 'home', attributes: {
    latitude: 38.691584, longitude: -9.215939, gps_accuracy: 0, source_type: 'gps',
    location_age_seconds: 2017, location_is_stale: true, location_source: 'cloud_stale',
  } },

  { key: 'lock/vehicle_lock', entity_id: `lock.${P}_lock`, state: 'locked' },
  { key: 'sensor/lock_state_source', entity_id: `sensor.${P}_lock_state_source`, state: 'cloud_stale' },
  { key: 'sensor/lock_state_age_seconds', entity_id: `sensor.${P}_lock_state_age`, state: '11930', unit: 's' },

  { key: 'sensor/vehicle_state', entity_id: `sensor.${P}_vehicle_state`, state: 'unknown' },
  { key: 'sensor/gear', entity_id: `sensor.${P}_gear`, state: 'P' },
  { key: 'sensor/speed_kmh', entity_id: `sensor.${P}_speed`, state: '0.0', unit: 'km/h' },
  { key: 'binary_sensor/is_driving', entity_id: `binary_sensor.${P}_driving`, state: 'off' },
  { key: 'binary_sensor/parking_brake_active', entity_id: `binary_sensor.${P}_parking_brake_active`, state: 'on' },
  { key: 'binary_sensor/vehicle_ready', entity_id: `binary_sensor.${P}_vehicle_ready`, state: 'off' },

  { key: 'sensor/charge_limit_percent', entity_id: `sensor.${P}_charge_limit`, state: '80', unit: '%' },
  { key: 'number/charge_limit_setting', entity_id: `number.${P}_set_charge_limit`, state: '80', attributes: { min: 50, max: 100, step: 5 } },
  { key: 'binary_sensor/is_charging', entity_id: `binary_sensor.${P}_charging`, state: 'off' },
  { key: 'binary_sensor/is_plugged_in', entity_id: `binary_sensor.${P}_charge_cable_plugged_in`, state: 'off' },
  { key: 'binary_sensor/dc_cable_connected', entity_id: `binary_sensor.${P}_dc_charge_cable_plugged_in`, state: 'off' },
  { key: 'binary_sensor/fully_charged', entity_id: `binary_sensor.${P}_fully_charged`, state: 'off' },
  { key: 'sensor/charging_connection_state', entity_id: `sensor.${P}_charging_connection`, state: 'unplugged' },
  { key: 'sensor/charging_power_kw', entity_id: `sensor.${P}_charging_power`, state: '0.0', unit: 'kW' },
  { key: 'sensor/charging_voltage_v', entity_id: `sensor.${P}_charging_voltage`, state: '426.6', unit: 'V' },
  { key: 'sensor/charging_current_a', entity_id: `sensor.${P}_battery_current`, state: '0.1', unit: 'A' },
  { key: 'sensor/remaining_charge_minutes', entity_id: `sensor.${P}_remaining_charge_time`, state: 'unavailable', unit: 'min' },
  { key: 'sensor/charging_finish_time', entity_id: `sensor.${P}_estimated_charging_finish_time`, state: 'unavailable' },
  { key: 'binary_sensor/charging_planned_enabled', entity_id: `binary_sensor.${P}_scheduled_charging`, state: 'off' },
  { key: 'button/unlock_charger', entity_id: `button.${P}_unlock_charger`, state: 'unknown' },

  { key: 'binary_sensor/driver_door_open', entity_id: `binary_sensor.${P}_driver_door`, state: 'off' },
  { key: 'binary_sensor/passenger_door_open', entity_id: `binary_sensor.${P}_passenger_door`, state: 'off' },
  { key: 'binary_sensor/rear_left_door_open', entity_id: `binary_sensor.${P}_rear_left_door`, state: 'off' },
  { key: 'binary_sensor/rear_right_door_open', entity_id: `binary_sensor.${P}_rear_right_door`, state: 'off' },
  { key: 'binary_sensor/front_left_window_open', entity_id: `binary_sensor.${P}_front_left_window`, state: 'off' },
  { key: 'binary_sensor/front_right_window_open', entity_id: `binary_sensor.${P}_front_right_window`, state: 'off' },
  { key: 'binary_sensor/rear_left_window_open', entity_id: `binary_sensor.${P}_rear_left_window`, state: 'off' },
  { key: 'binary_sensor/rear_right_window_open', entity_id: `binary_sensor.${P}_rear_right_window`, state: 'off' },
  { key: 'sensor/front_left_window_position_percent', entity_id: `sensor.${P}_front_left_window_position`, state: '0', unit: '%' },
  { key: 'sensor/front_right_window_position_percent', entity_id: `sensor.${P}_front_right_window_position`, state: '0', unit: '%' },
  { key: 'sensor/rear_left_window_position_percent', entity_id: `sensor.${P}_rear_left_window_position`, state: '0', unit: '%' },
  { key: 'sensor/rear_right_window_position_percent', entity_id: `sensor.${P}_rear_right_window_position`, state: '0', unit: '%' },
  { key: 'binary_sensor/trunk_open', entity_id: `binary_sensor.${P}_trunk`, state: 'off' },
  { key: 'binary_sensor/skylight_open', entity_id: `binary_sensor.${P}_panoramic_roof_open`, state: 'off' },

  { key: 'switch/climate_control', entity_id: `switch.${P}_climate`, state: 'off' },
  { key: 'binary_sensor/climate_on', entity_id: `binary_sensor.${P}_climate_control`, state: 'off' },
  { key: 'sensor/interior_temp_c', entity_id: `sensor.${P}_interior_temperature`, state: '24.0', unit: '°C' },
  { key: 'sensor/climate_set_temp_left_c', entity_id: `sensor.${P}_target_temperature_left`, state: '24.0', unit: '°C' },
  { key: 'sensor/climate_mode', entity_id: `sensor.${P}_climate_mode`, state: 'off' },
  { key: 'binary_sensor/air_recirculation', entity_id: `binary_sensor.${P}_air_recirculation`, state: 'off' },

  { key: 'button/open_trunk', entity_id: `button.${P}_open_trunk`, state: '2026-08-20T15:10:21.352007+00:00' },
  { key: 'button/close_trunk', entity_id: `button.${P}_close_trunk`, state: '2026-08-20T15:10:36.879985+00:00' },
  { key: 'button/open_windows', entity_id: `button.${P}_open_windows`, state: '2026-08-20T15:09:33.389385+00:00' },
  { key: 'button/close_windows', entity_id: `button.${P}_close_windows`, state: '2026-08-20T15:10:52.583774+00:00' },
  { key: 'button/quick_cool', entity_id: `button.${P}_quick_cool`, state: 'unknown' },
  { key: 'button/quick_heat', entity_id: `button.${P}_quick_heat`, state: 'unknown' },
  { key: 'button/windshield_defrost', entity_id: `button.${P}_windshield_defrost`, state: 'unknown' },
  { key: 'button/find_vehicle', entity_id: `button.${P}_find_vehicle`, state: '2026-08-20T16:15:33.432408+00:00' },
  { key: 'button/refresh_data', entity_id: `button.${P}_refresh_data`, state: 'unknown' },

  { key: 'sensor/tire_pressure_front_left_bar', entity_id: `sensor.${P}_front_left_tire_pressure`, state: '2.11', unit: 'bar' },
  { key: 'sensor/tire_pressure_front_right_bar', entity_id: `sensor.${P}_front_right_tire_pressure`, state: '2.17', unit: 'bar' },
  { key: 'sensor/tire_pressure_rear_left_bar', entity_id: `sensor.${P}_rear_left_tire_pressure`, state: '2.17', unit: 'bar' },
  { key: 'sensor/tire_pressure_rear_right_bar', entity_id: `sensor.${P}_rear_right_tire_pressure`, state: '2.17', unit: 'bar' },

  { key: 'sensor/odometer_km', entity_id: `sensor.${P}_odometer`, state: '659', unit: 'km' },
  { key: 'sensor/total_mileage_km', entity_id: `sensor.${P}_total_mileage`, state: '661', unit: 'km' },
  { key: 'sensor/last_7_days_mileage_km', entity_id: `sensor.${P}_last_7_days_mileage`, state: '642', unit: 'km', attributes: SEVEN_DAY_ATTRIBUTES },
  { key: 'sensor/last_7_days_energy_kwh', entity_id: `sensor.${P}_last_7_days_energy`, state: '115.0', unit: 'kWh', attributes: SEVEN_DAY_ATTRIBUTES },
  {
    key: 'sensor/average_consumption_6w_kwh_100km',
    entity_id: `sensor.${P}_6_week_average_consumption_kwh_100_km`,
    state: '20.6',
    unit: 'kWh/100 km',
    // The week-by-week series, oldest to most recent. The first four at zero
    // are real: the car was new and hadn't been driven. Note that
    // `hundredKmEC` comes as a number and `hundredMiKwhEC` comes as text in
    // the SAME object — the inconsistency is the API's, and that's exactly
    // what the fixture has to preserve.
    attributes: {
      weekly_consumption: [
        { weekStart: '2026-07-20', weekEnd: '2026-07-26', hundredKmEC: 0.0, hundredMiKwhEC: '0.0', xWeekStart: 1784505600000, xWeekEnd: 1785110399000 },
        { weekStart: '2026-07-27', weekEnd: '2026-08-02', hundredKmEC: 0.0, hundredMiKwhEC: '0.0', xWeekStart: 1785110400000, xWeekEnd: 1785715199000 },
        { weekStart: '2026-08-03', weekEnd: '2026-08-09', hundredKmEC: 0.0, hundredMiKwhEC: '0.0', xWeekStart: 1785715200000, xWeekEnd: 1786319999000 },
        { weekStart: '2026-08-10', weekEnd: '2026-08-16', hundredKmEC: 0.0, hundredMiKwhEC: '0.0', xWeekStart: 1786320000000, xWeekEnd: 1786924799000 },
        { weekStart: '2026-08-17', weekEnd: '2026-08-23', hundredKmEC: 20.7, hundredMiKwhEC: '6.2', xWeekStart: 1786924800000, xWeekEnd: 1787529599000 },
        { weekStart: '2026-08-24', weekEnd: '2026-08-30', hundredKmEC: 14.2, hundredMiKwhEC: '4.3', xWeekStart: 1787529600000, xWeekEnd: 1788134399000 },
      ],
    },
  },
  { key: 'sensor/total_energy_kwh', entity_id: `sensor.${P}_total_energy_consumption`, state: '131.0', unit: 'kWh' },

  /*
   * The three slices of last week's energy. The `state` is the percentage
   * and the kWh figures come in the attributes — repeated, the SAME three in
   * each of the three entities. The repetition is not a fixture bug: it's
   * what the integration produces, and it's what justifies the card being
   * able to read the kWh from any one of them.
   */
  ...(['driving', 'climate', 'other'] as const).map((slice, i) => ({
    key: `sensor/last_week_${slice}_energy_percent`,
    entity_id: `sensor.${P}_last_week_${slice}_energy`,
    state: ['96.3', '0.9', '2.8'][i]!,
    unit: '%',
    attributes: { driving_energy_kwh: 10.4, climate_energy_kwh: 0.1, other_energy_kwh: 0.3 },
  })),

  { key: 'number/driver_seat_heating', entity_id: `number.${P}_driver_seat_heating`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'number/driver_seat_ventilation', entity_id: `number.${P}_driver_seat_ventilation`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'number/passenger_seat_heating', entity_id: `number.${P}_passenger_seat_heating`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'number/passenger_seat_ventilation', entity_id: `number.${P}_passenger_seat_ventilation`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'switch/steering_wheel_heat', entity_id: `switch.${P}_steering_wheel_heating`, state: 'off' },
  { key: 'sensor/steering_wheel_heating_remaining_minutes', entity_id: `sensor.${P}_steering_wheel_heating_remaining_time`, state: '15', unit: 'min' },
  { key: 'switch/rearview_mirror_heat', entity_id: `switch.${P}_mirror_heating`, state: 'off' },
  { key: 'switch/battery_preheat', entity_id: `switch.${P}_battery_preheat`, state: 'off' },

  { key: 'switch/charging_schedule', entity_id: `switch.${P}_charging_schedule`, state: 'off' },
  { key: 'sensor/charging_planned_start', entity_id: `sensor.${P}_charging_schedule_start`, state: '22:00' },
  { key: 'sensor/charging_planned_end', entity_id: `sensor.${P}_charging_schedule_end`, state: '08:00' },
  { key: 'sensor/charging_planned_circulation', entity_id: `sensor.${P}_charging_schedule_recurrence`, state: '1' },
  { key: 'binary_sensor/charging_planned_weekly', entity_id: `binary_sensor.${P}_weekly_charging_schedule`, state: 'on' },
  { key: 'binary_sensor/charging_schedule_cancelled_once', entity_id: `binary_sensor.${P}_charging_schedule_cancelled_once`, state: 'on' },
]

/**
 * `overrides` is indexed by `domain/translation_key`, so tests can change a
 * state without repeating the whole fixture.
 */
export function realHass(overrides: Record<string, string> = {}) {
  const specs = REAL_SPECS.map(s => (overrides[s.key] !== undefined ? { ...s, state: overrides[s.key] } : s))
  return fakeHass(specs, { dev1: { name: 'Leapmotor B10 2025 Demo (Shared)', name_by_user: 'Leapmotor B10 000000 (Demo)' } })
}
