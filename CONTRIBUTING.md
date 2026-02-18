# Contributing to Twilio Manager

Thank you for your interest in contributing!

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/)

## Getting Started

```bash
git clone https://github.com/edyrkaj/twilio-manager.git
cd twilio-manager
npm install
```

Copy the example env file and fill in your Twilio credentials:

```bash
cp .env.example .env
```

Start the development server:

```bash
export PATH="$HOME/.cargo/bin:$PATH"
npm run tauri dev
```

## Project Structure

```
src/                  React frontend (TypeScript)
  App.tsx             Main UI — settings, conversations, compose
  App.css             Dark-theme styles

src-tauri/
  src/lib.rs          Tauri commands — Twilio API calls, credential storage
  tauri.conf.json     App config (window size, identifier, bundle)
  Cargo.toml          Rust dependencies
```

## Making Changes

- **Frontend**: edit files in `src/` — Vite hot-reloads automatically.
- **Backend**: edit `src-tauri/src/lib.rs` — Tauri recompiles on save.

## Submitting a Pull Request

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Make your changes and commit with a clear message.
3. Push and open a PR against `main`.
4. A maintainer will review and merge.

## Code Style

- **Rust**: run `cargo fmt` and `cargo clippy` before committing.
- **TypeScript/React**: keep components focused; prefer editing existing files over creating new ones.

## Reporting Issues

Open an issue at <https://github.com/edyrkaj/twilio-manager/issues> with steps to reproduce and your OS / app version.
