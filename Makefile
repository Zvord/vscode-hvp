# See README.md "Packaging (.vsix)" for the manual steps this wraps. The
# `package` target also polyfills the global `File` class that @vscode/vsce's
# undici dependency expects but that only exists natively on Node 20+ — a
# no-op guard on Node 20+, required on this machine's Node 18.
VSCE_VERSION := 2.15.0

.DEFAULT_GOAL := package

.PHONY: compile package clean

compile:
	npm run compile

package: compile
	tmp_dir=$$(mktemp -d) && \
	trap 'rm -rf "$$tmp_dir"' EXIT && \
	echo "if (typeof globalThis.File === 'undefined') { globalThis.File = require('node:buffer').File; }" > "$$tmp_dir/polyfill.cjs" && \
	NODE_OPTIONS="--require $$tmp_dir/polyfill.cjs" npx --yes @vscode/vsce@$(VSCE_VERSION) package

clean:
	rm -rf out *.vsix
