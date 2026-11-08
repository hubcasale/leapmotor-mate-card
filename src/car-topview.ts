import { html, type TemplateResult } from 'lit'

/**
 * The car seen from above, FROM THE OUTSIDE, to serve as the base for the
 * four pressure values. Original drawing, made of rectangles and circles;
 * the repository is GPL v3 and does not distribute — nor trace — Leapmotor
 * artwork.
 *
 * It is NOT `cabin-topview.ts`, and does not replace it. That one is the
 * cabin: it has no bodywork, no nose, no wheels, and the percentage
 * positions of the comfort controls in `climate-panel.ts` resolve against
 * its 200 x 240 box. This one has wheels, which is where a pressure value
 * anchors, and lives in its own box — changing one does not change the
 * other.
 *
 * The box is 200 x 320 (1 : 1.6), the proportion of an SUV seen from above.
 * What is drawn, from top (front) to bottom:
 *   - the bodywork, a rectangle with very rounded corners (x 34 to 166),
 *     with the nose narrower than the rear;
 *   - the windshield and the rear window, two trapezoids;
 *   - the roof between them;
 *   - four wheels, vertical rectangles with rounded corners, two on the
 *     front axle (y 58) and two on the rear one (y 232), sticking out past
 *     the bodywork.
 *
 * The wheels are at the corners because that is where the values meet them:
 * `tires.ts` places each number next to its own, with the grid resolving
 * against this same box. Changing the wheels requires revisiting it.
 */
export const CAR_TOPVIEW: TemplateResult = html`
  <svg viewBox="0 0 200 320" aria-hidden="true" part="topview">
    <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.32">
      <path d="M100 14 C132 14 158 30 162 62 L166 214 C166 274 150 300 100 300 C50 300 34 274 34 214 L38 62 C42 30 68 14 100 14 Z" />

      <path d="M62 96 L138 96 L146 130 L54 130 Z" />
      <path d="M56 226 L144 226 L138 260 L62 260 Z" />
      <path d="M54 130 L146 130 L144 226 L56 226 Z" />

      <rect x="22" y="58" width="14" height="44" rx="6" />
      <rect x="164" y="58" width="14" height="44" rx="6" />
      <rect x="22" y="232" width="14" height="44" rx="6" />
      <rect x="164" y="232" width="14" height="44" rx="6" />
    </g>
  </svg>
`
