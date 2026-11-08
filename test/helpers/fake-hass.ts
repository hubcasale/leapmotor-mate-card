import type { HassEntity, HomeAssistant } from '../../src/ha-types'

export interface FakeEntitySpec {
  /** Full entity_id, e.g. `sensor.leapmotor_mate_5r1234_battery`. */
  entity_id: string
  state?: string
  unit?: string
  attributes?: Record<string, unknown>
  /** Home Assistant device the entity belongs to (only used for names). */
  device_id?: string
}

export function fakeHass(
  specs: FakeEntitySpec[],
  devices: Record<string, { name?: string; name_by_user?: string }> = {},
): HomeAssistant {
  const entities: HomeAssistant['entities'] = {}
  const states: Record<string, HassEntity> = {}

  for (const spec of specs) {
    if (spec.device_id) entities[spec.entity_id] = { entity_id: spec.entity_id, device_id: spec.device_id, platform: 'mqtt' }
    states[spec.entity_id] = {
      entity_id: spec.entity_id,
      state: spec.state ?? 'off',
      attributes: { ...(spec.unit ? { unit_of_measurement: spec.unit } : {}), ...spec.attributes },
      last_changed: '2026-11-08T10:00:00+00:00',
      last_updated: '2026-11-08T10:00:00+00:00',
    }
  }

  return {
    states,
    entities,
    devices: Object.fromEntries(Object.entries(devices).map(([id, d]) => [id, { id, ...d }])),
    locale: { language: 'en' },
    callService: async () => undefined,
    callWS: async () => [] as never,
  }
}
