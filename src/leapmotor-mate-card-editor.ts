import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import type { HomeAssistant } from './ha-types'
import { groupActions } from './actions'
import { GROUP_CATALOGUE, GROUP_ORDER } from './groups'
import { createTranslator, pickLanguage } from './localize'
import {
  DEFAULT_ACTIONS, DEFAULT_CONFIRM_ACTIONS, DEFAULT_DOUBLE_CONFIRM_ACTIONS, DEFAULT_MAP_ZOOM, DEFAULT_TIRE_RANGE,
  MAP_ZOOM_MAX, MAP_ZOOM_MIN, clampTireRange,
  type ActionId, type ActionSection, type GridEntry, type GroupId, type LeapmotorCardConfig,
} from './types'

/**
 * An entry per action, and not a list: `Record<ActionId, boolean>` forces
 * the compiler to demand a decision about every new action. With a list, an
 * eighteenth action would compile, pass the exhaustive tests, and simply
 * never appear in the editor — with nobody noticing.
 *
 * The five that are left out are not usable as an actions-row button:
 * `steeringWheelHeat`, `mirrorHeat` and `batteryPreheat` live in the comfort
 * panel provides (see `PAYLOAD_ACTIONS` in `actions.ts`).
 */
const OFFERED_IN_EDITOR: Record<ActionId, boolean> = {
  unlock: true, lock: true, trunk: true, windows: true, sunshade: true,
  quickCool: true, quickHeat: true, quickVentilation: true, defrost: true,
  findVehicle: true, unlockCharger: true, refresh: false, climate: true, climateOff: false,
  steeringWheelHeat: false, mirrorHeat: false, batteryPreheat: true,
  driverSeatHeat: false, driverSeatVent: false, passengerSeatHeat: false, passengerSeatVent: false,
  setChargeLimit: false,
}

const ALL_ACTIONS: ActionId[] = (Object.keys(OFFERED_IN_EDITOR) as ActionId[])
  .filter(a => OFFERED_IN_EDITOR[a])

/**
 * `trunk` and `windows` are alternating and have neither an `action.trunk`
 * nor an `action.windows` key — the real keys are `action.trunk_open`/`_close`
 * and `action.windows_open`/`_close`. In the editor we show the opening
 * form, which is the label the app uses. Without this map,
 * `t('action.trunk')` would return the key itself and the dropdown would
 * show "action.trunk".
 *
 * `climate` is also alternating, ever since `actionLabel` started giving it
 * `action.climate_on`/`_off`, but it still has a neutral key — and that is
 * the one the editor uses, via the default path. Here an action is chosen,
 * not executed: a dropdown offering "Turn on climate control" would promise
 * a meaning the configured button does not have.
 */
const ACTION_LABEL_KEY: Partial<Record<ActionId, string>> = {
  trunk: 'action.trunk_open',
  windows: 'action.windows_open',
}

/** Two lists with the same members in the same order. */
function same(a: unknown, b: readonly unknown[]): boolean {
  return Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i])
}

function actionOptionLabel(t: (k: string) => string, a: ActionId): string {
  return t(ACTION_LABEL_KEY[a] ?? `action.${a}`)
}

@customElement('leapmotor-mate-card-editor')
export class LeapmotorCardEditor extends LitElement {
  @internalState() private _config?: LeapmotorCardConfig
  @property({ attribute: false }) public hass?: HomeAssistant

  public setConfig(config: LeapmotorCardConfig): void {
    this._config = { ...config }
    this.rememberLongForm(config.grid)
  }

  /**
   * The form, in the sections Home Assistant's own card editors use: one
   * expandable block per function, the first one open. `flatten` keeps every
   * option at the top level of the YAML, whatever block it is edited in.
   */
  private schema(t: (k: string) => string) {
    const actionOptions = ALL_ACTIONS.map(a => ({ value: a, label: actionOptionLabel(t, a) }))
    const tapActions = { ui_action: { actions: ['more-info', 'navigate', 'url', 'perform-action', 'none'] } }
    const section = (key: string, icon: string, schema: unknown[], expanded = false) =>
      ({ type: 'expandable', name: '', title: t(`editor.section.${key}`), icon, flatten: true, expanded, schema })
    return [
      section('vehicle', 'mdi:car', [
        { name: 'name', selector: { text: {} } },
        // The car's id (the last six characters of its VIN, as in `leapmotor_mate_xxxxxx_…`).
        // Only needed with more than one Leapmotor car; the card finds a single one by itself.
        { name: 'device', selector: { text: {} } },
        {
          name: 'language',
          // The language names stay in their own language, by convention for
          // language selectors. Only the automatic option goes through `t()`.
          selector: { select: { mode: 'dropdown', options: [
            { value: '', label: t('editor.language_auto') },
            { value: 'it', label: 'Italiano' },
            { value: 'en', label: 'English' },
            { value: 'pt', label: 'Português' },
          ] } },
        },
      ], true),
      section('picture', 'mdi:image-outline', [
        { name: 'mate_url', selector: { text: { type: 'url' } } },
        {
          name: 'image',
          selector: { select: { mode: 'dropdown', custom_value: true, options: [
            { value: 'auto', label: t('editor.image_auto') },
            { value: 'entity', label: t('editor.image_entity') },
            { value: 'none', label: t('editor.image_none') },
          ] } },
        },
        // HA's own action picker. The list is explicit and leaves out `toggle`
        // and `assist`: the editor must not write an action the card ignores.
        { name: 'image_tap_action', selector: tapActions },
        { name: 'range_tap_action', selector: tapActions },
      ]),
      section('actions', 'mdi:gesture-tap-button', [
        { name: 'actions', selector: { select: { multiple: true, mode: 'list', options: actionOptions } } },
      ]),
      section('safety', 'mdi:shield-lock-outline', [
        { name: 'double_confirm_actions', selector: { select: { multiple: true, mode: 'dropdown', options: actionOptions } } },
        { name: 'confirm_actions', selector: { select: { multiple: true, mode: 'dropdown', options: actionOptions } } },
        { name: 'disabled_actions', selector: { select: { multiple: true, mode: 'dropdown', options: actionOptions } } },
      ]),
      section('details', 'mdi:tune-variant', [
        { type: 'grid', name: '', schema: [
          { name: 'tire_min', selector: { number: { min: 1, max: 4, step: 0.1, mode: 'box', unit_of_measurement: 'bar' } } },
          { name: 'tire_max', selector: { number: { min: 1, max: 4, step: 0.1, mode: 'box', unit_of_measurement: 'bar' } } },
        ] },
        { name: 'map_zoom', selector: { number: { min: MAP_ZOOM_MIN, max: MAP_ZOOM_MAX, mode: 'box' } } },
      ]),
    ]
  }

  /** Every field has a label in the user's language, and the ones that need it a line of help. */
  private computeLabel = (t: (k: string) => string) => (s: { name: string }): string =>
    (s.name ? t(`editor.${s.name}`) : '')

  private computeHelper = (t: (k: string) => string) => (s: { name: string }): string | undefined => {
    const key = `editor.${s.name}_help`
    const text = t(key)
    return text === key ? undefined : text
  }

  private valueChanged(e: CustomEvent<{ value: Record<string, unknown> }>) {
    const raw = { ...e.detail.value }
    // `tire_min` / `tire_max` exist only in the form: the option is one list.
    const min = Number(raw.tire_min), max = Number(raw.tire_max)
    delete raw.tire_min
    delete raw.tire_max
    if (Number.isFinite(min) && Number.isFinite(max)) raw.tire_range = clampTireRange([min, max])
    // What equals the default is not written: the YAML keeps only what the
    // user chose, and a later change of a default reaches it.
    for (const key of ['language', 'device', 'name', 'mate_url'] as const) if (raw[key] === '' || raw[key] == null) delete raw[key]
    if (raw.image === 'auto') delete raw.image
    if (raw.map_zoom === DEFAULT_MAP_ZOOM) delete raw.map_zoom
    if (same(raw.tire_range, DEFAULT_TIRE_RANGE)) delete raw.tire_range
    if (same(raw.actions, DEFAULT_ACTIONS)) delete raw.actions
    if (same(raw.double_confirm_actions, DEFAULT_DOUBLE_CONFIRM_ACTIONS)) delete raw.double_confirm_actions
    if (same(raw.confirm_actions, DEFAULT_CONFIRM_ACTIONS)) delete raw.confirm_actions
    if (same(raw.disabled_actions, [])) delete raw.disabled_actions
    // `sections` no longer exists in the type, but it may exist in
    // configurations that have not been migrated yet — `ha-form` returns
    // everything it was given, so it is here, in the editor, that the dead
    // key finally disappears.
    delete (raw as Record<string, unknown>)['sections']
    const config = { type: 'custom:leapmotor-mate-card', ...raw } as LeapmotorCardConfig
    this._config = config
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }))
  }

  /** Writes `action_sections`, or removes the key when no section is left: the row then groups by itself. */
  private commitSections(sections: ActionSection[]) {
    const config = { ...this._config, type: 'custom:leapmotor-mate-card' } as LeapmotorCardConfig
    if (sections.length > 0) config.action_sections = sections
    else delete config.action_sections
    this._config = config
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }))
  }

  private sections(): ActionSection[] {
    const s = this._config?.action_sections
    return Array.isArray(s) ? s.map(x => ({ title: x?.title ?? '', actions: Array.isArray(x?.actions) ? x.actions : [] })) : []
  }

  /** Starts from what the row shows today, so customising is renaming and moving, not rebuilding. */
  private startSections(t: (k: string) => string) {
    const actions = this._config?.actions ?? DEFAULT_ACTIONS
    this.commitSections(groupActions(actions).map(g => ({ title: t(`action_group.${g.group}`), actions: g.actions })))
  }

  private moveSection(index: number, delta: -1 | 1) {
    const list = this.sections()
    const target = index + delta
    if (target < 0 || target >= list.length) return
    const [moved] = list.splice(index, 1)
    list.splice(target, 0, moved!)
    this.commitSections(list)
  }

  /**
   * The action row's sections: a name and a set of buttons each, in the order
   * they are drawn. With none, the row groups the chosen actions by function
   * under its own names — which is what the first button turns into sections
   * to start from.
   */
  private renderSectionsEditor(t: (k: string) => string) {
    const list = this.sections()
    const options = ALL_ACTIONS.map(a => ({ value: a, label: actionOptionLabel(t, a) }))
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'actions', selector: { select: { multiple: true, mode: 'dropdown', options } } },
    ]
    const label = (s: { name: string }) => t(s.name === 'title' ? 'editor.section_title' : 'editor.section_actions')
    return html`<div class="sections-editor">
      <div class="grid-title">${t('editor.action_sections')}</div>
      <div class="grid-help">${t(list.length ? 'editor.action_sections_help' : 'editor.action_sections_auto')}</div>
      ${list.map((section, index) => html`
        <div class="section-card">
          <ha-form
            .hass=${this.hass} .data=${section} .schema=${schema} .computeLabel=${label}
            @value-changed=${(e: CustomEvent<{ value: ActionSection }>) => {
              e.stopPropagation()
              const next = this.sections()
              next[index] = { title: e.detail.value.title ?? '', actions: e.detail.value.actions ?? [] }
              this.commitSections(next)
            }}
          ></ha-form>
          <div class="section-tools">
            <ha-icon-button .label=${t('editor.grid_up')} .disabled=${index === 0}
              @click=${() => this.moveSection(index, -1)}><ha-icon icon="mdi:arrow-up"></ha-icon></ha-icon-button>
            <ha-icon-button .label=${t('editor.grid_down')} .disabled=${index === list.length - 1}
              @click=${() => this.moveSection(index, 1)}><ha-icon icon="mdi:arrow-down"></ha-icon></ha-icon-button>
            <ha-icon-button .label=${t('editor.section_delete')}
              @click=${() => this.commitSections(this.sections().filter((_, i) => i !== index))}><ha-icon icon="mdi:delete-outline"></ha-icon></ha-icon-button>
          </div>
        </div>
      `)}
      <div class="section-buttons">
        ${list.length === 0
          ? html`<button class="add" @click=${() => this.startSections(t)}>${t('editor.section_start')}</button>`
          : html`
            <button class="add" @click=${() => this.commitSections([...this.sections(), { title: '', actions: [] }])}>${t('editor.section_add')}</button>
            <button class="add" @click=${() => this.commitSections([])}>${t('editor.section_reset')}</button>`}
      </div>
    </div>`
  }

  /** The groups in order, with each one's checkbox state. */
  private gridRows(): { id: GroupId; on: boolean }[] {
    const configured = this._config?.grid
    if (!Array.isArray(configured)) {
      // Without a `grid:` written, the grid is the whole catalog:
      // everything is shown turned on, which is what the card does.
      return GROUP_ORDER.map(id => ({ id, on: true }))
    }
    const chosen = configured
      .map(entry => (typeof entry === 'string' ? entry : entry.group))
      .filter((id): id is GroupId => id in GROUP_CATALOGUE)
    const rest = GROUP_ORDER.filter(id => !chosen.includes(id))
    return [
      ...chosen.map(id => ({ id, on: true })),
      ...rest.map(id => ({ id, on: false })),
    ]
  }

  /**
   * What each group had in the long form — icon, title, summary — even
   * after the user turns it off. It is deliberately never cleared entirely:
   * that is what makes turning off and back on not lose what was in the
   * YAML.
   *
   * A group that reappears in the SHORT form erases its entry here —
   * otherwise an icon that someone removed from the YAML by hand would
   * come back to life on the next tap.
   */
  private _longForm = new Map<GroupId, GridEntry>()

  private rememberLongForm(grid: GridEntry[] | undefined): void {
    if (!Array.isArray(grid)) return
    for (const entry of grid) {
      if (typeof entry === 'string') this._longForm.delete(entry)
      else if (entry.group in GROUP_CATALOGUE) this._longForm.set(entry.group, entry)
    }
  }

  /**
   * Writes the `grid:` from the rows. Preserves the long form of an entry
   * that already had one: reordering or turning off in the editor must not
   * erase an icon, a title or a summary that someone wrote by hand in YAML.
   *
   * The memory is `_longForm`, and not the current `grid:`, and that is the
   * fix for a real defect: turning off a group removes its entry from
   * `grid:`, so reading the long form from there meant that turning it back
   * on would no longer find it and would write the group in the short form
   * — the icon disappeared without warning.
   */
  private commitGrid(rows: { id: GroupId; on: boolean }[]) {
    const grid: GridEntry[] = rows
      .filter(row => row.on)
      .map(row => this._longForm.get(row.id) ?? row.id)

    const config = { ...this._config, type: 'custom:leapmotor-mate-card', grid } as LeapmotorCardConfig
    this._config = config
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }))
  }

  private toggleGroup(id: GroupId) {
    this.commitGrid(this.gridRows().map(row => (row.id === id ? { ...row, on: !row.on } : row)))
  }

  private moveGroup(id: GroupId, delta: -1 | 1) {
    const rows = this.gridRows()
    const index = rows.findIndex(row => row.id === id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= rows.length) return
    const reordered = [...rows]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved!)
    this.commitGrid(reordered)
  }

  /**
   * `ha-formfield`, `ha-checkbox` and `ha-icon-button` come from the Home
   * Assistant frontend, not from this package — there is no way to verify
   * them from within this repository. If this block appears empty on a
   * real dashboard, it is the first place to suspect: a custom element
   * without a definition gives no error at all, it just draws nothing.
   */
  private renderGridEditor(t: (k: string) => string) {
    const rows = this.gridRows()
    /*
     * The arrows only operate within the block of chosen groups, because
     * only those are written into the `grid:`. Moving a turned-off row
     * persisted nothing and the next render put it back — the arrow seemed
     * broken. The same held for pushing the last turned-on row below the
     * boundary between the two blocks.
     */
    const onCount = rows.filter(row => row.on).length
    return html`<div class="grid-editor">
      <div class="grid-title">${t('editor.grid')}</div>
      <div class="grid-help">${t('editor.grid_help')}</div>
      ${rows.map((row, index) => html`
        <div class="grid-row">
          <ha-formfield .label=${t(GROUP_CATALOGUE[row.id].titleKey)}>
            <ha-checkbox
              .checked=${row.on}
              @change=${() => this.toggleGroup(row.id)}
            ></ha-checkbox>
          </ha-formfield>
          <ha-icon-button
            .label=${t('editor.grid_up')}
            .disabled=${!row.on || index === 0}
            @click=${() => this.moveGroup(row.id, -1)}
          ><ha-icon icon="mdi:arrow-up"></ha-icon></ha-icon-button>
          <ha-icon-button
            .label=${t('editor.grid_down')}
            .disabled=${!row.on || index >= onCount - 1}
            @click=${() => this.moveGroup(row.id, 1)}
          ><ha-icon icon="mdi:arrow-down"></ha-icon></ha-icon-button>
        </div>
      `)}
    </div>`
  }

  static override styles = css`
    .grid-editor, .sections-editor { margin-top: 16px; }
    .section-card {
      display: flex; align-items: flex-start; gap: 4px; padding: 8px 4px 8px 12px; margin-top: 8px;
      border: 1px solid var(--divider-color); border-radius: 12px;
    }
    .section-card ha-form { flex: 1 1 auto; min-width: 0; }
    .section-tools { display: flex; flex-direction: column; }
    .section-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    button.add {
      min-height: 36px; padding: 0 16px; border-radius: 18px; cursor: pointer; font: inherit; font-weight: 500;
      color: var(--primary-color); background: transparent; border: 1px solid var(--primary-color);
    }
    .grid-title {
      font-size: 0.85rem; font-weight: 500;
      color: var(--secondary-text-color); margin-bottom: 4px;
    }
    .grid-help { font-size: 0.8rem; color: var(--secondary-text-color); margin-bottom: 4px; }
    .grid-row { display: flex; align-items: center; gap: 4px; }
    .grid-row ha-formfield { flex: 1 1 auto; min-width: 0; }
  `

  override render() {
    if (!this._config || !this.hass) return nothing
    const language = pickLanguage(this._config.language, this.hass.locale?.language)
    const t = createTranslator(language)

    const [tireMin, tireMax] = clampTireRange(this._config.tire_range)
    const data = {
      image: 'auto',
      actions: DEFAULT_ACTIONS,
      double_confirm_actions: DEFAULT_DOUBLE_CONFIRM_ACTIONS,
      confirm_actions: DEFAULT_CONFIRM_ACTIONS,
      disabled_actions: [],
      map_zoom: DEFAULT_MAP_ZOOM,
      ...this._config,
      tire_min: tireMin,
      tire_max: tireMax,
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this.schema(t)}
        .computeLabel=${this.computeLabel(t)}
        .computeHelper=${this.computeHelper(t)}
        @value-changed=${this.valueChanged}
      ></ha-form>
      ${this.renderSectionsEditor(t)}
      ${this.renderGridEditor(t)}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-mate-card-editor': LeapmotorCardEditor }
}
