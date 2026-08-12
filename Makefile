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
	tmp_polyfill=$$(mktemp --suffix=.cjs) && \
	trap 'rm -f "$$tmp_polyfill"' EXIT && \
	echo "if (typeof globalThis.File === 'undefined') { globalThis.File = require('node:buffer').File; }" > "$$tmp_polyfill" && \
	NODE_OPTIONS="--require $$tmp_polyfill" npx --yes @vscode/vsce@$(VSCE_VERSION) package

clean:
	rm -rf out *.vsix
