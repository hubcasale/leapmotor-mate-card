/**
 * Importing a file as text (`?raw`) is a Vite feature, which Vitest uses.
 * This is how two tests read the README and `leapmotor-mate-card.ts` without
 * `node:fs`: the project doesn't have `@types/node` and isn't going to get it
 * just for this.
 */
declare module '*?raw' {
  const content: string
  export default content
}
