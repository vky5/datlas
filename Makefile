# `make install` builds datlas and puts a `datlas` command on your PATH.

PREFIX  ?= $(HOME)/.local
APP_DIR := $(PREFIX)/share/datlas
BIN     := $(PREFIX)/bin/datlas
BUNDLE  := .next/standalone

.PHONY: bundle install uninstall

# a self-contained copy of the app in .next/standalone, with local folders turned on
bundle:
	npm install
	DATLAS_BUNDLE=1 NEXT_PUBLIC_DATLAS_LOCAL=1 npx next build
	cp -r public $(BUNDLE)/
	cp -r .next/static $(BUNDLE)/.next/
	rm -rf $(BUNDLE)/.env.local $(BUNDLE)/secrets $(BUNDLE)/.git

install: bundle
	@test -n "$(PREFIX)" && test "$(APP_DIR)" != "/share/datlas"
	rm -rf "$(APP_DIR)"
	mkdir -p "$(APP_DIR)" "$(dir $(BIN))"
	cp -r $(BUNDLE)/. "$(APP_DIR)/"
	@# GitHub login settings stay in this repo; the installed copy only points at them
	@if [ -f .env.local ]; then ln -s "$(CURDIR)/.env.local" "$(APP_DIR)/.env.local"; fi
	@if [ -d secrets ]; then ln -s "$(CURDIR)/secrets" "$(APP_DIR)/secrets"; fi
	install -m 755 scripts/datlas "$(BIN)"
	@echo "installed: $(BIN)  (app in $(APP_DIR))"

uninstall:
	rm -rf "$(APP_DIR)" "$(BIN)"
