/**
 * AddSourceDialog — Manual source creation dialog
 *
 * Two modes:
 * 1. **Form** — step-by-step fields for MCP/API source creation
 * 2. **JSON** — paste MCP server JSON config directly (Claude Desktop / Cursor / raw)
 *
 * JSON mode supports:
 * - Claude Desktop format: `{ "mcpServers": { "name": { "command": "...", "args": [...] } } }`
 * - Cursor format: `{ "mcpServers": { "name": { "command": "...", "args": [...] } } }`
 * - Single server: `{ "command": "...", "args": [...] }` or `{ "url": "..." }`
 * - Full config.json: `{ "name": "...", "slug": "...", "mcp": { ... } }`
 *
 * Supports both workspace-scoped and global sources.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Globe,
  FolderOpen,
  Link,
  Terminal,
  Server,
  Info,
  FileJson,
  ListPlus,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AddSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (config: AddSourceFormData) => Promise<void>
  /** Workspace ID for workspace-scoped sources */
  workspaceId: string
  /** Called when user wants AI-assisted setup */
  onOpenAI?: () => void
}

export interface AddSourceFormData {
  name: string
  slug: string
  type: 'mcp' | 'api'
  scope: 'global' | 'workspace'
  // MCP fields
  mcpTransport?: 'http' | 'stdio'
  mcpUrl?: string
  mcpCommand?: string
  mcpArgs?: string[]
  mcpEnv?: Record<string, string>
  mcpAuthType?: string
  mcpHeaders?: Record<string, string>
  // API fields
  apiBaseUrl?: string
  apiAuthType?: string
  // Credentials (saved via credential store after creation)
  bearerToken?: string
  basicUsername?: string
  basicPassword?: string
  headerName?: string
  headerValue?: string
}

type InputMode = 'json' | 'form' | 'ai'

interface ParsedServer {
  name: string
  slug: string
  transport: 'http' | 'stdio'
  // HTTP
  url?: string
  headers?: Record<string, string>
  // Stdio
  command?: string
  args?: string[]
  env?: Record<string, string>
}

/**
 * Parse various JSON formats into normalized server configs.
 *
 * Supported:
 * 1. Claude Desktop / Cursor: { "mcpServers": { "name": { command/args/env } } }
 * 2. Single server stdio: { "command": "...", "args": [...] }
 * 3. Single server HTTP: { "url": "..." }
 * 4. Cody Agent config.json: { "name": "...", "mcp": { ... } }
 */
function parseJsonServers(jsonStr: string): ParsedServer[] {
  let data: any
  try {
    data = JSON.parse(jsonStr)
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`)
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('JSON must be an object')
  }

  const servers: ParsedServer[] = []

  // Format 1: Claude Desktop / Cursor / Windsurf { "mcpServers": { ... } }
  if (data.mcpServers && typeof data.mcpServers === 'object') {
    for (const [name, config] of Object.entries(data.mcpServers)) {
      const server = parseSingleServerConfig(name, config as Record<string, any>)
      if (server) servers.push(server)
    }
  }
  // Format 4: Cody Agent config.json { "name": "...", "slug": "...", "mcp": { ... } }
  else if (data.mcp && typeof data.mcp === 'object') {
    const mcpConfig = data.mcp as Record<string, any>
    const name = data.name || data.slug || 'imported-source'
    const server = parseSingleServerConfig(name, mcpConfig)
    if (server) servers.push(server)
  }
  // Format 2/3: Single server config { "command": "..." } or { "url": "..." }
  else if (data.command || data.url) {
    const server = parseSingleServerConfig('imported-server', data)
    if (server) servers.push(server)
  }
  else {
    throw new Error(
      'Unrecognized format. Supported:\n' +
      '• Claude Desktop: { "mcpServers": { "name": { ... } } }\n' +
      '• Single server: { "command": "...", "args": [...] }\n' +
      '• HTTP server: { "url": "https://..." }'
    )
  }

  return servers
}

function parseSingleServerConfig(name: string, config: Record<string, any>): ParsedServer | null {
  if (!config || typeof config !== 'object') return null

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || 'imported'

  // HTTP/SSE server
  if (config.url) {
    return {
      name,
      slug,
      transport: 'http',
      url: config.url,
      headers: config.headers,
    }
  }

  // Stdio server
  if (config.command) {
    return {
      name,
      slug,
      transport: 'stdio',
      command: config.command,
      args: Array.isArray(config.args) ? config.args : undefined,
      env: config.env && typeof config.env === 'object' ? config.env : undefined,
    }
  }

  return null
}

export function AddSourceDialog({
  open,
  onOpenChange,
  onSubmit,
  workspaceId,
  onOpenAI,
}: AddSourceDialogProps) {
  const { t } = useTranslation()

  // Mode toggle
  const [mode, setMode] = React.useState<InputMode>('json')

  // === Form mode state ===
  const [name, setName] = React.useState('')
  const [sourceType, setSourceType] = React.useState<'mcp' | 'api'>('mcp')
  const [scope, setScope] = React.useState<'global' | 'workspace'>('workspace')
  const [transport, setTransport] = React.useState<'http' | 'stdio'>('http')
  const [mcpUrl, setMcpUrl] = React.useState('')
  const [mcpCommand, setMcpCommand] = React.useState('')
  const [mcpArgs, setMcpArgs] = React.useState('')
  const [mcpEnv, setMcpEnv] = React.useState('')
  const [mcpAuthType, setMcpAuthType] = React.useState('none')
  const [apiBaseUrl, setApiBaseUrl] = React.useState('')
  const [apiAuthType, setApiAuthType] = React.useState('bearer')

  // Credential inputs (shown conditionally based on auth type)
  const [bearerToken, setBearerToken] = React.useState('')
  const [basicUsername, setBasicUsername] = React.useState('')
  const [basicPassword, setBasicPassword] = React.useState('')
  const [headerName, setHeaderName] = React.useState('')
  const [headerValue, setHeaderValue] = React.useState('')

  // === JSON mode state ===
  const [jsonText, setJsonText] = React.useState('')
  const [jsonScope, setJsonScope] = React.useState<'global' | 'workspace'>('workspace')
  const [parsedServers, setParsedServers] = React.useState<ParsedServer[]>([])
  const [parseError, setParseError] = React.useState<string | null>(null)

  // UI state
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setMode('json')
      setName('')
      setSourceType('mcp')
      setScope('workspace')
      setTransport('http')
      setMcpUrl('')
      setMcpCommand('')
      setMcpArgs('')
      setMcpEnv('')
      setMcpAuthType('none')
      setApiBaseUrl('')
      setApiAuthType('bearer')
      setBearerToken('')
      setBasicUsername('')
      setBasicPassword('')
      setHeaderName('')
      setHeaderValue('')
      setJsonText('')
      setJsonScope('workspace')
      setParsedServers([])
      setParseError(null)
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  // Parse JSON on change
  React.useEffect(() => {
    if (mode !== 'json' || !jsonText.trim()) {
      setParsedServers([])
      setParseError(null)
      return
    }
    try {
      const servers = parseJsonServers(jsonText)
      setParsedServers(servers)
      setParseError(null)
    } catch (e) {
      setParsedServers([])
      setParseError((e as Error).message)
    }
  }, [mode, jsonText])

  // Auto-generate slug from name
  const slug = React.useMemo(() => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || 'new-source'
  }, [name])

  // === Form mode submit ===
  const canSubmitForm = React.useMemo(() => {
    if (!name.trim()) return false
    if (sourceType === 'mcp') {
      if (transport === 'http') return mcpUrl.trim().length > 0
      if (transport === 'stdio') return mcpCommand.trim().length > 0
    }
    if (sourceType === 'api') return apiBaseUrl.trim().length > 0
    return false
  }, [name, sourceType, transport, mcpUrl, mcpCommand, apiBaseUrl])

  const handleSubmitForm = async () => {
    if (!canSubmitForm || submitting) return
    setSubmitting(true)
    setError(null)

    const formData: AddSourceFormData = {
      name: name.trim(),
      slug,
      type: sourceType,
      scope,
    }

    if (sourceType === 'mcp') {
      formData.mcpTransport = transport
      formData.mcpAuthType = mcpAuthType
      if (transport === 'http') {
        formData.mcpUrl = mcpUrl.trim()
      } else {
        formData.mcpCommand = mcpCommand.trim()
        if (mcpArgs.trim()) formData.mcpArgs = mcpArgs.trim().split(/\s+/)
        if (mcpEnv.trim()) {
          formData.mcpEnv = Object.fromEntries(
            mcpEnv.split('\n').filter(l => l.includes('=')).map(l => {
              const [k, ...v] = l.split('=')
              return [k.trim(), v.join('=').trim()]
            })
          )
        }
      }
    } else {
      formData.apiBaseUrl = apiBaseUrl.trim()
      formData.apiAuthType = apiAuthType
    }

    // Attach credential fields based on auth type
    const effectiveAuthType = sourceType === 'mcp' ? mcpAuthType : apiAuthType
    if (effectiveAuthType === 'bearer' && bearerToken.trim()) {
      formData.bearerToken = bearerToken.trim()
    } else if (effectiveAuthType === 'basic') {
      formData.basicUsername = basicUsername.trim()
      formData.basicPassword = basicPassword
    } else if (effectiveAuthType === 'header') {
      formData.headerName = headerName.trim()
      formData.headerValue = headerValue.trim()
    }

    try {
      await onSubmit(formData)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create source')
    } finally {
      setSubmitting(false)
    }
  }

  // === JSON mode submit ===
  const handleSubmitJson = async () => {
    if (parsedServers.length === 0 || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      for (const server of parsedServers) {
        const formData: AddSourceFormData = {
          name: server.name,
          slug: server.slug,
          type: 'mcp',
          scope: jsonScope,
          mcpTransport: server.transport,
          mcpAuthType: 'none',
        }
        if (server.transport === 'http') {
          formData.mcpUrl = server.url
          if (server.headers) formData.mcpHeaders = server.headers
        } else {
          formData.mcpCommand = server.command
          formData.mcpArgs = server.args
          formData.mcpEnv = server.env
        }
        await onSubmit(formData)
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create source(s)')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (mode === 'form') handleSubmitForm()
      else handleSubmitJson()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t('addSource.title', 'Add Source')}
          </DialogTitle>
        </DialogHeader>

        {/* Mode Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-foreground/[0.03]">
          <button
            type="button"
            onClick={() => setMode('json')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors',
              mode === 'json'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-foreground/50 hover:text-foreground/70'
            )}
          >
            <FileJson className="h-3.5 w-3.5" />
            {t('addSource.modeJson', 'JSON Import')}
          </button>
          <button
            type="button"
            onClick={() => setMode('form')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors',
              mode === 'form'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-foreground/50 hover:text-foreground/70'
            )}
          >
            <ListPlus className="h-3.5 w-3.5" />
            {t('addSource.modeForm', 'Form')}
          </button>
          {onOpenAI && (
            <button
              type="button"
              onClick={() => setMode('ai')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors',
                mode === 'ai'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-foreground/50 hover:text-foreground/70'
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {t('addSource.modeAI', 'AI Setup')}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ============ JSON Mode ============ */}
        {mode === 'json' && (
          <div className="space-y-4">
            {/* Scope Toggle */}
            <ScopeToggle scope={jsonScope} onScopeChange={setJsonScope} />

            {/* JSON Textarea */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('addSource.jsonConfig', 'MCP Server Configuration')}
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={JSON.stringify({
                  mcpServers: {
                    "my-server": {
                      command: "npx",
                      args: ["-y", "@modelcontextprotocol/server-memory"],
                    },
                    "remote-api": {
                      url: "https://mcp.example.com/sse",
                    },
                  },
                }, null, 2)}
                rows={10}
                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono shadow-sm transition-colors placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                autoFocus
                spellCheck={false}
              />
            </div>

            {/* Parse Result */}
            {parseError && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap">
                {parseError}
              </div>
            )}

            {parsedServers.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground/60">
                  {t('addSource.detectedServers', 'Detected {{count}} server(s):', { count: parsedServers.length })}
                </div>
                <div className="space-y-1.5">
                  {parsedServers.map((server) => (
                    <div
                      key={server.slug}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-foreground/[0.01]"
                    >
                      <div className={cn(
                        "shrink-0 w-6 h-6 rounded-md flex items-center justify-center",
                        server.transport === 'http'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-success/10 text-success'
                      )}>
                        {server.transport === 'http'
                          ? <Link className="h-3 w-3" />
                          : <Terminal className="h-3 w-3" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{server.name}</div>
                        <div className="text-xs text-foreground/50 truncate">
                          {server.transport === 'http'
                            ? server.url
                            : `${server.command} ${(server.args || []).join(' ')}`
                          }
                        </div>
                      </div>
                      <span className={cn(
                        "shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono",
                        server.transport === 'http'
                          ? 'bg-accent/5 text-accent'
                          : 'bg-success/5 text-success'
                      )}>
                        {server.transport}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Format hints */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent/5 text-xs text-foreground/60">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-accent" />
              <div className="space-y-1">
                <p>{t('addSource.jsonHint', 'Supports Claude Desktop / Cursor / Windsurf mcpServers format, single server config, or raw config.json.')}</p>
                <details className="cursor-pointer">
                  <summary className="text-accent hover:text-accent/80">{t('addSource.showFormats', 'Show format examples')}</summary>
                  <pre className="mt-1.5 p-2 rounded bg-foreground/[0.03] text-[11px] overflow-x-auto whitespace-pre-wrap">{
`// Claude Desktop / Cursor format:
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@mcp/server"],
      "env": { "KEY": "value" }
    }
  }
}

// HTTP server:
{
  "mcpServers": {
    "remote": {
      "url": "https://mcp.example.com/sse",
      "headers": { "Authorization": "Bearer ..." }
    }
  }
}

// Single server (auto-detected):
{ "command": "node", "args": ["server.js"] }
{ "url": "https://mcp.example.com/sse" }`
                  }</pre>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* ============ Form Mode ============ */}
        {mode === 'form' && (
          <div className="space-y-5 py-2">
            {/* Source Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('addSource.name', 'Name')} <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('addSource.namePlaceholder', 'e.g., My Database MCP')}
                className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                slug: <code className="bg-foreground/5 px-1 rounded">{slug}</code>
              </p>
            </div>

            {/* Source Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('addSource.type', 'Type')}</label>
              <div className="flex gap-2">
                <TypeButton
                  icon={<Server className="h-3.5 w-3.5" />}
                  label="MCP"
                  desc={t('addSource.typeMcpDesc', 'Model Context Protocol')}
                  active={sourceType === 'mcp'}
                  onClick={() => setSourceType('mcp')}
                />
                <TypeButton
                  icon={<Link className="h-3.5 w-3.5" />}
                  label="API"
                  desc={t('addSource.typeApiDesc', 'REST API')}
                  active={sourceType === 'api'}
                  onClick={() => setSourceType('api')}
                />
              </div>
            </div>

            {/* Scope Toggle */}
            <ScopeToggle scope={scope} onScopeChange={setScope} />

            {/* MCP-specific fields */}
            {sourceType === 'mcp' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('addSource.transport', 'Transport')}</label>
                  <div className="flex gap-2">
                    <TypeButton icon={<Link className="h-3.5 w-3.5" />} label="HTTP / SSE" desc={t('addSource.transportHttpDesc', 'Remote server')} active={transport === 'http'} onClick={() => setTransport('http')} />
                    <TypeButton icon={<Terminal className="h-3.5 w-3.5" />} label="Stdio" desc={t('addSource.transportStdioDesc', 'Local process')} active={transport === 'stdio'} onClick={() => setTransport('stdio')} />
                  </div>
                </div>

                {transport === 'http' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">URL <span className="text-destructive">*</span></label>
                    <input type="url" value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder="https://mcp.example.com/sse" className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  </div>
                )}

                {transport === 'stdio' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t('addSource.command', 'Command')} <span className="text-destructive">*</span></label>
                      <input type="text" value={mcpCommand} onChange={(e) => setMcpCommand(e.target.value)} placeholder="npx" className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t('addSource.args', 'Arguments')}</label>
                      <input type="text" value={mcpArgs} onChange={(e) => setMcpArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-memory" className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t('addSource.envVars', 'Environment Variables')}</label>
                      <textarea value={mcpEnv} onChange={(e) => setMcpEnv(e.target.value)} placeholder={"API_KEY=xxx\nDEBUG=true"} rows={3} className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
                      <p className="text-xs text-muted-foreground">KEY=VALUE per line</p>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('addSource.authType', 'Authentication')}</label>
                  <select value={mcpAuthType} onChange={(e) => setMcpAuthType(e.target.value)} className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="none">{t('addSource.authNone', 'No Auth')}</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="oauth">OAuth</option>
                  </select>
                </div>

                {/* MCP Credential inputs */}
                {mcpAuthType === 'bearer' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('addSource.bearerToken', 'Bearer Token')}</label>
                    <input type="password" value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} placeholder="sk-..." className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  </div>
                )}
                {mcpAuthType === 'oauth' && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent/5 text-xs text-foreground/60">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-accent" />
                    <span>{t('addSource.oauthHint', 'After creation, go to source details and click "Authenticate" to start the OAuth flow.')}</span>
                  </div>
                )}
              </>
            )}

            {/* API-specific fields */}
            {sourceType === 'api' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('addSource.baseUrl', 'Base URL')} <span className="text-destructive">*</span></label>
                  <input type="url" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('addSource.authType', 'Authentication')}</label>
                  <select value={apiAuthType} onChange={(e) => setApiAuthType(e.target.value)} className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="bearer">Bearer Token / API Key</option>
                    <option value="basic">Basic Auth</option>
                    <option value="header">Custom Header</option>
                    <option value="none">{t('addSource.authNone', 'No Auth')}</option>
                  </select>
                </div>

                {/* API Credential inputs */}
                {apiAuthType === 'bearer' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('addSource.bearerToken', 'API Key / Bearer Token')}</label>
                    <input type="password" value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} placeholder="sk-..." className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  </div>
                )}
                {apiAuthType === 'basic' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t('addSource.username', 'Username')}</label>
                      <input type="text" value={basicUsername} onChange={(e) => setBasicUsername(e.target.value)} placeholder="user@example.com" className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t('addSource.password', 'Password')}</label>
                      <input type="password" value={basicPassword} onChange={(e) => setBasicPassword(e.target.value)} placeholder="••••••••" className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    </div>
                  </>
                )}
                {apiAuthType === 'header' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t('addSource.headerName', 'Header Name')}</label>
                      <input type="text" value={headerName} onChange={(e) => setHeaderName(e.target.value)} placeholder="X-API-Key" className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t('addSource.headerValue', 'Header Value')}</label>
                      <input type="password" value={headerValue} onChange={(e) => setHeaderValue(e.target.value)} placeholder="your-api-key" className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    </div>
                  </>
                )}
              </>
            )}

            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent/5 text-xs text-foreground/60">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-accent" />
              <span>{t('addSource.hint', 'After creation, you can use "Test Source" in the source details page to verify the connection and configure authentication.')}</span>
            </div>
          </div>
        )}

        {/* ============ AI Mode ============ */}
        {mode === 'ai' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-accent" />
            </div>
            <div className="text-center space-y-1.5 max-w-xs">
              <h3 className="text-sm font-medium">
                {t('addSource.aiTitle', 'AI-Assisted Setup')}
              </h3>
              <p className="text-xs text-foreground/50">
                {t('addSource.aiDescription', 'Describe what you want to connect and the AI assistant will configure the source for you — including auth, endpoints, and testing.')}
              </p>
            </div>
            <Button
              onClick={() => {
                onOpenChange(false)
                onOpenAI?.()
              }}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              {t('addSource.startAIChat', 'Start AI Chat')}
            </Button>
          </div>
        )}

        <DialogFooter className={mode === 'ai' ? 'hidden' : ''}>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={mode === 'form' ? handleSubmitForm : handleSubmitJson}
            disabled={mode === 'form' ? !canSubmitForm || submitting : parsedServers.length === 0 || submitting}
          >
            {submitting
              ? t('addSource.creating', 'Creating...')
              : mode === 'json' && parsedServers.length > 1
                ? t('addSource.createMultiple', 'Create {{count}} Sources', { count: parsedServers.length })
                : t('addSource.create', 'Create Source')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Shared Sub-components
// ============================================================

function ScopeToggle({ scope, onScopeChange }: { scope: 'global' | 'workspace'; onScopeChange: (s: 'global' | 'workspace') => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{t('addSource.scope', 'Scope')}</label>
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-foreground/[0.02]">
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-md",
          scope === 'global' ? 'bg-accent/10 text-accent' : 'bg-foreground/5 text-foreground/40'
        )}>
          {scope === 'global' ? <Globe className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">
            {scope === 'global' ? t('sources.scope.global', '🌐 Global') : t('sources.scope.workspace', '📁 Workspace')}
          </div>
          <div className="text-xs text-muted-foreground">
            {scope === 'global' ? t('sources.globalDescription', 'Available in all workspaces') : t('sources.workspaceDescription', 'Only available in this workspace')}
          </div>
        </div>
        <Switch checked={scope === 'global'} onCheckedChange={(checked) => onScopeChange(checked ? 'global' : 'workspace')} />
      </div>
    </div>
  )
}

function TypeButton({ icon, label, desc, active, onClick }: {
  icon: React.ReactNode; label: string; desc: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors text-left',
        active ? 'border-foreground/20 bg-foreground/5' : 'border-border hover:bg-foreground/[0.02]'
      )}
    >
      <div className={cn(
        "shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
        active ? 'bg-foreground/10 text-foreground' : 'bg-foreground/5 text-foreground/40'
      )}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  )
}
