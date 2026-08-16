.PHONY: help install dev build dmg clean

help:
	@echo "Targets:"
	@echo "  make install  - install npm dependencies"
	@echo "  make dev      - run the Tauri app in development"
	@echo "  make build    - build the frontend"
	@echo "  make dmg      - build the macOS DMG app bundle"
	@echo "  make clean    - remove build artifacts"

install:
	npm install

dev:
	npm run tauri dev

build:
	npm run build

dmg:
	npm run tauri build -- --bundles dmg

clean:
	rm -rf dist src-tauri/target
