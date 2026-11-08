import { areOpeningsUnknown, formatAgo, formatNumber, formatTimeOfDay } from './format'
import type { LogicalKey } from './keys'
import { DASH, formatDuration, type TranslateFn } from './localize'
import type { EntityMap, GridEntry, GroupId, LeapmotorCardConfig, PanelId, VehicleState } from './types'

/**
 * What defines a grid group. Lives in code, not in configuration: a group
 * is a set of the sections that already exist, and the user chooses which
 * ones and in what order — they do not invent new groups. See spec §3.1.
 */
export interface GroupDef {
  id: GroupId
  icon: string
  titleKey: string
  /** The possible summaries. **The first one is the default.** */
  summaries: readonly string[]
  /** The sections the sub-view instantiates, in the order they appear. */
  panels: readonly PanelId[]
  /**
   * The logical keys the group consumes. They serve two questions: does the
   * group have anything to show (at least one resolved), and which missing
   * keys are worth reporting (`missingForGroups`).
   */
  keys: readonly LogicalKey[]
}

export const GROUP_CATALOGUE: Record<GroupId, GroupDef> = {
  charging: {
    id: 'charging',
    icon: 'mdi:ev-station',
    titleKey: 'group.charging',
    // `charge` first, so it is the default `resolveGrid` picks: the tile is
    // titled "Battery", and the percentage on its own said nothing about
    // the cable — it read as "Charging 28.8 %" with the car parked in the
    // street and nothing plugged in. `battery` stays as the
    // percentage-only option for whoever configured it.
    summaries: ['charge', 'battery', 'limit', 'phase', 'eta'],
    // Mate publishes no charging schedule as entities (only a JSON text meant
    // for automations), so there is no schedule panel here.
    panels: ['charging'],
    keys: ['chargeLimit', 'isCharging', 'isPluggedIn'],
  },
  status: {
    id: 'status',
    icon: 'mdi:car-door',
    titleKey: 'group.status',
    summaries: ['lock', 'openings', 'trunk'],
    panels: ['openings'],
    keys: [
      'lock', 'trunk', 'roof',
      'doorDriver', 'doorPassenger', 'doorRearLeft', 'doorRearRight',
      'windowFL', 'windowFR', 'windowRL', 'windowRR',
    ],
  },
  climate: {
    id: 'climate',
    icon: 'mdi:thermometer',
    titleKey: 'group.climate',
    summaries: ['interior', 'target', 'state'],
    panels: ['climate', 'comfort'],
    keys: ['interiorTemp', 'targetTemp', 'climateOn', 'driverSeatHeat', 'steeringWheelHeat'],
  },
  tires: {
    id: 'tires',
    icon: 'mdi:car-tire-alert',
    titleKey: 'group.tires',
    summaries: ['range', 'min', 'worst'],
    panels: ['tires'],
    keys: ['tireFL', 'tireFR', 'tireRL', 'tireRR'],
  },
  trip: {
    id: 'trip',
    icon: 'mdi:road-variant',
    titleKey: 'group.trip',
    summaries: ['odometer'],
    panels: ['trip'],
    // Mate keeps trips in its own database, not in MQTT: only the odometer is here.
    keys: ['odometer'],
  },
  location: {
    id: 'location',
    icon: 'mdi:map-marker',
    titleKey: 'group.location',
    summaries: ['activity', 'zone', 'age'],
    panels: ['location'],
    keys: ['location'],
  },
}

/**
 * Summary names the card once published, mapped onto the name the catalog
 * carries today. A value here behaves exactly as the name it points at:
 * `resolveGrid` swaps it before anything else looks at it, so there is one
 * spelling downstream and no chance of the two drifting apart.
 *
 * **Silently, and with no deprecation warning.** These names were ours, not
 * a mistake by whoever wrote them in their YAML, and a card that starts
 * complaining about a configuration it told people to write is a card that
 * punishes them for having followed the documentation. The old name simply
 * keeps working; only the new one is documented.
 */
const SUMMARY_ALIASES: Readonly<Record<string, string | undefined>> = {}

/** The default grid order. */
export const GROUP_ORDER: readonly GroupId[] = [
  'charging', 'status', 'climate', 'tires', 'trip', 'location',
]

export interface ResolvedGroup {
  id: GroupId
  /** Already with the user's override applied, if any. */
  icon: string
  titleKey: string
  /** A literal title written by the user. Does not go through `t()`. */
  titleOverride?: string
  /** The summary to show, already validated against the group's. */
  summary: string
  def: GroupDef
}

export interface GridResolution {
  groups: ResolvedGroup[]
  /** The names written in `grid:` that are not groups. */
  unknown: string[]
  /** True when `grid:` was written, false when it is the default. */
  explicit: boolean
}

function longForm(entry: GridEntry): { group: string; icon?: string; title?: string; summary?: string } {
  return typeof entry === 'string' ? { group: entry } : entry
}

export function resolveGrid(config: LeapmotorCardConfig, map: EntityMap): GridResolution {
  const explicit = Array.isArray(config.grid)
  const entries: GridEntry[] = explicit ? config.grid! : [...GROUP_ORDER]
  const groups: ResolvedGroup[] = []
  const unknown: string[] = []
  const seen = new Set<GroupId>()

  for (const raw of entries) {
    const entry = longForm(raw)
    const def = GROUP_CATALOGUE[entry.group as GroupId] as GroupDef | undefined
    if (!def) { unknown.push(String(entry.group)); continue }
    if (seen.has(def.id)) continue
    seen.add(def.id)

    // A grid group by DEFAULT with no resolvable entity does not appear:
    // zero configuration shows what this car offers, and not a list of
    // empty sub-views. Written by hand in `grid:`, it stays — and the
    // missing-entities warning takes care of saying it is empty, because
    // making it disappear would hide a mistake by whoever configured it.
    // See spec §5.6.
    if (!explicit && !def.keys.some(key => map[key] !== undefined)) continue

    // The alias is applied before the validation, and not after it: a
    // retired name has to reach `def.summaries.includes` under its current
    // spelling, or it would fail the check and fall back to the default —
    // which is precisely the silent change of behavior the alias exists to
    // prevent.
    const wanted = entry.summary === undefined
      ? undefined
      : SUMMARY_ALIASES[entry.summary] ?? entry.summary
    const summary = wanted !== undefined && def.summaries.includes(wanted)
      ? wanted
      : def.summaries[0]!

    groups.push({
      id: def.id,
      icon: entry.icon ?? def.icon,
      titleKey: def.titleKey,
      titleOverride: entry.title,
      summary,
      def,
    })
  }

  return { groups, unknown, explicit }
}

/**
 * Of the missing keys the resolver reported, the ones some grid group
 * actually asks for. Without this filter, the warning named entities from
 * sections the user did not put in the grid.
 */
export function missingForGroups(groups: ResolvedGroup[], missing: LogicalKey[]): LogicalKey[] {
  const wanted = new Set<LogicalKey>(groups.flatMap(group => [...group.def.keys]))
  return missing.filter(key => wanted.has(key))
}

/**
 * The card's height in Home Assistant masonry units (~50px each), from the
 * number of groups in the grid. The base of 6 is the hero with photo plus
 * the actions row; each grid row carries two tiles and measures ~70px, that
 * is 1.5 units — counting it as 1 underestimated the card, and HA balances
 * the columns only once, using this number.
 */
export function estimateCardSize(groupCount: number): number {
  return 6 + Math.ceil(Math.ceil(groupCount / 2) * 1.5)
}

const TIRE_CORNERS = [
  { key: 'fl', labelKey: 'tires.corner_fl' },
  { key: 'fr', labelKey: 'tires.corner_fr' },
  { key: 'rl', labelKey: 'tires.corner_rl' },
  { key: 'rr', labelKey: 'tires.corner_rr' },
] as const

/** The tires with a valid reading, from lowest to highest. */
function sortedTires(state: VehicleState): { value: number; labelKey: string }[] {
  return TIRE_CORNERS
    // The explicit `labelKey` as `string` drops the `as const`'s literal
    // union: without this the following `filter`'s predicate does not
    // typecheck — it cannot narrow `labelKey` from a literal to `string`.
    .map((corner): { value: number | undefined; labelKey: string } => ({ value: state.tires[corner.key], labelKey: corner.labelKey }))
    .filter((entry): entry is { value: number; labelKey: string } => entry.value !== undefined)
    .sort((a, b) => a.value - b.value)
}

/**
 * What the car is doing about charging, in words. Extracted because two
 * summaries now say it — `phase` on its own and `charge` next to the
 * percentage — and two copies of this `if` would eventually disagree about
 * the same phase on the same screen.
 */
function chargingPhaseLabel(charging: VehicleState['charging'], t: TranslateFn): string {
  if (charging.phase === 'charging') return t(charging.speed === 'fast' ? 'charging.fast' : 'charging.slow')
  return t(`charging.${charging.phase}`)
}

function chargingSummary(group: ResolvedGroup, state: VehicleState, t: TranslateFn, language: string): string {
  const { charging } = state
  switch (group.summary) {
    case 'battery':
      return state.battery === undefined ? DASH : `${formatNumber(state.battery, 1)} %`
    case 'limit':
      return state.chargeLimit === undefined ? DASH : t('charging.limit', { percent: state.chargeLimit })
    case 'phase':
      return chargingPhaseLabel(charging, t)
    case 'eta':
      if (charging.remainingMinutes !== undefined) return formatDuration(charging.remainingMinutes, t)
      if (charging.finishTime) return formatTimeOfDay(charging.finishTime, language)
      return DASH
    default: {
      // Percentage FIRST: `.tile-summary` is nowrap with an ellipsis, so
      // the longest combination ("60.3 % · Plugged in, not charging") gets
      // cut in a narrow tile — and what has to survive the cut is the
      // number. The missing part is dropped rather than shown as a dash,
      // exactly as `locationSummary` does with "Parked · Home": a dash
      // would assert an unknown percentage beside a state that is perfectly
      // known.
      const percent = state.battery === undefined ? undefined : `${formatNumber(state.battery, 1)} %`
      const parts = [percent, chargingPhaseLabel(charging, t)]
        .filter((part): part is string => part !== undefined)
      return parts.length > 0 ? parts.join(' · ') : DASH
    }
  }
}

function statusSummary(group: ResolvedGroup, state: VehicleState, t: TranslateFn): string {
  switch (group.summary) {
    case 'openings': {
      const { openCount } = state.openings
      // "Tudo fechado" is an assertion, and a zero does not support it on
      // its own: it only holds if there is at least one opening reading
      // behind it.
      if (openCount === 0 && areOpeningsUnknown(state.openings)) return DASH
      if (openCount === 0) return t('openings.all_closed')
      if (openCount === 1) return t('openings.open_one')
      return t('openings.open_count', { count: openCount })
    }
    case 'trunk':
      if (state.openings.trunk === undefined) return DASH
      // The trunk is grammatically feminine in Portuguese: "Aberta", and not
      // the "Aberto" that serves the roof. The `_fem` pair exists only for
      // this, and in English it says the same word as the masculine form —
      // see the `boolValue` comment in `sections/openings.ts`.
      return t(state.openings.trunk ? 'openings.open_fem' : 'openings.closed_fem')
    default: {
      const { locked } = state.lock
      // `doors_unknown` is "Portas", a label — it served as a value by
      // accident, and the tile's summary calls for a value.
      if (locked === undefined) return DASH
      return t(locked ? 'doors_locked' : 'doors_unlocked')
    }
  }
}

function climateSummary(group: ResolvedGroup, state: VehicleState, t: TranslateFn): string {
  const { climate } = state
  switch (group.summary) {
    case 'target':
      return climate.targetC === undefined ? DASH : `${formatNumber(climate.targetC, 1)} °C`
    case 'state':
      return climate.on === undefined ? DASH : t(climate.on ? 'climate.state_on' : 'climate.state_off')
    default:
      return climate.interiorC === undefined ? DASH : `${formatNumber(climate.interiorC)} °C`
  }
}

function tiresSummary(group: ResolvedGroup, state: VehicleState, t: TranslateFn): string {
  const sorted = sortedTires(state)
  if (sorted.length === 0) return DASH
  const lowest = sorted[0]!
  switch (group.summary) {
    case 'min':
      return `${formatNumber(lowest.value, 1)} bar`
    case 'worst':
      // The corner goes with the number: knowing it is low without knowing
      // which one forces opening the sub-view, which is precisely what the
      // summary exists to avoid.
      return `${formatNumber(lowest.value, 1)} bar ${t(lowest.labelKey)}`
    default: {
      const highest = sorted[sorted.length - 1]!
      if (sorted.length === 1) return `${formatNumber(lowest.value, 1)} bar`
      return `${formatNumber(lowest.value, 1)} – ${formatNumber(highest.value, 1)} bar`
    }
  }
}

function tripSummary(_group: ResolvedGroup, state: VehicleState): string {
  const km = state.trip.odometerKm
  return km === undefined ? DASH : `${formatNumber(km)} km`
}

/**
 * The zone's display name. `home` is Home Assistant's own token for the home
 * zone, in lowercase, and printing it raw put an internal symbol in front of
 * the reader; every other value is already a zone's friendly name and passes
 * through untouched. `not_home` never arrives here — `buildLocation` treats it
 * as the absence of a zone, which is what it means.
 */
function zoneLabel(zone: string | undefined, t: TranslateFn): string | undefined {
  if (zone === undefined) return undefined
  return zone === 'home' ? t('location.home') : zone
}

function locationSummary(group: ResolvedGroup, state: VehicleState, t: TranslateFn): string {
  const zone = zoneLabel(state.location?.zone, t)
  switch (group.summary) {
    case 'zone':
      return zone ?? t('location.unknown')
    case 'age':
      return state.location?.ageSeconds === undefined ? DASH : formatAgo(state.location.ageSeconds, t)
    default: {
      // `activity.unknown` deliberately does not exist in the catalog: an
      // activity that is not known is not announced.
      const activity = state.activity === 'unknown' ? undefined : t(`activity.${state.activity}`)
      // Both when both are known: "Parked" alone does not say where, and a zone
      // alone does not say whether the car is sitting there or driving through
      // it. Either one alone is still worth showing.
      const parts = [activity, zone].filter((part): part is string => part !== undefined)
      return parts.length > 0 ? parts.join(' · ') : DASH
    }
  }
}

/**
 * The text the group's tile shows below the title. `group.summary` already
 * comes validated by `resolveGrid` — none of these `switch` statements need
 * to handle a summary that is not the group's, and each one's `default` is
 * the default summary, which is the first one in the catalog's list.
 */
export function summaryFor(
  group: ResolvedGroup, state: VehicleState, t: TranslateFn, language: string,
): string {
  // A car that has not reported anything has no summaries: without this
  // guard, each section invented its own zero — "tudo fechado", "desligado"
  // — and asserted facts the card does not know. `alertFor` already did the
  // same. See spec §4.2 and §9.
  if (!state.online) return DASH

  switch (group.id) {
    case 'charging': return chargingSummary(group, state, t, language)
    case 'status': return statusSummary(group, state, t)
    case 'climate': return climateSummary(group, state, t)
    case 'tires': return tiresSummary(group, state, t)
    case 'trip': return tripSummary(group, state)
    case 'location': return locationSummary(group, state, t)
  }
}

export type AlertLevel = 'none' | 'warn' | 'alert'

/**
 * A group tile's alert level. Three rules worth pinning down here, because
 * none of them is obvious:
 *
 *  - **Offline does not alert.** Absence of a reading is not a problem; a
 *    card that turned all amber upon losing its connection to the cloud
 *    would teach people to ignore it.
 *  - **Stale locks do not alert.** The card already distinguishes
 *    `lock.stale`, and an old reading is an old reading, not an unlocked
 *    car. The openings are independent readings and keep warning.
 *  - **Charging has no alert.** Uses `batteryColor()`, which already gives
 *    green, amber and red by percentage — the right semantics, already
 *    written.
 */
export function alertFor(
  group: ResolvedGroup, state: VehicleState, tireRange: readonly [number, number],
): AlertLevel {
  if (!state.online) return 'none'

  switch (group.id) {
    case 'status': {
      if (state.openings.openCount > 0) return 'warn'
      if (state.lock.locked === false && !state.lock.stale) return 'warn'
      return 'none'
    }
    case 'tires': {
      const [min, max] = tireRange
      const outside = Object.values(state.tires)
        .filter((value): value is number => value !== undefined)
        .filter(value => value < min || value > max)
        .length
      if (outside >= 2) return 'alert'
      if (outside === 1) return 'warn'
      return 'none'
    }
    case 'location':
      return state.location?.stale === true ? 'warn' : 'none'
    case 'charging':
    case 'climate':
    case 'trip':
      return 'none'
  }
}
