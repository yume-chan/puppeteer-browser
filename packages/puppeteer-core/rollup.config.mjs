/**
 * @license
 * Copyright 2024 Google Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import {nodeResolve} from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import {defineConfig} from 'rolldown';
import {dts} from 'rolldown-plugin-dts';

export default [
  defineConfig({
    input: 'src/puppeteer-core-browser.ts',
    output: {
      dir: 'lib',
      format: 'es',
      sourcemap: true,
    },
    external: id => {
      if (
        id === '@puppeteer/browsers' ||
        id === 'ws' ||
        id === 'tslib' ||
        id.includes('node_modules')
      ) {
        return true;
      }
      return false;
    },
    plugins: [
      nodeResolve({
        browser: true,
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
      }),
      process.env.MINIFY && terser({format: {comments: false}}),
      dts({}),
      // Sonda({gzip: true, brotli: true, sources: true}),
    ],
  }),
];
