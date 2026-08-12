import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // `hvp.server.path`, if set, points at a local `hvp-language-server` checkout's
  // launcher script (e.g. during development against an unreleased server build).
  // Otherwise use the self-contained server bundle esbuild.js produces at
  // build time (out/server.js, bundled from the `hvp-language-server` npm
  // dependency's bin entry) — this is what ships in the packaged .vsix, since
  // .vscodeignore excludes node_modules.
  //
  // NOTE: `hvp-language-server` is currently a `file:../hvp-language-server` path
  // dependency in package.json because it hasn't been published to npm yet (see
  // MIGRATION.md). Once `npm publish` happens for real, swap that dependency to
  // `"^0.1.0"` — nothing here needs to change either way, since esbuild.js
  // resolves it the same way regardless of where npm fetched it from.
  const configuredPath = vscode.workspace.getConfiguration('hvp').get<string>('server.path', '').trim();
  const serverModule = configuredPath ? path.resolve(configuredPath) : context.asAbsolutePath(path.join('out', 'server.js'));

  // TransportKind.stdio: the server (`createConnection(ProposedFeatures.all)` in
  // hvp-language-server/src/server.ts) parses `process.argv` itself and picks stdio
  // when it sees a `--stdio` flag — which is exactly what vscode-languageclient
  // appends when forking a `NodeModule`-style ServerOptions with this transport.
  const serverOptions: ServerOptions = {
    module: serverModule,
    transport: TransportKind.stdio,
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'hvp' }],
  };

  // Explicit id 'hvp' (rather than the 2-arg constructor form) so vscode-languageclient
  // reads trace verbosity from the `hvp.trace.server` setting declared in package.json.
  client = new LanguageClient('hvp', 'HVP Language Server', serverOptions, clientOptions);
  void client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
