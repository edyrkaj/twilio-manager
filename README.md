<p align="center">
  <img src="src-tauri/icons/twilio-manager-logo.png" alt="Twilio Manager logo" width="160" />
</p>

# Twilio Manager

A desktop app for managing Twilio SMS and WhatsApp from your Mac. Connect with your Account SID, Auth Token, and phone numbers, then browse conversations, refresh your inbox, and send new messages — credentials stay local on your machine (`~/.twilio-manager/`).

Built with [Tauri](https://tauri.app/), React, and TypeScript.

## Features

- View SMS conversations grouped by phone number
- View WhatsApp conversations on a dedicated tab
- Send and reply to messages from your Twilio SMS or WhatsApp number
- Store credentials locally (not in the cloud)

## Getting started

```bash
make install
make dev
```

## Build the macOS DMG

```bash
make dmg
```

The installer is written to `src-tauri/target/release/bundle/dmg/`.

## Recommended IDE setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
