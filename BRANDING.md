# Cody Agent — Branding & Identity

This directory contains all branding changes needed to fork Craft Agents OSS
into the independent "Cody Agent" product.

## Changes Required

### 1. Product Identity
- App name: **Cody Agent**
- Bundle ID: `com.cody.agent`
- Protocol: `cody-agent://`
- Data directory: `~/.cody-agent/`
- Server lock: `~/.cody-agent/.server.lock`

### 2. Files Modified
| File | Change |
|------|--------|
| `apps/electron/package.json` | name, productName, appId, protocol |
| `apps/electron/src/main/index.ts` | userData path, protocol handler |
| `apps/electron/src/preload/bootstrap.ts` | API namespace |
| `apps/electron/electron-builder.yml` | app ID, artifact name |
| `packages/server-core/src/config.ts` | config dir override |
| `packages/shared/src/constants.ts` | product name, protocol |

### 3. Key Principle
**Never touch `/Applications/Craft Agents.app`** — Cody Agent is a separate app
that lives in `/Applications/Cody Agent.app` with its own data directory.
