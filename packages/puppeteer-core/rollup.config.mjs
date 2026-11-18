/**
 * @license
 * Copyright 2024 Google Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import {nodeResolve} from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import {defineConfig} from 'rollup';
import {dts} from 'rollup-plugin-dts';

const BIDI_CONNECTOR_STUB_ID = '\0bidi-connector-stub';

// Replaces the BiDi connector with a stub so the BiDi implementation
// (and its dynamic imports) are excluded from the browser build.
const stripBiDi = {
  name: 'strip-bidi',
  resolveId(source) {
    if (/(^|\/)bidi\/BrowserConnector\.js$/.test(source)) {
      return BIDI_CONNECTOR_STUB_ID;
    }
    return null;
  },
  load(id) {
    if (id === BIDI_CONNECTOR_STUB_ID) {
      return `export function _connectToBiDiBrowser() {
  throw new Error('WebDriver BiDi is not supported in this build.');
}`;
    }
    return null;
  },
};

export default [
  defineConfig({
    input: 'src/puppeteer-core-browser.ts',
    output: {
      file: 'lib/index.js',
      format: 'es',
      sourcemap: true,
    },
    external: (id, parent) => {
      // console.log(parent, '||', id);
      if (id === 'ws' || id === '@puppeteer/browsers') {
        return true;
      }
      if (id.includes('tslib') || id.includes('node_modules')) {
        return true;
      }
      return false;
    },
    plugins: [
      stripBiDi,
      nodeResolve({
        browser: true,
      }),
      typescript({
        tsconfig: './tsconfig.json',
      }),
      replace({
        preventAssignment: true,
        'typeof process': JSON.stringify('undefined'),
        'typeof Buffer': JSON.stringify('undefined'),
      }),
      terser({format: {comments: false}}),
      // Sonda({gzip: true, brotli: true, sources: true}),
    ],
  }),
  defineConfig({
    input: 'src/puppeteer-core-browser.ts',
    output: {
      file: 'lib/index.d.ts',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [stripBiDi, dts({sourcemap: true})],
  }),
];
