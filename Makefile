SHELL := /bin/zsh

.PHONY: extension test

extension:
	@echo "Load chrome-extension/ as an unpacked extension in Chrome"

test:
	cd chrome-extension && npm test
