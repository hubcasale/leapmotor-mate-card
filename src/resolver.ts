import type { HomeAssistant } from './ha-types'
import { ENTITY_KEYS, MATE_PREFIX, type EntityDef, type LogicalKey } from './keys'
import type { EntityMap, LeapmotorCardConfig } from './types'

export type ResolveError = 'not_found' | 'ambiguous' | 'unknown_device'

export interface ResolveResult {
  /** The car's id: the last six characters of its VIN, lowercase — the middle of `leapmotor_mate_<id>_…`. */
  deviceId?: string
  deviceName?: string
  map: EntityMap
  /** Logical names Mate does publish but that were not found for this car. */
  missing: LogicalKey[]
  error?: ResolveError
  candidates: { id: string; name: string }[]
}

/**
 * Leapmotor Mate publishes its entities through MQTT discovery, in English,
 * under a device named `Leapmotor Mate <last six of the VIN>`. Home Assistant
 * builds every entity_id from that device name and the entity's name, so the
 * id is always `<domain>.leapmotor_mate_<id>_<slug>` — independent of the
 * language of Home Assistant or of Mate. That is the one thing this resolver
 * reads: it needs no entity registry, so it also works for users who are not
 * administrators.
 */
const ENTITY_ID = new RegExp(`^([a-z_]+)\\.${MATE_PREFIX}([a-z0-9]+)_(.+)$`)

interface Found { domain: string; slug: string; entityId: string }

function carsIn(hass: HomeAssistant): Map<string, Found[]> {
  const cars = new Map<string, Found[]>()
  for (const entityId of Object.keys(hass.states)) {
    const m = ENTITY_ID.exec(entityId)
    if (!m) continue
    const [, domain, id, slug] = m as unknown as [string, string, string, string]
    const list = cars.get(id) ?? []
    list.push({ domain, slug, entityId })
    cars.set(id, list)
  }
  return cars
}

function nameOf(hass: HomeAssistant, id: string, found: Found[]): string {
  const deviceId = hass.entities?.[found[0]!.entityId]?.device_id
  const device = deviceId ? hass.devices?.[deviceId] : undefined
  return device?.name_by_user || device?.name || `Leapmotor ${id.toUpperCase()}`
}

/** `wanted` may be the id (`5r1234`), the whole prefix, a device id of Home Assistant, or any entity of the car. */
function pickCar(hass: HomeAssistant, cars: Map<string, Found[]>, wanted: string): string | undefined {
  const w = wanted.toLowerCase()
  if (cars.has(w)) return w
  const prefixed = w.startsWith(MATE_PREFIX) ? w.slice(MATE_PREFIX.length) : undefined
  if (prefixed && cars.has(prefixed)) return prefixed
  const m = ENTITY_ID.exec(w)
  if (m && cars.has(m[2]!)) return m[2]
  for (const [id, found] of cars) {
    if (hass.entities?.[found[0]!.entityId]?.device_id === wanted) return id
  }
  return undefined
}

export function resolveEntities(hass: HomeAssistant, config: LeapmotorCardConfig): ResolveResult {
  const cars = carsIn(hass)
  const candidates = [...cars].map(([id, found]) => ({ id, name: nameOf(hass, id, found) }))
  const empty = (error: ResolveError): ResolveResult =>
    ({ map: {}, missing: [], error, candidates })

  if (cars.size === 0) return empty('not_found')

  let id: string | undefined
  if (config.device) {
    id = pickCar(hass, cars, config.device)
    if (!id) return empty('unknown_device')
  } else if (cars.size === 1) {
    id = [...cars.keys()][0]
  } else {
    return empty('ambiguous')
  }

  const found = cars.get(id!)!
  const byDomainSlug = new Map(found.map(f => [`${f.domain}/${f.slug}`, f.entityId]))

  const map: EntityMap = {}
  const missing: LogicalKey[] = []
  for (const [key, def] of Object.entries(ENTITY_KEYS) as [LogicalKey, EntityDef][]) {
    if (def.slug === null) continue
    const entityId = byDomainSlug.get(`${def.domain}/${def.slug}`)
    if (entityId) map[key] = entityId
    else missing.push(key)
  }

  for (const [key, entityId] of Object.entries(config.entities ?? {}) as [LogicalKey, string][]) {
    if (!entityId) continue
    map[key] = entityId
    const i = missing.indexOf(key)
    if (i >= 0) missing.splice(i, 1)
  }

  return { deviceId: id, deviceName: nameOf(hass, id!, found), map, missing, candidates }
}
