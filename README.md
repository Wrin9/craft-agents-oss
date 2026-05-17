<div align="center">

# Cody Agent

**AI Assistant with Cognitive Memory & Cross-Platform Messaging**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Latest-v0.1.0-green.svg)](https://github.com/Wrin9/cody-agent/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/Wrin9/cody-agent/releases)

</div>

Cody Agent is a fork of [Craft Agents](https://github.com/craft-ai-agents/craft-agents-oss) — an open-source AI desktop assistant built with Electron, React, and the Claude Agent SDK. This fork extends it with **WeChat integration**, **global cross-workspace messaging**, **cognitive memory**, and **mid-session model switching**.

## What's Different from Upstream

| Feature | Description |
|---------|-------------|
| **WeChat Integration** | Full iLink Bot API integration — scan QR to connect, receive/send messages via WeChat |
| **External Workspace** | Dedicated workspace for all external messaging platforms (WeChat, Telegram, Lark, WhatsApp), auto-created and pinned to top |
| **Cross-Workspace Commands** | Control sessions across all workspaces from WeChat: `/sessions`, `/switch`, `/new`, `/workspaces` |
| **Mid-Session Model Switching** | Switch models and connections at any time — even in sessions with existing messages |
| **Cognitive Memory** | Episodic, semantic, and procedural memory layers for persistent learning across sessions |
| **Disabled Auto-Update** | No upstream update prompts — you control when to update |

---

## Quick Start

### Download (macOS)

Go to the [Releases](https://github.com/Wrin9/cody-agent/releases/latest) page and download `Cody-Agent-arm64.dmg` (Apple Silicon) or `Cody-Agent-x64.dmg` (Intel).

```bash
# Install
open Cody-Agent-arm64.dmg
# Drag Cody Agent to Applications

# First launch — bypass Gatekeeper (app is unsigned)
# Right-click Cody Agent in Applications → Open
```

### Build from Source

```bash
# Clone
git clone https://github.com/Wrin9/cody-agent.git
cd cody-agent/craft-agents-oss

# Install dependencies
bun install

# Build
cd apps/electron
bun run build:preload
bun run build:preload-toolbar
bun run build:interceptor
bun run build:renderer

# Build main process (define your API keys or leave empty)
npx esbuild src/main/index.ts --bundle --platform=node --format=cjs \
  --outfile=dist/main.cjs --external:electron --external:onnxruntime-node \
  --alias:node-fetch=./src/main/shims/node-fetch.cjs \
  --alias:abort-controller=./src/main/shims/abort-controller.cjs

# Run
npx electron .
```

### Package DMG

```bash
cd apps/electron

# Copy SDK binary (required for packaging)
mkdir -p node_modules/@anthropic-ai/claude-agent-sdk-binary
cp ../../node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/claude \
   node_modules/@anthropic-ai/claude-agent-sdk-binary/claude
cp -r ../../node_modules/@anthropic-ai/claude-agent-sdk node_modules/@anthropic-ai/
mkdir -p node_modules/@vscode && cp -r ../../node_modules/@vscode/ripgrep node_modules/@vscode/

# Build
bun run build:renderer
npx esbuild src/main/index.ts --bundle --platform=node --format=cjs \
  --outfile=dist/main.cjs --external:electron --external:onnxruntime-node \
  --alias:node-fetch=./src/main/shims/node-fetch.cjs \
  --alias:abort-controller=./src/main/shims/abort-controller.cjs

# Package (unsigned)
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --arm64 -c.mac.identity=null
```

Output: `release/Cody-Agent-arm64.dmg`

---

## WeChat Integration

Cody Agent integrates with personal WeChat via Tencent's **iLink Bot API** — the official protocol for personal WeChat bots.

### Connect

1. Open Cody Agent → Settings → Messaging
2. Click **Connect WeChat**
3. Scan the QR code with your WeChat
4. Start chatting — messages are auto-routed to an AI session

### Architecture

```
WeChat App ←→ iLink Bot API (long-polling) ←→ Cody Agent
                                                    ↓
                                              AI Session (Claude/Pi)
```

- **No webhook required** — uses long-polling like Telegram
- **Zero-config auto-binding** — first message creates a session automatically
- **External Workspace** — all WeChat sessions live in a dedicated workspace

### Commands (in WeChat chat)

| Command | Description |
|---------|-------------|
| `/sessions` | List all sessions across workspaces |
| `/switch <id>` | Switch to a specific session |
| `/<number>` | Quick switch by session index |
| `/new` | Create a new session |
| `/workspaces` | List available workspaces |
| `/ws <name>` | Switch to a workspace |
| `/status` | Show current session and workspace |
| `/thinking` | Show live progress (thinking steps) |
| `/quiet` | Final reply only (default) |
| `/help` | Show all commands |

---

## Features (from Upstream)

### Sources — Connect to Anything

Tell the agent to connect a service and it figures out the rest:

- **MCP Servers** — Stdio or remote, just paste your config JSON
- **REST APIs** — Paste an OpenAPI spec, screenshots of docs, or endpoint URLs
- **Built-in Sources** — Gmail, Google Calendar, Drive, Slack, Linear, GitHub, Outlook...
- **Custom APIs** — Postgres behind a jumpbox? No problem

### Session Management

- Multiple concurrent sessions with independent model/connection/memory
- **Mid-session model switching** — change models anytime, not just on empty sessions
- Cross-session search and organization
- Share sessions via deep links

### Permission Modes

| Mode | Description |
|------|-------------|
| **Explore** | Read-only — search, read, plan. No file modifications |
| **Ask to Edit** | Prompts before every edit |
| **Execute** | Full autonomous — no prompts |

### Cognitive Memory

- **Episodic** — Remembers past interactions and experiences
- **Semantic** — Stores facts, preferences, and knowledge
- **Procedural** — Learns skills and workflows over time

### Messaging Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| **WeChat** | ✅ Supported | iLink Bot API, QR scan login |
| **Telegram** | ✅ Supported | Long-polling, bot token |
| **Lark** | ✅ Supported | Webhook-based |
| **WhatsApp** | ✅ Supported | Via dedicated worker |

### Automations

Event-driven workflows triggered by labels, status changes, schedules, and more. Define in `automations.json`:

```json
{
  "automations": [
    {
      "id": "urgent-triage",
      "event": { "type": "LabelAdd", "label": "urgent" },
      "actions": [
        { "type": "prompt", "prompt": "Triage the session and summarise what needs attention." }
      ]
    }
  ]
}
```

### Remote Server (Headless)

Run as a headless server and connect from the desktop app:

```bash
# Start server
npx @anthropic-ai/claude-code-sdk@latest server

# Connect from desktop app via Settings → Remote Server
```

---

## Supported LLM Providers

### Direct Connections

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude Opus 4, Sonnet 4, Haiku 3.5 |
| **Pi** | Pi models via SDK |

### Third-Party & Self-Hosted

Any OpenAI-compatible API endpoint can be added as a custom connection. Supports `pi` and `pi_compat` provider types.

---

## Configuration

### Environment Variables

```bash
# Required: At least one LLM API key
ANTHROPIC_API_KEY=sk-ant-...

# Optional: OAuth for built-in sources
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
SLACK_OAUTH_CLIENT_ID=...
SLACK_OAUTH_CLIENT_SECRET=...
MICROSOFT_OAUTH_CLIENT_ID=...

# Optional: Error tracking
SENTRY_ELECTRON_INGEST_URL=...
```

### Workspace Config

Workspaces are stored in `~/.cody-agent/workspaces/<workspace>/`:

```
workspaces/
  default/
    config.json      # Workspace settings
    sessions/        # Session data
    sources/         # Source configurations
    skills/          # Custom skills
  external/          # Messaging platform workspace (auto-created)
```

### Data Locations

| Data | Path |
|------|------|
| Config | `~/.cody-agent/` |
| Workspaces | `~/.cody-agent/workspaces/` |
| Logs | `~/.cody-agent/logs/` |
| Credentials | AES-256-GCM encrypted file storage |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh/) |
| AI | [@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) |
| AI (Pi) | Pi SDK agent server |
| Desktop | [Electron](https://www.electronjs.org/) 39 + React 19 |
| UI | [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS v4 |
| Build | esbuild (main) + Vite (renderer) |
| Database | better-sqlite3 (local) |
| Credentials | AES-256-GCM encrypted file storage |

---

## Project Structure

```
craft-agents-oss/
├── apps/electron/              # Electron desktop app
│   ├── src/main/               # Main process (Node.js)
│   ├── src/renderer/           # Renderer process (React)
│   ├── src/shared/             # Shared types
│   └── resources/              # App resources & docs
├── packages/
│   ├── core/                   # Core agent logic
│   ├── server-core/            # Server handlers (RPC, sessions)
│   ├── messaging-gateway/      # Messaging platform adapters
│   │   └── src/adapters/
│   │       ├── wechat/         # WeChat (iLink Bot API)
│   │       ├── telegram/       # Telegram Bot API
│   │       ├── lark/           # Lark/Feishu
│   │       └── whatsapp/       # WhatsApp
│   ├── shared/                 # Shared utilities, config, i18n
│   ├── ui/                     # Shared UI components
│   └── session-tools-core/     # Session tool definitions
└── skills/                     # Custom skills directory
```

---

## Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- Node.js >= 20 (for native module compilation)
- Xcode Command Line Tools (macOS)

### Setup

```bash
git clone https://github.com/Wrin9/cody-agent.git
cd cody-agent/craft-agents-oss
bun install
```

### Development Workflow

```bash
# Terminal 1: Watch main process
cd apps/electron
npx esbuild src/main/index.ts --bundle --platform=node --format=cjs \
  --outfile=dist/main.cjs --external:electron --external:onnxruntime-node \
  --alias:node-fetch=./src/main/shims/node-fetch.cjs \
  --alias:abort-controller=./src/main/shims/abort-controller.cjs \
  --watch

# Terminal 2: Watch renderer
cd apps/electron
npx vite dev

# Terminal 3: Run app
cd apps/electron
npx electron .
```

### Running Tests

```bash
# Unit tests
bun test

# Specific package
cd packages/messaging-gateway && bun test
```

---

## Troubleshooting

### Debug Mode

```bash
# macOS
/Applications/Cody\ Agent.app/Contents/MacOS/Cody\ Agent -- --debug
```

Logs: `~/.cody-agent/logs/messaging-gateway.log`

### Common Issues

**App won't open (macOS "damaged" message)**
```bash
xattr -cr /Applications/Cody\ Agent.app
```

**WeChat connection lost**
- iLink `bot_token` is session-based — re-scan QR in Settings → Messaging

---

## Acknowledgments

- [Craft Agents](https://github.com/craft-ai-agents/craft-agents-oss) — The upstream project by [Craft Docs](https://craft.do)
- [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) — Anthropic's agent SDK
- [Electron](https://www.electronjs.org/) — Cross-platform desktop framework

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

This project uses the Claude Agent SDK, subject to [Anthropic's Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms).
