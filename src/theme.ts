import { css, type CSSResult } from 'lit'

export function batteryColor(percent: number | undefined): string {
  if (percent === undefined) return 'var(--leapmotor-battery-unknown, var(--disabled-text-color, #9e9e9e))'
  if (percent >= 50) return 'var(--leapmotor-battery-high, #2fbf5c)'
  if (percent >= 20) return 'var(--leapmotor-battery-mid, #f5a623)'
  return 'var(--leapmotor-battery-low, #e5484d)'
}

/**
 * Home Assistant's own colour names, with the value its default theme gives
 * each. The name is what the editor's colour picker writes; the value is only
 * what a page without Home Assistant's variables (the demo, a test) falls
 * back to.
 */
const THEME_COLORS: Record<string, string> = {
  red: '#f44336', pink: '#e91e63', purple: '#926bc7', 'deep-purple': '#6e41ab', indigo: '#3f51b5',
  blue: '#2196f3', 'light-blue': '#03a9f4', cyan: '#00bcd4', teal: '#009688', green: '#4caf50',
  'light-green': '#8bc34a', lime: '#cddc39', yellow: '#ffeb3b', amber: '#ffc107', orange: '#ff9800',
  'deep-orange': '#ff6f22', brown: '#795548', 'light-grey': '#bdbdbd', grey: '#9e9e9e',
  'dark-grey': '#606060', 'blue-grey': '#607d8b', black: '#000000', white: '#ffffff',
}

/**
 * The CSS colour the `color` option stands for, or nothing when the card
 * keeps its plain look. A name from Home Assistant's palette follows the
 * theme; hand-written YAML may also give a colour of its own (`#7e57c2`,
 * `rgb(126, 87, 194)`). Anything else is not a colour and tints nothing —
 * the value ends in a style, so only the shapes of a colour get through.
 */
export function tintColor(color: unknown): string | undefined {
  if (typeof color !== 'string') return undefined
  const c = color.trim().toLowerCase()
  if (!c || c === 'none' || c === 'default') return undefined
  if (c === 'primary' || c === 'accent') return `var(--${c}-color)`
  if (THEME_COLORS[c]) return `var(--${c}-color, ${THEME_COLORS[c]})`
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(c)) return c
  if (/^(rgb|hsl)a?\([0-9\s.,%/]+\)$/.test(c)) return c
  return undefined
}

export const sharedStyles: CSSResult = css`
  :host {
    --lm-gap: 16px;
    --lm-radius: 18px;
    --lm-text: var(--primary-text-color);
    --lm-muted: var(--secondary-text-color);
    --lm-surface: var(--leapmotor-surface, var(--card-background-color));
    /*
     * --lm-tint-chip only exists inside a card with a colour of its own (the
     * color option): there the tiles and the buttons take the theme's card
     * background, so they stand out on the tint the way cards stand out on a
     * coloured dashboard section. A theme's --leapmotor-chip still wins.
     */
    --lm-chip: var(--leapmotor-chip, var(--lm-tint-chip, rgba(127, 127, 127, 0.12)));
    /*
     * Warn and alert with their own name. Before this, the tire pressure
     * warning in tires.ts used --leapmotor-battery-mid: a tire warning
     * borrowing the battery's color. The default values are the same they
     * were, so nothing changes in appearance — only in meaning, and meaning
     * is what a user theme needs to be able to redefine.
     */
    --lm-warn: var(--leapmotor-warn, #f5a623);
    --lm-alert: var(--leapmotor-alert, #e5484d);
    color: var(--lm-text);
    font-family: var(--paper-font-body1_-_font-family, inherit);
  }
  .muted { color: var(--lm-muted); }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px;
    background: var(--lm-chip); font-size: 0.8rem; white-space: nowrap;
  }
  .panel {
    background: var(--lm-chip); border-radius: var(--lm-radius);
    padding: var(--lm-gap); margin-top: var(--lm-gap);
  }
  .row { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--lm-gap); }
  /*
   * WARNING: all: unset resets ALL properties, not just the button look —
   * background, padding, corners, dimensions, position and box-sizing
   * included. This rule sits at (0,1,1), so any single-class rule loses to
   * it. An element with class="plain x" needs a compound selector
   * button.plain.x that RESTORES everything its box requires. This has
   * already produced six defects in this project, two of them visible on a
   * user's dashboard.
   */
  button.plain {
    all: unset; cursor: pointer; display: flex;
    align-items: center; gap: 8px; -webkit-tap-highlight-color: transparent;
  }
  button.plain[disabled] { cursor: not-allowed; opacity: 0.4; }
  /*
   * The all: unset above also wipes the focus outline, and the browser does
   * not restore it on its own: any button in the card was left with no
   * visible mark at all when reached by keyboard. That hurt most on a seat's
   * pill, whose two halves are contiguous with no separator — without a
   * focus ring there was no way to tell which one would fire.
   *
   * Lives here, and not in a section, because all: unset also lives here:
   * the rule has to cover every class="plain …" in the card, not just a
   * panel's. It sits at (0,2,1), so above the button.plain (0,1,1) that
   * wiped it. A section that needs the ring INSIDE its own box — the case of
   * the pill's halves, which live inside a container with
   * overflow: hidden — only has to declare the outline-offset on its own
   * compound selector, which at (0,3,1) beats this one.
   */
  button.plain:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
`
