# vscode-hvp — developer map

All HVP language logic (diagnostics, completion, outline, folding) lives in the
standalone `hvp-language-server` npm package (`../hvp-language-server`). This repo only
does VS Code-specific packaging: spawn the server, hand it a `documentSelector`, and
ship a generated syntax grammar. For the actual analysis logic — `maskLine()`,
`PAIR_SPECS`, `analyzeBlocks()`, block imbalance detection, completion ranking, the 7
block pairs, etc. — see `../hvp-language-server/CLAUDE.md`, not this file. Full HVP
language spec: `../hvp-documentation/Using the HVP Language.md`.

## Architecture

```
src/extension.ts   ← the entire client: constructs and starts a vscode-languageclient
                      LanguageClient, nothing else
out/extension.js   ← esbuild bundle of the above (+ vscode-languageclient inlined)
out/server.js      ← esbuild bundle of the hvp-language-server npm dependency's bin
                      entry, so the packaged .vsix doesn't need node_modules at runtime
syntaxes/hvp.tmLanguage.json
                    ← GENERATED, checked in as-is from hvp-language-server's grammar
                      generator (see README.md "Syntax grammar")
language-configuration.json
                    ← bracket/comment/auto-indent rules, all client-side, no server
                      involvement
```

`src/extension.ts` builds a `LanguageClient` with:
- `documentSelector: [{ language: 'hvp' }]`
- `ServerOptions = { module: <path to server entry>, transport: TransportKind.stdio }` —
  defaults to the bundled `out/server.js`, overridable via the `hvp.server.path` setting
  for pointing at a local `hvp-language-server` dev checkout instead.
- Explicit client id `'hvp'` (not the 2-arg constructor form), so `vscode-languageclient`
  reads trace verbosity from the `hvp.trace.server` setting this repo declares in
  `package.json`'s `contributes.configuration` (both settings are documented in
  `README.md`).

`TransportKind.stdio` works because `hvp-language-server/src/server.ts` calls
`createConnection(ProposedFeatures.all)` with no explicit input/output streams —
`vscode-languageserver`'s `createConnection()` then parses `process.argv` itself and picks
stdio when it sees a `--stdio` flag, which is exactly what `vscode-languageclient` appends
when forking a `NodeModule`-style `ServerOptions` with this transport kind (see
`node_modules/vscode-languageclient/lib/node/main.js`'s fork logic). Confirmed end-to-end
by spawning `out/server.js` with `--stdio` and driving it through
`initialize`/`didOpen`/`documentSymbol`/`foldingRange`/`completion`/`didClose` with a
hand-rolled JSON-RPC client (mirrors `hvp-language-server/test/serverSmoke.test.ts`'s
approach).

## Dependency: `hvp-language-server`

`package.json`'s `dependencies.hvp-language-server` is currently
`"file:../hvp-language-server"`, **not** `"^0.1.0"`, because `hvp-language-server` has
not been published to npm yet. This means:

- The sibling `hvp-language-server` repo must be checked out next to this one and already
  built (`npm run compile` there) before `npm install` here succeeds.
- Once `hvp-language-server` is published to npm, swap this dependency to `"^0.1.0"` and
  re-run `npm install`. Nothing in `src/extension.ts` or `esbuild.js` needs to change
  either way — both resolve the dependency the same way regardless of where npm fetched
  it from.

## Bundling

`npm run compile` runs `tsc -p ./` (type-checking, does not need to be the source of the
shipped `out/*.js` — its plain per-file output gets overwritten) and then `node esbuild.js`,
which bundles:
- `src/extension.ts` → `out/extension.js` (external: `vscode` only; `vscode-languageclient`
  gets inlined)
- `hvp-language-server`'s bin entry (resolved via `require.resolve`, so it always matches
  whatever's actually installed) → `out/server.js` (fully self-contained — all of
  `vscode-languageserver`/`-textdocument`/`-types` inline too, since none of them are
  native/vscode-dependent)

This is why `.vscodeignore` can exclude `node_modules/**` from the packaged `.vsix` and
still produce a working extension. See `esbuild.js` for the actual build script — it's
short (~30 lines), no config file needed.

## Split from `hvp-language-server`

`src/hvpKeywords.ts`, `src/hvpBlockAnalysis.ts`, `src/hvpCompletionProvider.ts`, and a
`snippets/` directory (+ `package.json`'s `contributes.snippets` block) used to live in
this repo — that logic now lives in `hvp-language-server/src/core/*.ts`, and snippet
bodies are sent by the server as `insertTextFormat: Snippet` completion items instead of
a separate `snippets/hvp.json` file needing hand-sync. If you're looking for
`HvpDocumentSymbolProvider`, `analyzeBlocks`, or `HvpCompletionItemProvider`, they're
`provideDocumentSymbols`/`analyzeBlocks`/`provideCompletionItems` in
`hvp-language-server/src/core/{symbols,blockAnalysis,completion}.ts` now.
