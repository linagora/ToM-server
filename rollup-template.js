import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'

import terser from '@rollup/plugin-terser'

const plugins = [
  json(),
  typescript(),
  commonjs(),
  terser()
]

function configure (esm, external) {
  return {
    input: 'src/index.ts',
    output: esm
      ? {
          format: 'es',
          dir: 'dist',
          entryFileNames: '[name].js',
          sourcemap: true
        }
      : {
          format: 'cjs',
          dir: 'dist',
          entryFileNames: '[name].cjs',
          sourcemap: true,
          exports: 'auto'
        },
    external,
    plugins,
  }
}
function setExternal (external) {
  return [configure(true, external)] //, configure(false, external)]
}
export default setExternal
