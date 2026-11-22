import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

// The demo page: the real card plus stubs of Home Assistant's elements, as one
// classic script so demo/index.html opens straight from disk.
export default {
  input: 'demo/demo.ts',
  output: { file: 'demo/demo.js', format: 'iife', inlineDynamicImports: true, sourcemap: false },
  plugins: [resolve(), json(), typescript({ tsconfig: './tsconfig.json', include: ['src/**/*.ts', 'demo/**/*.ts'] })],
}
