/**
 * Maps each logical name the card uses to the entity Leapmotor Mate publishes
 * over MQTT discovery. Mate names its entities in English whatever the
 * language of Home Assistant, so the entity_id is always
 * `<domain>.leapmotor_mate_<last six of the VIN>_<slug>` and `slug` below is
 * the slug of the entity's English name. `slug: null` marks a logical name
 * Mate does not publish: the card keeps working without it, it just never
 * resolves.
 */
export interface EntityDef { domain: string; slug: string | null }

const e = (domain: string, slug: string | null): EntityDef => ({ domain, slug })

export const ENTITY_KEYS = {
  // identity and range
  battery: e('sensor', 'battery'),
  batteryPrecise: e('sensor', null),
  range: e('sensor', 'range'),
  rangeLive: e('sensor', null),
  rangeMax: e('sensor', null),
  rangeMode: e('sensor', null),
  lastVehicleUpdate: e('sensor', 'last_seen'),
  lastCloudRefresh: e('sensor', 'data_timestamp'),
  dataAge: e('sensor', 'data_age'),
  vehiclePicture: e('image', null),
  location: e('device_tracker', 'location'),

  // locks
  lock: e('lock', 'door_lock'),
  lockStateSource: e('sensor', null),
  lockStateAge: e('sensor', null),

  // activity
  vehicleState: e('sensor', 'state'),
  gear: e('sensor', 'gear'),
  speed: e('sensor', 'speed'),
  isDriving: e('binary_sensor', null),
  parkingBrake: e('binary_sensor', null),
  vehicleReady: e('binary_sensor', 'ready'),

  // charging
  chargeLimit: e('number', 'charge_limit'),
  chargeLimitSet: e('number', 'charge_limit'),
  isCharging: e('binary_sensor', 'charging'),
  isPluggedIn: e('binary_sensor', 'plug_connected'),
  dcCableConnected: e('binary_sensor', null),
  fullyCharged: e('binary_sensor', null),
  chargingConnection: e('sensor', null),
  chargingPower: e('sensor', 'charge_power'),
  chargingVoltage: e('sensor', 'charge_voltage'),
  chargingCurrent: e('sensor', 'charge_current'),
  remainingChargeMinutes: e('sensor', 'charge_time_remaining'),
  chargingFinishTime: e('sensor', null),
  schedulePlanned: e('binary_sensor', null),
  unlockCharger: e('button', 'unlock_charge_cable'),

  // openings (Mate names are physical positions: front left, not "driver")
  doorDriver: e('binary_sensor', 'door_front_left'),
  doorPassenger: e('binary_sensor', 'door_front_right'),
  doorRearLeft: e('binary_sensor', 'door_rear_left'),
  doorRearRight: e('binary_sensor', 'door_rear_right'),
  windowFL: e('binary_sensor', 'window_front_left'),
  windowFR: e('binary_sensor', 'window_front_right'),
  windowRL: e('binary_sensor', 'window_rear_left'),
  windowRR: e('binary_sensor', 'window_rear_right'),
  windowPosFL: e('sensor', null),
  windowPosFR: e('sensor', null),
  windowPosRL: e('sensor', null),
  windowPosRR: e('sensor', null),
  trunk: e('binary_sensor', 'trunk'),
  roof: e('binary_sensor', 'sunshade'),
  sunshadePosition: e('sensor', 'sunshade_position'),
  openSunshade: e('button', 'open_sunshade'),
  closeSunshade: e('button', 'close_sunshade'),

  // climate
  climateSwitch: e('switch', null),
  climateOn: e('binary_sensor', 'climate'),
  interiorTemp: e('sensor', 'inside_temp'),
  outsideTemp: e('sensor', 'outside_temp'),
  batteryTemp: e('sensor', 'battery_temp'),
  targetTemp: e('sensor', 'ac_target'),
  climateMode: e('sensor', 'climate_mode'),
  climatePower: e('sensor', 'climate_power'),
  fanLevel: e('number', 'fan_level'),
  recirculation: e('switch', 'air_recirculation'),

  // buttons
  openTrunk: e('button', 'open_trunk'),
  closeTrunk: e('button', 'close_trunk'),
  openWindows: e('button', 'open_windows'),
  closeWindows: e('button', 'close_windows'),
  climateAuto: e('button', 'a_c_auto'),
  climateOff: e('button', 'a_c_off'),
  quickCool: e('button', 'quick_cool'),
  quickHeat: e('button', 'quick_heat'),
  quickVentilation: e('button', 'quick_ventilation'),
  windshieldDefrost: e('button', 'defrost'),
  findVehicle: e('button', 'find_car'),
  refreshData: e('button', null),

  // tires
  tireFL: e('sensor', 'tyre_fl'),
  tireFR: e('sensor', 'tyre_fr'),
  tireRL: e('sensor', 'tyre_rl'),
  tireRR: e('sensor', 'tyre_rr'),

  // trip: Mate keeps trips in its own database, not in MQTT, so only the odometer is here
  odometer: e('sensor', 'odometer'),
  totalMileage: e('sensor', null),
  last7DaysKm: e('sensor', null),
  last7DaysEnergy: e('sensor', null),
  avgConsumption6w: e('sensor', null),
  totalEnergy: e('sensor', null),
  lastWeekDrivingPercent: e('sensor', null),
  lastWeekClimatePercent: e('sensor', null),
  lastWeekOtherPercent: e('sensor', null),

  // comfort: Mate reports the state in a sensor and commands it with on/off buttons
  driverSeatHeat: e('sensor', 'seat_heating_driver'),
  driverSeatVent: e('sensor', 'seat_ventilation_driver'),
  passengerSeatHeat: e('sensor', 'seat_heating_passenger'),
  passengerSeatVent: e('sensor', 'seat_ventilation_passenger'),
  steeringWheelHeat: e('sensor', 'steering_wheel_heat'),
  steeringWheelHeatRemaining: e('sensor', null),
  mirrorHeat: e('sensor', 'mirror_heating_left'),
  batteryPreheat: e('button', 'preheat_battery'),

  // comfort commands
  driverSeatHeatOn: e('button', 'driver_seat_heat_on'),
  driverSeatHeatOff: e('button', 'driver_seat_heat_off'),
  passengerSeatHeatOn: e('button', 'passenger_seat_heat_on'),
  passengerSeatHeatOff: e('button', 'passenger_seat_heat_off'),
  driverSeatVentOn: e('button', 'driver_seat_vent_on'),
  driverSeatVentOff: e('button', 'driver_seat_vent_off'),
  passengerSeatVentOn: e('button', 'passenger_seat_vent_on'),
  passengerSeatVentOff: e('button', 'passenger_seat_vent_off'),
  steeringWheelHeatOn: e('button', 'steering_heat_on'),
  steeringWheelHeatOff: e('button', 'steering_heat_off'),
  mirrorHeatOn: e('button', 'mirror_heat_on'),
  mirrorHeatOff: e('button', 'mirror_heat_off'),

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
