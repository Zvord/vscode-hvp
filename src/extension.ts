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

  context.subscriptions.push(vscode.commands.registerCommand('hvp.copyObjectPath', copyObjectPath));
}

/** What `hvp/objectPathAt` answers — a custom request, not part of the LSP
 * spec, so there is no shared type to import; this mirrors
 * `hvp-language-server/src/core/objectPath.ts`'s `ObjectPathResult`. */
interface ObjectPathResult {
  path: string;
  instances: number;
}

/**
 * "HVP: Copy Object Path" — the dotted hierarchy path (plan, feature path,
 * measure) of whatever the cursor sits in, the same string `${objpath}`
 * expands to there. Breadcrumbs already show this as separate segments,
 * driven by the server's `documentSymbolProvider`; this is the one-string
 * form for pasting into a `-plan`/log/bug-report reference.
 */
async function copyObjectPath(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!client || !editor || editor.document.languageId !== 'hvp') {
    return;
  }
  const params = client.code2ProtocolConverter.asTextDocumentPositionParams(editor.document, editor.selection.active);
  const result = await client.sendRequest<ObjectPathResult | null>('hvp/objectPathAt', params);
  if (!result) {
    void vscode.window.showInformationMessage('HVP: no object path at the cursor.');
    return;
  }
  await vscode.env.clipboard.writeText(result.path);
  // Several instances means no one instance's path is *the* answer; the path
  // copied is still the one written in this file, just not instance-prefixed.
  const note = result.instances > 1
    ? ` (the plan is instantiated ${result.instances} times; copied the path as written)` : '';
  void vscode.window.showInformationMessage(`Copied object path: ${result.path}${note}`);
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
