import type { LogicalKey } from './keys'
import type { TapActionConfig } from './tap-action'

export type EntityMap = Partial<Record<LogicalKey, string>>

/** The groups the grid can show. */
export type GroupId = 'charging' | 'status' | 'climate' | 'tires' | 'trip' | 'location'

/**
 * The sections a sub-view can instantiate. Names components, not groups: a
 * group can instantiate more than one.
 */
export type PanelId =
  | 'charging' | 'schedule' | 'climate' | 'comfort'
  | 'openings' | 'tires' | 'trip' | 'location'

/**
 * A grid entry. The short form is just the group's name; the long form
 * exists to override the icon, the title, or which of the group's summaries
 * is shown.
 */
export type GridEntry = GroupId | {
  group: GroupId
  icon?: string
  title?: string
  summary?: string
}

export type ActionId =
  | 'unlock' | 'lock' | 'trunk' | 'windows' | 'sunshade'
  | 'quickCool' | 'quickHeat' | 'quickVentilation' | 'defrost'
  | 'findVehicle' | 'unlockCharger' | 'refresh'
  | 'climate' | 'climateOff' | 'steeringWheelHeat' | 'mirrorHeat' | 'batteryPreheat'
  | 'driverSeatHeat' | 'driverSeatVent' | 'passengerSeatHeat' | 'passengerSeatVent'
  | 'setChargeLimit'

/** One section of the action row: a name of the owner's choosing and its buttons. */
export interface ActionSection { title?: string; actions: ActionId[] }

export interface LeapmotorCardConfig {
  type: string
  device?: string
  name?: string
  language?: string
  /**
   * Address of Leapmotor Mate's web interface (`http://192.168.1.10:4000`). With
   * it, `image: auto` shows the car's own picture from `<mate_url>/api/car-picture`.
   */
  mate_url?: string
  image?: 'auto' | 'entity' | 'none' | string
  actions?: ActionId[]
  /**
   * The action row as sections of the owner's own: each has a title and the
   * actions it holds, in order. Absent or empty, the row groups `actions` by
   * function on its own.
   */
  action_sections?: ActionSection[]
  confirm_actions?: ActionId[]
  /** Actions that ask twice before opening the car. Default: unlock, trunk, windows, sunshade. */
  double_confirm_actions?: ActionId[]
  /** Functions turned off altogether: no button anywhere, and no call. */
  disabled_actions?: ActionId[]
  /**
   * What a tap on the car's picture does. Absent, it opens Mate's web
   * interface when `mate_url` is set, and nothing otherwise.
   */
  image_tap_action?: TapActionConfig
  entities?: EntityMap
  map_zoom?: number
  tire_range?: [number, number]
  grid?: GridEntry[]
  /**
   * What a tap on the range does. Absent, it is the more-info of the sensor
   * the number came from, whose dialog already carries the history graph —
   * `resolveTapAction` is what decides it, and `none` puts the number back
   * to inert text.
   */
  range_tap_action?: TapActionConfig
}

export type ChargingPhase = 'unplugged' | 'plugged' | 'charging' | 'complete' | 'scheduled'
export type Activity = 'parked' | 'driving' | 'ready' | 'unknown'

export interface VehicleState {
  online: boolean
  lastUpdate?: Date
  battery?: number
  /**
   * `entityId` is the sensor the number ACTUALLY came from, out of the three
   * `buildVehicleState` picks between. It travels with the value so that
   * whoever wants to open its dialog opens the graph of the number on
   * screen, and not of a sibling sensor reading something else.
   */
  range?: { km: number; unit: string; mode?: string; entityId?: string }
  chargeLimit?: number
  charging: {
    phase: ChargingPhase
    speed?: 'slow' | 'fast'
    powerKw?: number
    voltageV?: number
    currentA?: number
    remainingMinutes?: number
    finishTime?: Date
  }
  lock: { locked?: boolean; stale: boolean; ageSeconds?: number; source?: string }
  activity: Activity
  location?: {
    latitude: number
    longitude: number
    zone?: string
    ageSeconds?: number
    stale: boolean
  }
  openings: {
    doors: Record<'driver' | 'passenger' | 'rearLeft' | 'rearRight', boolean | undefined>
    windows: Record<'fl' | 'fr' | 'rl' | 'rr', { open?: boolean; position?: number }>
    trunk?: boolean
    roof?: boolean
    /** How far the sunshade is open, in percent, when the car says. */
    sunshadePct?: number
    openCount: number
  }
  climate: { on?: boolean; interiorC?: number; outsideC?: number; targetC?: number; mode?: string; recirculating?: boolean; fan?: number }
  tires: Record<'fl' | 'fr' | 'rl' | 'rr', number | undefined>
  trip: { odometerKm?: number }
  comfort: {
    driverSeatHeat?: number; driverSeatVent?: number
    passengerSeatHeat?: number; passengerSeatVent?: number
    steeringWheelHeat?: boolean; steeringWheelHeatRemaining?: number
    mirrorHeat?: boolean; batteryPreheat?: boolean
  }
  schedule: { enabled?: boolean; start?: string; end?: string; recurrence?: string; weekly?: boolean; cancelledOnce?: boolean }
}

/**
 * The buttons of the action row when nothing is configured: what one reaches
 * for from a dashboard, function by function — getting in, airing the car,
 * finding it, warming or cooling it before leaving, and the charge cable. The
 * row groups them (see `ACTION_GROUP`) and leaves out the ones the car does
 * not have.
 */
export const DEFAULT_ACTIONS: ActionId[] = [
  'unlock', 'lock', 'trunk',
  'windows', 'sunshade',
  'findVehicle',
  'climate', 'quickCool', 'quickHeat', 'defrost',
  'unlockCharger', 'batteryPreheat',
]
/**
 * The actions that open the car up, and so ask twice before doing it. The
 * second question only comes when the tap would OPEN: closing the trunk or the
 * windows, or locking, is never what someone regrets.
 */
export const DEFAULT_DOUBLE_CONFIRM_ACTIONS: ActionId[] = ['unlock', 'trunk', 'windows', 'sunshade']
/** Actions that ask once. None by default: the ones worth asking about ask twice. */
export const DEFAULT_CONFIRM_ACTIONS: ActionId[] = []

export const DEFAULT_MAP_ZOOM = 16
export const MAP_ZOOM_MIN = 1
export const MAP_ZOOM_MAX = 20

/**
 * `map_zoom` comes from hand-written YAML, with no schema validation — a
 * user can put `50`, `0` or a piece of text by mistake. Without this, the
 * `default_zoom` that reaches HA's `map` card would fall outside what
 * Leaflet accepts for these pieces (1 to 20) and the map would show up
 * blank. The clamp is here, at read time, and not in the editor: the editor
 * does not see hand-written configuration.
 */
export function clampMapZoom(zoom: number | undefined): number {
  if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return DEFAULT_MAP_ZOOM
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, Math.round(zoom)))
}

/**
 * The pressure range considered normal, in bar. The default is the values
 * `tires.ts` used to have fixed in code, so as not to change anyone's
 * behavior without them asking for it — but they are narrow: a car at
 * 2.8 bar falls outside it. What the right range is depends on the tire's
 * size and the load, it cannot be checked from the code, and that is why it
 * became configurable.
 */
export const DEFAULT_TIRE_RANGE: readonly [number, number] = [2.0, 2.6]

export function clampTireRange(value: unknown): [number, number] {
  const fallback = (): [number, number] => [DEFAULT_TIRE_RANGE[0], DEFAULT_TIRE_RANGE[1]]
  if (!Array.isArray(value) || value.length !== 2) return fallback()
  const [min, max] = value as unknown[]
  if (typeof min !== 'number' || typeof max !== 'number') return fallback()
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return fallback()
  return [min, max]
}

/** What identifies the map request in progress: for which entity and at what zoom. */
export interface MapRequest {
  entityId: string
  zoom: number
}

/**
 * Says whether the stored map request no longer serves the next request.
 * Pure, so it can be tested without a DOM — the function that decides
 * whether the card's `ensureMap` should rebuild the map is this one, not
 * `render()`, which runs on every state update and would rebuild the map
 * with no need to.
 */
export function mapRequestChanged(previous: MapRequest | undefined, next: MapRequest): boolean {
  return !previous || previous.entityId !== next.entityId || previous.zoom !== next.zoom
}
