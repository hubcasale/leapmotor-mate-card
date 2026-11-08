import { html, type TemplateResult } from 'lit'

/**
 * Generic SUV silhouette, used when there is no image of the vehicle.
 * Original drawing; the repository does not distribute Leapmotor renders.
 */
export const CAR_SILHOUETTE: TemplateResult = html`
  <svg viewBox="0 0 320 120" role="img" aria-hidden="true" part="silhouette">
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.45">
      <path d="M22 84 C22 70 30 64 44 62 L74 44 C84 38 96 35 108 35 L196 35 C214 35 230 41 243 52 L266 62 C282 65 296 70 296 84" />
      <path d="M22 84 L296 84" />
      <path d="M96 40 L110 62 L206 62 L196 40" />
      <path d="M152 40 L152 62" />
      <circle cx="82" cy="86" r="17" />
      <circle cx="238" cy="86" r="17" />
    </g>
  </svg>
`
