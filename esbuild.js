// Bundles the client (src/extension.ts) and a self-contained copy of
// hvp-language-server into out/, so `vsce package` doesn't need to ship
// node_modules in the .vsix (see .vscodeignore, which excludes it). Run
// after `tsc -p ./` (which is kept as the type-checking step — esbuild
// itself does no type checking) via `npm run compile`.
const esbuild = require('esbuild');

const common = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: true,
  external: ['vscode'],
};

Promise.all([
  esbuild.build({
    ...common,
    entryPoints: ['src/extension.ts'],
    outfile: 'out/extension.js',
  }),
  // Bundling from the installed dependency's own bin launcher (rather than
  // e.g. its out/src/server.js directly) keeps this in sync with whatever
  // hvp-language-server itself designates as its entry point.
  esbuild.build({
    ...common,
    entryPoints: [require.resolve('hvp-language-server/bin/hvp-language-server.js')],
    outfile: 'out/server.js',
  }),
]).catch((error) => {
  console.error(error);
  process.exit(1);
});
