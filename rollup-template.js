import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import {nodeResolve} from '@rollup/plugin-node-resolve'

import builtins from 'builtins'
import terser from "@rollup/plugin-terser";

const plugins = [
  typescript(),
  commonjs(),
  nodeResolve({
    preferBuiltins: true,
  }),
  terser(),
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
    external: [...builtins(), ...external],
    plugins,
  }
}
function setExternal (external) {
  return [configure(false, external), configure(true, external)]
}
export default setExternal
