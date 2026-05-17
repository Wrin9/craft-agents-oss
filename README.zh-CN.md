<div align="center">

# Cody Agent

**具备认知记忆与跨平台消息能力的 AI 助手**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Latest-v0.1.0-green.svg)](https://github.com/Wrin9/cody-agent/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/Wrin9/cody-agent/releases)

**[English](README.md)** | **中文**

</div>

Cody Agent 是 [Craft Agents](https://github.com/craft-ai-agents/craft-agents-oss) 的 Fork —— 一个基于 Electron、React 和 Claude Agent SDK 构建的开源 AI 桌面助手。本 Fork 在此基础上新增了 **微信集成**、**全局跨工作区消息**、**认知记忆系统** 和 **会话中切换模型** 等功能。

## 与上游项目的差异

| 功能 | 说明 |
|------|------|
| **微信集成** | 完整的 iLink Bot API 集成 —— 扫码连接，通过微信收发消息 |
| **External 工作区** | 为所有外部消息平台（微信、Telegram、飞书、WhatsApp）创建独立工作区，自动置顶 |
| **跨工作区命令** | 在微信中控制所有工作区的会话：`/sessions`、`/switch`、`/new`、`/workspaces` |
| **会话中切换模型** | 随时切换模型和连接 —— 即使会话中已有消息 |
| **认知记忆** | 情景记忆、语义记忆、程序记忆三层架构，实现跨会话的持久化学习 |
| **禁用自动更新** | 无上游更新提示 —— 由你控制何时更新 |

---

## 快速开始

### 下载安装（macOS）

前往 [Releases](https://github.com/Wrin9/cody-agent/releases/latest) 页面下载对应平台的安装包：

| 文件 | 平台 | 大小 |
|------|------|------|
| `Cody-Agent-arm64.dmg` | macOS（Apple Silicon M1/M2/M3/M4） | ~340 MB |
| `Cody-Agent-x64.dmg` | macOS（Intel） | ~345 MB |
| `Cody-Agent-x64.exe` | Windows（x64） | ~259 MB |

#### macOS

```bash
# 安装
open Cody-Agent-arm64.dmg
# 将 Cody Agent 拖入应用程序文件夹

# 首次启动 —— 绕过 Gatekeeper（应用未签名）
# 在应用程序中右键点击 Cody Agent → 打开
```

#### Windows

1. 下载 `Cody-Agent-x64.exe`
2. 运行安装程序（一键安装到用户目录）
3. 从开始菜单或桌面快捷方式启动

> **Linux：** 需从源码构建，见下方「从源码构建」章节。

### 从源码构建

```bash
# 克隆
git clone https://github.com/Wrin9/cody-agent.git
cd cody-agent/craft-agents-oss

# 安装依赖
bun install

# 构建
cd apps/electron
bun run build:preload
bun run build:preload-toolbar
bun run build:interceptor
bun run build:renderer

# 构建主进程（可定义 API Key，或留空）
npx esbuild src/main/index.ts --bundle --platform=node --format=cjs \
  --outfile=dist/main.cjs --external:electron --external:onnxruntime-node \
  --alias:node-fetch=./src/main/shims/node-fetch.cjs \
  --alias:abort-controller=./src/main/shims/abort-controller.cjs

# 运行
npx electron .
```

### 打包 DMG

```bash
cd apps/electron

# 复制 SDK 二进制文件（打包所需）
mkdir -p node_modules/@anthropic-ai/claude-agent-sdk-binary
cp ../../node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/claude \
   node_modules/@anthropic-ai/claude-agent-sdk-binary/claude
cp -r ../../node_modules/@anthropic-ai/claude-agent-sdk node_modules/@anthropic-ai/
mkdir -p node_modules/@vscode && cp -r ../../node_modules/@vscode/ripgrep node_modules/@vscode/

# 构建
bun run build:renderer
npx esbuild src/main/index.ts --bundle --platform=node --format=cjs \
  --outfile=dist/main.cjs --external:electron --external:onnxruntime-node \
  --alias:node-fetch=./src/main/shims/node-fetch.cjs \
  --alias:abort-controller=./src/main/shims/abort-controller.cjs

# 打包（无签名）
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --arm64 -c.mac.identity=null
```

输出：`release/Cody-Agent-arm64.dmg`

---

## 微信集成

Cody Agent 通过腾讯 **iLink Bot API** 集成个人微信 —— 这是微信官方的个人号机器人协议。

### 连接方式

1. 打开 Cody Agent → 设置 → 消息平台
2. 点击 **连接微信**
3. 用微信扫描二维码
4. 开始聊天 —— 消息自动路由到 AI 会话

### 架构

```
微信客户端 ←→ iLink Bot API（长轮询）←→ Cody Agent
                                              ↓
                                        AI 会话（Claude/Pi）
```

- **无需 Webhook** —— 使用类似 Telegram 的长轮询方式
- **零配置自动绑定** —— 首条消息自动创建会话
- **External 工作区** —— 所有微信会话位于独立工作区中

### 微信聊天命令

| 命令 | 说明 |
|------|------|
| `/sessions` | 列出所有工作区的会话 |
| `/switch <id>` | 切换到指定会话 |
| `/<序号>` | 按序号快速切换会话 |
| `/new` | 创建新会话 |
| `/workspaces` | 列出可用工作区 |
| `/ws <名称>` | 切换到指定工作区 |
| `/status` | 显示当前会话和工作区状态 |
| `/thinking` | 显示实时进度（思考过程） |
| `/quiet` | 仅发送最终回复（默认） |
| `/help` | 显示所有命令 |

---

## 功能特性（继承自上游）

### 数据源 —— 连接一切

告诉 Agent 连接一个服务，它会自动完成剩余工作：

- **MCP 服务器** —— Stdio 或远程，粘贴配置 JSON 即可
- **REST API** —— 粘贴 OpenAPI 规范、文档截图或端点 URL
- **内置数据源** —— Gmail、Google Calendar、Drive、Slack、Linear、GitHub、Outlook...
- **自定义 API** —— 哪怕是跳板机后面的 Postgres 也没问题

### 会话管理

- 多个并发会话，各自独立的模型/连接/记忆
- **会话中切换模型** —— 随时更换模型，不限于空会话
- 跨会话搜索与组织
- 通过深度链接分享会话

### 权限模式

| 模式 | 说明 |
|------|------|
| **Explore（探索）** | 只读 —— 搜索、阅读、规划，不修改文件 |
| **Ask to Edit（询问后编辑）** | 每次编辑前都会询问确认 |
| **Execute（执行）** | 完全自主执行，无需确认 |

### 认知记忆

- **情景记忆** —— 记住过去的交互和经历
- **语义记忆** —— 存储事实、偏好和知识
- **程序记忆** —— 随时间学习技能和工作流

### 消息平台

| 平台 | 状态 | 说明 |
|------|------|------|
| **微信** | ✅ 已支持 | iLink Bot API，扫码登录 |
| **Telegram** | ✅ 已支持 | 长轮询，Bot Token |
| **飞书** | ✅ 已支持 | 基于 Webhook |
| **WhatsApp** | ✅ 已支持 | 通过专用 Worker |

### 自动化

由标签、状态变更、定时器等触发的事件驱动工作流。在 `automations.json` 中定义：

```json
{
  "automations": [
    {
      "id": "urgent-triage",
      "event": { "type": "LabelAdd", "label": "urgent" },
      "actions": [
        { "type": "prompt", "prompt": "对该会话进行分类并总结需要关注的事项。" }
      ]
    }
  ]
}
```

### 远程服务器（无头模式）

作为无头服务器运行，从桌面应用连接：

```bash
# 启动服务器
npx @anthropic-ai/claude-code-sdk@latest server

# 从桌面应用连接：设置 → 远程服务器
```

---

## 支持的大模型提供商

### 直连

| 提供商 | 模型 |
|--------|------|
| **Anthropic** | Claude Opus 4、Sonnet 4、Haiku 3.5 |
| **Pi** | 通过 SDK 使用 Pi 模型 |

### 第三方与自托管

任何兼容 OpenAI 的 API 端点都可以添加为自定义连接。支持 `pi` 和 `pi_compat` 提供商类型。

---

## 配置

### 环境变量

```bash
# 必填：至少一个大模型 API Key
ANTHROPIC_API_KEY=sk-ant-...

# 可选：内置数据源的 OAuth
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
SLACK_OAUTH_CLIENT_ID=...
SLACK_OAUTH_CLIENT_SECRET=...
MICROSOFT_OAUTH_CLIENT_ID=...

# 可选：错误追踪
SENTRY_ELECTRON_INGEST_URL=...
```

### 工作区配置

工作区存储在 `~/.cody-agent/workspaces/<workspace>/`：

```
workspaces/
  default/
    config.json      # 工作区设置
    sessions/        # 会话数据
    sources/         # 数据源配置
    skills/          # 自定义技能
  external/          # 消息平台工作区（自动创建）
```

### 数据路径

| 数据 | 路径 |
|------|------|
| 配置 | `~/.cody-agent/` |
| 工作区 | `~/.cody-agent/workspaces/` |
| 日志 | `~/.cody-agent/logs/` |
| 凭证 | AES-256-GCM 加密文件存储 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | [Bun](https://bun.sh/) |
| AI | [@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) |
| AI (Pi) | Pi SDK Agent Server |
| 桌面端 | [Electron](https://www.electronjs.org/) 39 + React 19 |
| UI | [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS v4 |
| 构建 | esbuild（主进程）+ Vite（渲染进程） |
| 数据库 | better-sqlite3（本地） |
| 凭证存储 | AES-256-GCM 加密文件存储 |

---

## 项目结构

```
craft-agents-oss/
├── apps/electron/              # Electron 桌面应用
│   ├── src/main/               # 主进程（Node.js）
│   ├── src/renderer/           # 渲染进程（React）
│   ├── src/shared/             # 共享类型
│   └── resources/              # 应用资源与文档
├── packages/
│   ├── core/                   # 核心 Agent 逻辑
│   ├── server-core/            # 服务端处理器（RPC、会话）
│   ├── messaging-gateway/      # 消息平台适配器
│   │   └── src/adapters/
│   │       ├── wechat/         # 微信（iLink Bot API）
│   │       ├── telegram/       # Telegram Bot API
│   │       ├── lark/           # 飞书
│   │       └── whatsapp/       # WhatsApp
│   ├── shared/                 # 共享工具、配置、国际化
│   ├── ui/                     # 共享 UI 组件
│   └── session-tools-core/     # 会话工具定义
└── skills/                     # 自定义技能目录
```

---

## 开发

### 前置要求

- [Bun](https://bun.sh/) >= 1.0
- Node.js >= 20（用于原生模块编译）
- Xcode Command Line Tools（macOS）

### 初始化

```bash
git clone https://github.com/Wrin9/cody-agent.git
cd cody-agent/craft-agents-oss
bun install
```

### 开发工作流

```bash
# 终端 1：监听主进程
cd apps/electron
npx esbuild src/main/index.ts --bundle --platform=node --format=cjs \
  --outfile=dist/main.cjs --external:electron --external:onnxruntime-node \
  --alias:node-fetch=./src/main/shims/node-fetch.cjs \
  --alias:abort-controller=./src/main/shims/abort-controller.cjs \
  --watch

# 终端 2：监听渲染进程
cd apps/electron
npx vite dev

# 终端 3：运行应用
cd apps/electron
npx electron .
```

### 运行测试

```bash
# 单元测试
bun test

# 指定包
cd packages/messaging-gateway && bun test
```

---

## 故障排查

### 调试模式

```bash
# macOS
/Applications/Cody\ Agent.app/Contents/MacOS/Cody\ Agent -- --debug
```

日志路径：`~/.cody-agent/logs/messaging-gateway.log`

### 常见问题

**应用无法打开（macOS 提示"已损坏"）**
```bash
xattr -cr /Applications/Cody\ Agent.app
```

**微信连接丢失**
- iLink `bot_token` 是基于会话的 —— 重新在 设置 → 消息平台 中扫码即可

---

## 致谢与参考

本项目基于以下开源项目和服务构建：

### 核心 —— Fork 来源

| 项目 | 用途 | 开源协议 |
|------|------|----------|
| [**Craft Agents**](https://github.com/craft-ai-agents/craft-agents-oss) by [Craft Docs](https://craft.do) | **上游项目** —— 整个应用架构、UI、会话管理、数据源/技能系统及所有原始功能 | Apache 2.0 |

### AI SDK

| 项目 | 用途 | 开源协议 |
|------|------|----------|
| [**Claude Agent SDK**](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) by [Anthropic](https://anthropic.com) | 核心 AI Agent 运行时 —— 工具执行、对话循环、流式输出 | Anthropic 商业条款 |
| [**Pi SDK**](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) | Pi 模型的替代 AI 运行时 | — |

### 微信集成（本 Fork 新增）

| 项目 | 用途 | 链接 |
|------|------|------|
| [**iLink Bot API**](https://ilinkai.weixin.qq.com) by 腾讯 | 微信个人号机器人协议 —— 二维码登录、消息轮询、消息发送 | 官方 API 文档 |
| Telegram 适配器模式 | 微信适配器架构参考了上游现有的 [Telegram 适配器](https://github.com/craft-ai-agents/craft-agents-oss/tree/main/packages/messaging-gateway/src/adapters/telegram)（基于 grammY） | [grammY](https://grammy.dev/) |

### 桌面端与 UI

| 项目 | 用途 | 开源协议 |
|------|------|----------|
| [**Electron**](https://www.electronjs.org/) | 跨平台桌面运行时 | MIT |
| [**React**](https://react.dev/) | UI 框架 | MIT |
| [**shadcn/ui**](https://ui.shadcn.com/) + [Radix](https://www.radix-ui.com/) | UI 组件库 | MIT |
| [**Tailwind CSS v4**](https://tailwindcss.com/) | 样式框架 | MIT |
| [**Vite**](https://vitejs.dev/) | 渲染进程构建工具 | MIT |
| [**esbuild**](https://esbuild.github.io/) | 主进程打包器 | MIT |
| [**electron-builder**](https://www.electron.build/) | 应用打包与分发 | MIT |
| [**Jotai**](https://jotai.org/) | React 状态管理 | MIT |

### 消息平台适配器（继承自上游）

| 平台 | 库 | 开源协议 |
|------|-----|----------|
| Telegram | [grammY](https://grammy.dev/) | MIT |
| 飞书 | HTTP Webhook API | — |
| WhatsApp | 专用 Worker | — |

### 其他依赖

| 项目 | 用途 | 开源协议 |
|------|------|----------|
| [**Bun**](https://bun.sh/) | JavaScript 运行时与包管理器 | MIT |
| [**better-sqlite3**](https://github.com/WiseLibs/better-sqlite3) | 本地数据库 | MIT |
| [**@vscode/ripgrep**](https://github.com/microsoft/vscode-ripgrep) | 高速文件搜索 | MIT |
| [**i18next**](https://www.i18next.com/) | 国际化 | MIT |
| [**react-i18next**](https://react.i18next.com/) | React 国际化绑定 | MIT |
| [**TipTap**](https://tiptap.dev/) | 富文本编辑器 | MIT |
| [**Sentry**](https://sentry.io/) | 错误追踪 | MIT (SDK) |
| [**Lucide**](https://lucide.dev/) | 图标库 | ISC |
| [**sonner**](https://sonner.emilkowal.dev/) | Toast 通知 | MIT |

---

## 许可证

Apache License 2.0 —— 详见 [LICENSE](LICENSE)。

本项目使用 Claude Agent SDK，受 [Anthropic 商业条款](https://www.anthropic.com/legal/commercial-terms) 约束。

"Craft" 和 "Craft Agents" 是 Craft Docs Ltd. 的商标。详见 [TRADEMARK.md](TRADEMARK.md)。
