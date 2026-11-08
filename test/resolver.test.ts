import { describe, expect, it } from 'vitest'
import { ENTITY_KEYS, type EntityDef, type LogicalKey } from '../src/keys'
import { resolveEntities } from '../src/resolver'
import type { EntityRegistryEntry } from '../src/ha-types'
import { fakeHass } from './helpers/fake-hass'
import { CAR, id, mateSpecs } from './fixtures/mate-states'

const CONFIG = { type: 'custom:leapmotor-mate-card' }

describe('resolveEntities — one Mate car', () => {
  it('finds the only car without being told which', () => {
    const r = resolveEntities(fakeHass(mateSpecs()), CONFIG)
    expect(r.error).toBeUndefined()
    expect(r.deviceId).toBe(CAR)
    expect(r.map.battery).toBe(id('sensor', 'battery'))
    expect(r.map.lock).toBe(id('lock', 'door_lock'))
  })

  it('maps every logical name Mate publishes, and none that it does not', () => {
    const r = resolveEntities(fakeHass(mateSpecs()), CONFIG)
    const published = (Object.entries(ENTITY_KEYS) as [LogicalKey, EntityDef][]).filter(([, d]) => d.slug !== null)
    // Everything Mate publishes in the fixture resolves…
    const unresolved = published.map(([key]) => key).filter(key => !r.map[key])
    expect(unresolved).toEqual([])
    // …and a name Mate does not publish is never resolved by accident.
    for (const [key, def] of Object.entries(ENTITY_KEYS) as [LogicalKey, EntityDef][]) {
      if (def.slug === null) expect(r.map[key], key).toBeUndefined()
    }
  })

  it('tells apart the two entities that share a slug (binary sensor and switch "Trunk")', () => {
    const r = resolveEntities(fakeHass(mateSpecs()), CONFIG)
    expect(r.map.trunk).toBe(id('binary_sensor', 'trunk'))
  })

  it('does not list as missing a name Mate never publishes', () => {
    const r = resolveEntities(fakeHass(mateSpecs()), CONFIG)
    expect(r.missing).not.toContain('batteryPrecise')
    expect(r.missing).not.toContain('schedulePlanned')
  })

  it('lists as missing what Mate publishes but this car does not have (the B10 comfort case)', () => {
    const r = resolveEntities(fakeHass(mateSpecs({ 'button/driver_seat_heat_on': null, 'button/steering_heat_on': null })), CONFIG)
    expect(r.missing).toContain('driverSeatHeatOn')
    expect(r.missing).toContain('steeringWheelHeatOn')
    expect(r.map.driverSeatHeatOn).toBeUndefined()
  })

  it('ignores entities of other integrations', () => {
    const noise = [{ entity_id: 'sensor.garage_temperature', state: '12' }, { entity_id: 'sensor.leapmotor_battery', state: '50' }]
    const r = resolveEntities(fakeHass([...mateSpecs(), ...noise]), CONFIG)
    expect(r.candidates).toHaveLength(1)
  })

  it('returns not_found when there is no Mate entity at all', () => {
    const r = resolveEntities(fakeHass([{ entity_id: 'sensor.garage_temperature', state: '12' }]), CONFIG)
    expect(r.error).toBe('not_found')
    expect(r.map).toEqual({})
  })

  it('names the car after its Home Assistant device when there is one', () => {
    const specs = mateSpecs().map(s => ({ ...s, device_id: 'dev1' }))
    const r = resolveEntities(fakeHass(specs, { dev1: { name: 'Leapmotor Mate 5R1234', name_by_user: 'La mia B10' } }), CONFIG)
    expect(r.deviceName).toBe('La mia B10')
  })

  it('falls back to the id in capitals for the name', () => {
    expect(resolveEntities(fakeHass(mateSpecs()), CONFIG).deviceName).toBe('Leapmotor 5R1234')
  })
})

describe('resolveEntities — several cars', () => {
  const two = () => fakeHass([...mateSpecs(), ...mateSpecs({}, 'abc999')])

  it('asks which one when there are two and none is chosen', () => {
    const r = resolveEntities(two(), CONFIG)
    expect(r.error).toBe('ambiguous')
    expect(r.candidates.map(c => c.id).sort()).toEqual(['5r1234', 'abc999'])
  })

  it('accepts the id, the whole prefix, or any entity of the car as `device`', () => {
    for (const device of ['abc999', 'ABC999', 'leapmotor_mate_abc999', id('sensor', 'battery', 'abc999')]) {
      const r = resolveEntities(two(), { ...CONFIG, device })
      expect(r.deviceId, device).toBe('abc999')
      expect(r.map.battery).toBe(id('sensor', 'battery', 'abc999'))
    }
  })

  it('accepts the Home Assistant device id', () => {
    const specs = [...mateSpecs().map(s => ({ ...s, device_id: 'devA' })), ...mateSpecs({}, 'abc999').map(s => ({ ...s, device_id: 'devB' }))]
    const r = resolveEntities(fakeHass(specs, { devA: { name: 'A' }, devB: { name: 'B' } }), { ...CONFIG, device: 'devB' })
    expect(r.deviceId).toBe('abc999')
  })

  it('returns unknown_device for a car that does not exist', () => {
    expect(resolveEntities(two(), { ...CONFIG, device: 'zzz000' }).error).toBe('unknown_device')
  })
})

describe('resolveEntities — entity overrides', () => {
  it('lets `entities` replace one logical name', () => {
    const r = resolveEntities(fakeHass(mateSpecs()), { ...CONFIG, entities: { range: 'sensor.my_own_range' } })
    expect(r.map.range).toBe('sensor.my_own_range')
  })

  it('takes an override out of the missing list', () => {
    const r = resolveEntities(fakeHass(mateSpecs({ 'sensor/range': null })), { ...CONFIG, entities: { range: 'sensor.my_own_range' } })
    expect(r.missing).not.toContain('range')
  })
})

describe('ENTITY_KEYS', () => {
  it('has no two logical names sharing one entity, except the charge limit read and write', () => {
    const seen = new Map<string, LogicalKey>()
    const shared: string[] = []
    for (const [key, def] of Object.entries(ENTITY_KEYS) as [LogicalKey, EntityDef][]) {
      if (def.slug === null) continue
      const k = `${def.domain}/${def.slug}`
      if (seen.has(k)) shared.push(`${seen.get(k)}+${key}`)
      seen.set(k, key)
    }
    expect(shared).toEqual(['chargeLimit+chargeLimitSet'])
  })

  it('gives every entity Mate publishes its internal key, the tail of its unique_id', () => {
    const without = (Object.entries(ENTITY_KEYS) as [LogicalKey, EntityDef][]).filter(([, d]) => d.slug !== null && !d.key).map(([k]) => k)
    expect(without).toEqual([])
  })

  it('uses only slugs made of lowercase letters, digits and underscores', () => {
    for (const [key, def] of Object.entries(ENTITY_KEYS) as [LogicalKey, EntityDef][]) {
      if (def.slug !== null) expect(def.slug, key).toMatch(/^[a-z0-9_]+$/)
    }
  })
})

describe('resolveEntities — by the stable unique_id', () => {
  const VIN = 'LFZ7N0000005R1234'
  const reg = (entity_id: string, key: string, platform = 'mqtt'): EntityRegistryEntry =>
    ({ entity_id, platform, unique_id: `leapmotor_mate_${VIN.toLowerCase()}_${key}`, device_id: 'dev1' })

  it('finds an entity that kept the id of an older Mate (door_driver, not door_front_left)', () => {
    const specs = mateSpecs({ 'binary_sensor/door_front_left': null })
    specs.push({ entity_id: id('binary_sensor', 'door_driver'), state: 'on' })
    const hass = fakeHass(specs)
    // by entity_id alone the front-left door is lost…
    expect(resolveEntities(hass, CONFIG).map.doorDriver).toBeUndefined()
    // …with the registry it is found by its unique_id.
    const r = resolveEntities(hass, CONFIG, [reg(id('binary_sensor', 'door_driver'), 'door_driver')])
    expect(r.map.doorDriver).toBe(id('binary_sensor', 'door_driver'))
    expect(r.missing).not.toContain('doorDriver')
  })

  it('finds entities the user renamed to anything', () => {
    const specs = mateSpecs({ 'sensor/battery': null })
    specs.push({ entity_id: 'sensor.la_mia_b10_batteria', state: '70' })
    const r = resolveEntities(fakeHass(specs), CONFIG, [reg('sensor.la_mia_b10_batteria', 'soc')])
    expect(r.map.battery).toBe('sensor.la_mia_b10_batteria')
  })

  it('tells apart entities of different domains that share a key', () => {
    const specs = [...mateSpecs(), { entity_id: 'switch.x_trunk', state: 'off' }]
    const r = resolveEntities(fakeHass(specs), CONFIG, [reg('switch.x_trunk', 'trunk'), reg(id('binary_sensor', 'trunk'), 'trunk_open')])
    expect(r.map.trunk).toBe(id('binary_sensor', 'trunk'))
  })

  it('prefers the unique_id over a look-alike entity_id', () => {
    const specs = [...mateSpecs(), { entity_id: 'sensor.mine_range', state: '300' }]
    const r = resolveEntities(fakeHass(specs), CONFIG, [reg('sensor.mine_range', 'range')])
    expect(r.map.range).toBe('sensor.mine_range')
  })

  it('ignores entries of other platforms and entities that no longer exist', () => {
    const r = resolveEntities(fakeHass(mateSpecs()), CONFIG, [
      reg('sensor.other', 'soc', 'zha'), reg('sensor.gone', 'range'),
    ])
    expect(r.map.battery).toBe(id('sensor', 'battery'))
    expect(r.map.range).toBe(id('sensor', 'range'))
  })

  it('still resolves by entity_id when the registry cannot be read', () => {
    expect(resolveEntities(fakeHass(mateSpecs()), CONFIG, []).map.battery).toBe(id('sensor', 'battery'))
    expect(resolveEntities(fakeHass(mateSpecs()), CONFIG, undefined).map.battery).toBe(id('sensor', 'battery'))
  })

  it('finds a car whose every entity was renamed', () => {
    const specs = [{ entity_id: 'sensor.b10_batteria', state: '70' }, { entity_id: 'lock.b10_porte', state: 'locked' }]
    const r = resolveEntities(fakeHass(specs), CONFIG, [reg('sensor.b10_batteria', 'soc'), reg('lock.b10_porte', 'door_lock')])
    expect(r.error).toBeUndefined()
    expect(r.deviceId).toBe('5r1234')
    expect(r.map.battery).toBe('sensor.b10_batteria')
    expect(r.map.lock).toBe('lock.b10_porte')
  })
})
