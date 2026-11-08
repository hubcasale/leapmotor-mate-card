import { describe, expect, it } from 'vitest'
import { ENTITY_KEYS, type EntityDef, type LogicalKey } from '../src/keys'
import { resolveEntities } from '../src/resolver'
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

  it('uses only slugs made of lowercase letters, digits and underscores', () => {
    for (const [key, def] of Object.entries(ENTITY_KEYS) as [LogicalKey, EntityDef][]) {
      if (def.slug !== null) expect(def.slug, key).toMatch(/^[a-z0-9_]+$/)
    }
  })
})
