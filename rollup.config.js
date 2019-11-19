const cleanup = require('rollup-plugin-cleanup');
const commonjs = require('rollup-plugin-commonjs');
const license = require('rollup-plugin-license');
const nodeResolve = require('rollup-plugin-node-resolve');
const sourcemaps = require('rollup-plugin-sourcemaps');
const path = require('path');
const { sizeSnapshot } = require('rollup-plugin-size-snapshot');
const { terser } = require('rollup-plugin-terser');

const NAMES = {
  '@robotsnacks/cst-wordpress': 'cst.wordpress',
};

const { NODE_ENV = 'development' } = process.env;
const PRODUCTION = NODE_ENV === 'production';
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const { name } = require(path.resolve(process.cwd(), 'package.json'));

const banner = `
/*!
 * <%= pkg.name %> v<%= pkg.version %>
 * Copyright (c) 2016-present, Robot Snacks, Inc. All Rights Reserved.
 * Not for unlicensed use. Unauthorized copying of this file, via any medium
 * is strictly prohibited. Proprietary and confidential.
 */
`.trim();

const plugins = [
  nodeResolve(),
  commonjs(),
  sourcemaps(),
  cleanup(),

  // For production builds, take a snapshot of the size of the produced bundle.
  PRODUCTION &&
    sizeSnapshot({
      // In CI ensure that the generated snapshot size matches the one that was
      // committed. This helps ensure we don't inadvertently increase the size
      // of a bundle.
      matchSnapshot: !!process.env.CI,

      // Allow a variance of 10 bytes which helps account for minor changes
      // between local and CI builds.
      threshold: 10,
    }),
  PRODUCTION && terser(),
  license({ banner }),
].filter(v => v);

const filename = [
  name.replace('@robotsnacks/', ''),
  PRODUCTION ? 'min.js' : 'development.js',
].join('.');

module.exports = {
  input: path.join(DIST_DIR, 'esm', 'index.js'),
  output: {
    format: 'umd',
    exports: 'named',
    sourcemap: true,
    file: path.join(DIST_DIR, 'umd', filename),
    name: NAMES[name],
  },
  plugins,
};
