import { html, type TemplateResult } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'

/**
 * The cars the card can draw. The drawings are generated from the real
 * dimensions (millimetres, approximate and rounded) rather than traced from
 * any artwork, so a T03 is really shorter than a C16 and every model keeps
 * the proportions that make it recognisable.
 *
 * L length · W width · H height · wb wheelbase · fo front overhang
 * belt beltline height · nose bonnet-front height · cowl windscreen-base
 * height · hood bonnet length · ws windscreen run · x2 where the rear window
 * starts (from the back) · drop how far the roof falls towards the back ·
 * r tyre radius · spoil roof spoiler.
 */
export interface CarSpec {
  name: string
  L: number; W: number; H: number; wb: number; fo: number
  belt: number; nose: number; cowl: number; hood: number; ws: number
  x2: number; drop: number; r: number; spoil: boolean
}

export const CAR_MODELS = {
  b10: { name: 'B10', L: 4515, W: 1885, H: 1670, wb: 2735, fo: 860, belt: 1040, nose: 800, cowl: 1010, hood: 1050, ws: 650, x2: 760, drop: 110, r: 350, spoil: true },
  c10: { name: 'C10', L: 4739, W: 1900, H: 1680, wb: 2825, fo: 890, belt: 1050, nose: 810, cowl: 1020, hood: 1100, ws: 680, x2: 800, drop: 120, r: 355, spoil: true },
  c11: { name: 'C11', L: 4750, W: 1905, H: 1675, wb: 2930, fo: 900, belt: 1055, nose: 810, cowl: 1025, hood: 1150, ws: 700, x2: 760, drop: 100, r: 355, spoil: true },
  c16: { name: 'C16', L: 4900, W: 1980, H: 1760, wb: 2930, fo: 980, belt: 1120, nose: 880, cowl: 1090, hood: 1200, ws: 720, x2: 560, drop: 40, r: 370, spoil: false },
  b05: { name: 'B05', L: 4430, W: 1810, H: 1520, wb: 2735, fo: 860, belt: 980, nose: 720, cowl: 930, hood: 1100, ws: 760, x2: 1100, drop: 170, r: 330, spoil: true },
  t03: { name: 'T03', L: 3620, W: 1652, H: 1577, wb: 2400, fo: 620, belt: 1000, nose: 740, cowl: 940, hood: 760, ws: 620, x2: 420, drop: 30, r: 285, spoil: false },
} as const satisfies Record<string, CarSpec>

export type CarModel = keyof typeof CAR_MODELS

export const DEFAULT_MODEL: CarModel = 'b10'

/**
 * The model to draw: the one in the configuration, else one named in the
 * card's name ("Leapmotor C10"), else the B10. Mate does not tell Home
 * Assistant which model the car is (its device model is always "Vehicle"),
 * so this cannot be detected from the entities.
 */
export function pickModel(model?: string, name?: string): CarModel {
  const wanted = String(model ?? '').toLowerCase()
  if (wanted in CAR_MODELS) return wanted as CarModel
  const found = /\b(b10|c10|c11|c16|b05|t03)\b/i.exec(name ?? '')
  return found ? (found[1]!.toLowerCase() as CarModel) : DEFAULT_MODEL
}

/** A body colour is only used if it is a plain CSS colour: it ends up inside an SVG attribute. */
export function safeColor(color?: string): string | undefined {
  return color && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(color.trim()) ? color.trim() : undefined
}

const f = (n: number) => Number(n.toFixed(1))

/**
 * The car seen from the side, front to the right, in a 320 x 120 box with the
 * ground at y = 108. Drawn with `currentColor` so it follows the theme in
 * light and dark; `color` tints the body.
 */
export function carSideSvg(model: CarModel, color?: string): string {
  const s: CarSpec = CAR_MODELS[model]
  const k = 0.058
  const G = 108
  const x0 = (320 - s.L * k) / 2
  const X = (mm: number) => f(x0 + mm * k)
  const Y = (h: number) => f(G - h * k)
  const P = (mm: number, h: number) => `${X(mm)} ${Y(h)}`
  const xCowl = s.L - s.hood
  const xRoof = xCowl - s.ws
  const wF = s.L - s.fo
  const wR = s.L - s.fo - s.wb
  const H = s.H
  const belt = s.belt
  const xA = (h: number) => xCowl - ((h - s.cowl) / (H - s.cowl)) * s.ws
  const hT = H - s.drop
  const hG = H - 85
  const xB = (xRoof + s.x2) / 2 + 60
  const xFD = wF - 430
  const xRD = wR + 420
  const fill = color ?? 'currentColor'

  const body = `M${P(0, 330)} L${P(0, 760)} C${P(s.x2 * 0.02, 760 + (hT - 760) * 0.55)} ${P(s.x2 * 0.55, hT)} ${P(s.x2, hT)}
    C${P(s.x2 + (xRoof - s.x2) * 0.35, hT + s.drop * 0.15)} ${P(xRoof - (xRoof - s.x2) * 0.3, H)} ${P(xRoof, H)}
    C${P(xRoof + s.ws * 0.2, H)} ${P(xRoof + s.ws * 0.55, H - (H - s.cowl) * 0.42)} ${P(xCowl - 10, s.cowl + 6)}
    Q${P(xCowl + 20, s.cowl)} ${P(xCowl + 120, s.cowl - 20)}
    C${P(xCowl + 350, s.cowl - 60)} ${P(s.L - 380, s.nose + 85)} ${P(s.L - 110, s.nose + 38)}
    C${P(s.L - 25, s.nose + 12)} ${P(s.L, s.nose - 50)} ${P(s.L, s.nose - 190)}
    L${P(s.L, 330)} C${P(s.L, 270)} ${P(s.L - 40, 245)} ${P(s.L - 120, 245)}
    L${P(110, 245)} C${P(35, 245)} ${P(0, 270)} ${P(0, 330)} Z`

  const gx0 = xA(belt) - 95
  const gx1 = xA(hG) - 95
  const gr = s.x2 + 170
  const cLow = s.x2 * 0.5 + 120
  const glass = `M${P(gx0, belt)} L${P(gx1, hG)} L${P(gr, hG - s.drop * 0.7)} Q${P(cLow + (gr - cLow) * 0.45, hG - s.drop * 0.7 - 120)} ${P(cLow, belt)} Z`

  const handle = (xm: number) =>
    `<rect x="${X(xm)}" y="${Y(belt - 95)}" width="${f(190 * k)}" height="2.2" rx="1.1" fill="currentColor" opacity=".55"/>`
  const cut = (xm: number) => `<line x1="${X(xm)}" y1="${Y(belt - 15)}" x2="${X(xm)}" y2="${Y(300)}"/>`

  const wheel = (xw: number) => {
    const cx = X(xw)
    const cy = Y(s.r)
    const rt = s.r * k
    const ra = (s.r + 55) * k
    const ya = Y(245)
    const hc = Math.sqrt(Math.max(ra * ra - (ya - cy) * (ya - cy), 1))
    const spokes = [0, 1, 2, 3, 4].map(i => {
      const a = ((i * 72 - 90) * Math.PI) / 180
      return `<line x1="${f(cx + Math.cos(a) * rt * 0.2)}" y1="${f(cy + Math.sin(a) * rt * 0.2)}" x2="${f(cx + Math.cos(a) * rt * 0.62)}" y2="${f(cy + Math.sin(a) * rt * 0.62)}"/>`
    }).join('')
    return `<path d="M${f(cx - hc)} ${ya} A${f(ra)} ${f(ra)} 0 1 1 ${f(cx + hc)} ${ya} Z" fill="currentColor" opacity=".55"/>
      <circle cx="${cx}" cy="${cy}" r="${f(rt)}" fill="currentColor" fill-opacity=".85" stroke="currentColor" stroke-opacity=".5" stroke-width="1.4"/>
      <circle cx="${cx}" cy="${cy}" r="${f(rt * 0.64)}" fill="var(--card-background-color, #fff)" fill-opacity=".35" stroke="var(--card-background-color, #fff)" stroke-opacity=".7" stroke-width="1"/>
      <g stroke="var(--card-background-color, #fff)" stroke-opacity=".8" stroke-width="1.6" stroke-linecap="round">${spokes}</g>
      <circle cx="${cx}" cy="${cy}" r="${f(rt * 0.13)}" fill="var(--card-background-color, #fff)"/>`
  }

  const spoiler = s.spoil
    ? `<path d="M${P(s.x2 + 170, hT + 8)} L${P(s.x2 - 90, hT - 10)} L${P(s.x2 - 135, hT - 70)} L${P(s.x2 + 120, hT - 40)} Z" fill="currentColor" fill-opacity=".3" stroke="currentColor" stroke-opacity=".5" stroke-width=".8" stroke-linejoin="round"/>`
    : ''

  return `<svg viewBox="0 0 320 120" role="img" aria-hidden="true" part="silhouette">
    <ellipse cx="${X(s.L / 2)}" cy="${G + 1}" rx="${f(s.L * k * 0.5)}" ry="3.2" fill="currentColor" opacity=".12"/>
    <path d="${body}" fill="${fill}" fill-opacity="${color ? '.55' : '.12'}" stroke="currentColor" stroke-opacity=".55" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M${P(wR + 330, 330)} L${P(wF - 330, 330)}" stroke="currentColor" stroke-opacity=".3" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M${P(wR + 300, belt - 330)} C${P(wR + 1100, belt - 280)} ${P(wF - 1200, belt - 300)} ${P(wF - 360, belt - 380)}" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="1"/>
    <path d="${glass}" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-opacity=".4" stroke-width="1"/>
    <path d="M${P(xB, belt)} L${P(xB + 30, hG - s.drop * 0.3)}" stroke="currentColor" stroke-opacity=".8" stroke-width="2.6"/>
    <g stroke="currentColor" stroke-opacity=".28" stroke-width=".9" fill="none">${cut(xB)}${cut(xFD)}${cut(xRD)}</g>
    ${handle(xB + 90)}${handle(xRD + 80)}
    ${spoiler}
    <path d="M${X(xA(belt) - 30)} ${Y(belt - 15)} l-6 0 q-3 0 -3 3 l0 2.5 q0 2 3 2 l7 0 z" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-opacity=".5" stroke-width=".7"/>
    ${wheel(wR)}${wheel(wF)}
    <path d="M${P(s.L - 40, s.nose - 30)} L${P(s.L - 330, s.nose + 55)}" stroke="var(--primary-color, #03a9f4)" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M${P(s.L, s.nose - 150)} L${P(s.L - 8, s.nose - 90)}" stroke="#f5b942" stroke-width="3" stroke-linecap="round"/>
    <path d="M${P(6, 640)} C${P(10, 760)} ${P(60, 900)} ${P(95, 1010)}" stroke="#ef5350" stroke-width="2.8" stroke-linecap="round" fill="none"/>
  </svg>`
}

export function carSilhouette(model: CarModel, color?: string): TemplateResult {
  return html`${unsafeHTML(carSideSvg(model, safeColor(color)))}`
}

/**
 * The car seen from above, nose up, in the 200 x 320 box the tyre grid is
 * laid over: the four wheels stay where `tires.ts` expects them (front axle
 * at y 58, rear at y 232) and the body, the glass and the roof take their
 * width and proportions from the model.
 */
export function carTopSvg(model: CarModel): string {
  const s: CarSpec = CAR_MODELS[model]
  const cx = 100
  const hw = f(Math.min(1.06, Math.max(0.88, s.W / 1885)) * 66)
  const yAt = (mmFromRear: number) => f(300 - (mmFromRear / s.L) * 286)
  const xCowl = s.L - s.hood
  const xRoof = xCowl - s.ws
  const yWsF = yAt(xCowl)
  const yRoofF = yAt(xRoof)
  const yRoofR = yAt(s.x2)
  const yRearGlass = yAt(s.x2 * 0.45)
  const l = f(cx - hw)
  const r = f(cx + hw)
  const gw = f(hw * 0.66)
  const rw = f(hw * 0.58)
  const body = `M${cx} 14 C${f(cx + hw * 0.48)} 14 ${f(cx + hw * 0.94)} 30 ${r} 62 L${f(r + 0)} 214 C${r} 274 ${f(cx + hw * 0.45)} 300 ${cx} 300 C${f(cx - hw * 0.45)} 300 ${l} 274 ${l} 214 L${l} 62 C${f(cx - hw * 0.94)} 30 ${f(cx - hw * 0.48)} 14 ${cx} 14 Z`
  const tyre = (x: number, y: number) => `<rect x="${x}" y="${y}" width="14" height="44" rx="6"/>`
  return `<svg viewBox="0 0 200 320" aria-hidden="true" part="topview">
    <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.32">
      <path d="${body}" />
      <path d="M${f(cx - hw * 0.34)} ${f(yWsF)} L${f(cx + hw * 0.34)} ${f(yWsF)} L${f(cx + gw)} ${f(yRoofF)} L${f(cx - gw)} ${f(yRoofF)} Z" />
      <path d="M${f(cx - gw)} ${f(yRoofR)} L${f(cx + gw)} ${f(yRoofR)} L${f(cx + rw * 0.7)} ${f(yRearGlass)} L${f(cx - rw * 0.7)} ${f(yRearGlass)} Z" />
      <path d="M${f(cx - gw)} ${f(yRoofF)} L${f(cx + gw)} ${f(yRoofF)} L${f(cx + gw)} ${f(yRoofR)} L${f(cx - gw)} ${f(yRoofR)} Z" />
      <path d="M${f(cx - hw * 0.5)} 40 L${f(cx - hw * 0.34)} ${f(yWsF)} M${f(cx + hw * 0.5)} 40 L${f(cx + hw * 0.34)} ${f(yWsF)}" opacity=".6" />
      ${tyre(l - 12, 58)}${tyre(r - 2, 58)}${tyre(l - 12, 232)}${tyre(r - 2, 232)}
    </g>
  </svg>`
}

export function carTopview(model: CarModel): TemplateResult {
  return html`${unsafeHTML(carTopSvg(model))}`
}
