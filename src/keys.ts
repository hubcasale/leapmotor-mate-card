/**
 * Maps each logical name the card uses to the entity Leapmotor Mate publishes
 * over MQTT discovery. Mate names its entities in English whatever the
 * language of Home Assistant, so the entity_id is always
 * `<domain>.leapmotor_mate_<last six of the VIN>_<slug>` and `slug` below is
 * the slug of the entity's English name. `slug: null` marks a logical name
 * Mate does not publish: the card keeps working without it, it just never
 * resolves.
 */
export interface EntityDef {
  domain: string
  slug: string | null
  /**
   * Mate's own key for the entity, the tail of its MQTT `unique_id`
   * (`<prefix>_mate_<VIN>_<key>`). Unlike the entity_id, it never changes:
   * Home Assistant keeps the id an entity was first created with, so a car set
   * up on an older Mate keeps `door_driver` where today's name would give
   * `door_front_left`. When the entity registry can be read, this is how
   * entities are found; the slug is the fallback.
   */
  key?: string
}

const e = (domain: string, slug: string | null, key?: string): EntityDef => (key ? { domain, slug, key } : { domain, slug })

export const ENTITY_KEYS = {
  // identity and range
  battery: e('sensor', 'battery', 'soc'),
  batteryPrecise: e('sensor', null),
  range: e('sensor', 'range', 'range'),
  rangeLive: e('sensor', null),
  rangeMax: e('sensor', null),
  rangeMode: e('sensor', null),
  lastVehicleUpdate: e('sensor', 'last_seen', 'last_seen'),
  lastCloudRefresh: e('sensor', 'data_timestamp', 'frame_ts'),
  dataAge: e('sensor', 'data_age', 'data_age'),
  vehiclePicture: e('image', null),
  location: e('device_tracker', 'location', 'location'),

  // locks
  lock: e('lock', 'door_lock', 'door_lock'),
  lockStateSource: e('sensor', null),
  lockStateAge: e('sensor', null),

  // activity
  vehicleState: e('sensor', 'state', 'state'),
  gear: e('sensor', 'gear', 'gear'),
  speed: e('sensor', 'speed', 'speed'),
  isDriving: e('binary_sensor', null),
  parkingBrake: e('binary_sensor', null),
  vehicleReady: e('binary_sensor', 'ready', 'ready'),

  // charging
  chargeLimit: e('number', 'charge_limit', 'charge_limit'),
  chargeLimitSet: e('number', 'charge_limit', 'charge_limit'),
  isCharging: e('binary_sensor', 'charging', 'charging'),
  isPluggedIn: e('binary_sensor', 'plug_connected', 'plug_connected'),
  dcCableConnected: e('binary_sensor', null),
  fullyCharged: e('binary_sensor', null),
  chargingConnection: e('sensor', null),
  chargingPower: e('sensor', 'charge_power', 'charge_power'),
  chargingVoltage: e('sensor', 'charge_voltage', 'charge_voltage'),
  chargingCurrent: e('sensor', 'charge_current', 'charge_current'),
  remainingChargeMinutes: e('sensor', 'charge_time_remaining', 'charge_time_remaining'),
  chargingFinishTime: e('sensor', null),
  schedulePlanned: e('binary_sensor', null),
  unlockCharger: e('button', 'unlock_charge_cable', 'unlock_charger'),

  // openings (Mate names are physical positions: front left, not "driver")
  doorDriver: e('binary_sensor', 'door_front_left', 'door_driver'),
  doorPassenger: e('binary_sensor', 'door_front_right', 'door_passenger'),
  doorRearLeft: e('binary_sensor', 'door_rear_left', 'door_rear_left'),
  doorRearRight: e('binary_sensor', 'door_rear_right', 'door_rear_right'),
  windowFL: e('binary_sensor', 'window_front_left', 'window_fl'),
  windowFR: e('binary_sensor', 'window_front_right', 'window_fr'),
  windowRL: e('binary_sensor', 'window_rear_left', 'window_rl'),
  windowRR: e('binary_sensor', 'window_rear_right', 'window_rr'),
  windowPosFL: e('sensor', null),
  windowPosFR: e('sensor', null),
  windowPosRL: e('sensor', null),
  windowPosRR: e('sensor', null),
  trunk: e('binary_sensor', 'trunk', 'trunk_open'),
  roof: e('binary_sensor', 'sunshade', 'sunshade_open'),
  sunshadePosition: e('sensor', 'sunshade_position', 'sunshade_pct'),
  openSunshade: e('button', 'open_sunshade', 'open_sunshade'),
  closeSunshade: e('button', 'close_sunshade', 'close_sunshade'),

  // climate
  climateSwitch: e('switch', null),
  climateOn: e('binary_sensor', 'climate', 'climate_on'),
  interiorTemp: e('sensor', 'inside_temp', 'inside_temp'),
  outsideTemp: e('sensor', 'outside_temp', 'outside_temp'),
  batteryTemp: e('sensor', 'battery_temp', 'battery_temp'),
  targetTemp: e('sensor', 'ac_target', 'ac_target_temp'),
  climateMode: e('sensor', 'climate_mode', 'climate_mode'),
  climatePower: e('sensor', 'climate_power', 'climate_power'),
  fanLevel: e('number', 'fan_level', 'fan_level'),
  recirculation: e('switch', 'air_recirculation', 'recirculation'),

  // buttons
  openTrunk: e('button', 'open_trunk', 'open_trunk'),
  closeTrunk: e('button', 'close_trunk', 'close_trunk'),
  openWindows: e('button', 'open_windows', 'open_windows'),
  closeWindows: e('button', 'close_windows', 'close_windows'),
  climateAuto: e('button', 'a_c_auto', 'climate_auto'),
  climateOff: e('button', 'a_c_off', 'climate_off'),
  quickCool: e('button', 'quick_cool', 'climate_cool'),
  quickHeat: e('button', 'quick_heat', 'climate_heat'),
  quickVentilation: e('button', 'quick_ventilation', 'climate_vent'),
  windshieldDefrost: e('button', 'defrost', 'climate_defrost'),
  findVehicle: e('button', 'find_car', 'find_car'),
  refreshData: e('button', null),

  // tires
  tireFL: e('sensor', 'tyre_fl', 'tire_fl'),
  tireFR: e('sensor', 'tyre_fr', 'tire_fr'),
  tireRL: e('sensor', 'tyre_rl', 'tire_rl'),
  tireRR: e('sensor', 'tyre_rr', 'tire_rr'),

  // trip: Mate keeps trips in its own database, not in MQTT, so only the odometer is here
  odometer: e('sensor', 'odometer', 'odometer'),
  totalMileage: e('sensor', null),
  last7DaysKm: e('sensor', null),
  last7DaysEnergy: e('sensor', null),
  avgConsumption6w: e('sensor', null),
  totalEnergy: e('sensor', null),
  lastWeekDrivingPercent: e('sensor', null),
  lastWeekClimatePercent: e('sensor', null),
  lastWeekOtherPercent: e('sensor', null),

  // comfort: Mate reports the state in a sensor and commands it with on/off buttons
  driverSeatHeat: e('sensor', 'seat_heating_driver', 'seat_heat_driver'),
  driverSeatVent: e('sensor', 'seat_ventilation_driver', 'seat_vent_driver'),
  passengerSeatHeat: e('sensor', 'seat_heating_passenger', 'seat_heat_passenger'),
  passengerSeatVent: e('sensor', 'seat_ventilation_passenger', 'seat_vent_passenger'),
  steeringWheelHeat: e('sensor', 'steering_wheel_heat', 'steering_heat'),
  steeringWheelHeatRemaining: e('sensor', null),
  mirrorHeat: e('sensor', 'mirror_heating_left', 'mirror_heat_left'),
  batteryPreheat: e('button', 'preheat_battery', 'battery_preheat'),

  // comfort commands
  driverSeatHeatOn: e('button', 'driver_seat_heat_on', 'seat_heat_driver_on'),
  driverSeatHeatOff: e('button', 'driver_seat_heat_off', 'seat_heat_driver_off'),
  passengerSeatHeatOn: e('button', 'passenger_seat_heat_on', 'seat_heat_passenger_on'),
  passengerSeatHeatOff: e('button', 'passenger_seat_heat_off', 'seat_heat_passenger_off'),
  driverSeatVentOn: e('button', 'driver_seat_vent_on', 'seat_vent_driver_on'),
  driverSeatVentOff: e('button', 'driver_seat_vent_off', 'seat_vent_driver_off'),
  passengerSeatVentOn: e('button', 'passenger_seat_vent_on', 'seat_vent_passenger_on'),
  passengerSeatVentOff: e('button', 'passenger_seat_vent_off', 'seat_vent_passenger_off'),
  steeringWheelHeatOn: e('button', 'steering_heat_on', 'steering_heat_on'),
  steeringWheelHeatOff: e('button', 'steering_heat_off', 'steering_heat_off'),
  mirrorHeatOn: e('button', 'mirror_heat_on', 'mirror_heat_on'),
  mirrorHeatOff: e('button', 'mirror_heat_off', 'mirror_heat_off'),

  // scheduling: Mate exposes the plan as one JSON text entity meant for automations
  scheduleSwitch: e('switch', null),
  scheduleStart: e('sensor', null),
  scheduleEnd: e('sensor', null),
  scheduleRecurrence: e('sensor', null),
  scheduleWeekly: e('binary_sensor', null),
  scheduleCancelledOnce: e('binary_sensor', null),
} as const satisfies Record<string, EntityDef>

export type LogicalKey = keyof typeof ENTITY_KEYS

/**
 * The four seat levels. They live here, and not in a section, because the
 * card also needs them: it is the card that stores the requests pending
 * confirmation. The names are deliberately the same as the fields of
 * `VehicleState['comfort']`, which lets each one's reported level be read
 * with no conversion table.
 */
export const SEAT_LEVEL_KEYS = [
  'driverSeatHeat', 'driverSeatVent', 'passengerSeatHeat', 'passengerSeatVent',
] as const

export type SeatLevelKey = typeof SEAT_LEVEL_KEYS[number]

export function isSeatLevelKey(key: LogicalKey): key is SeatLevelKey {
  return (SEAT_LEVEL_KEYS as readonly LogicalKey[]).includes(key)
}

/** Prefix of every entity Mate publishes: `<domain>.leapmotor_mate_<vin6>_<slug>`. */
export const MATE_PREFIX = 'leapmotor_mate_'
