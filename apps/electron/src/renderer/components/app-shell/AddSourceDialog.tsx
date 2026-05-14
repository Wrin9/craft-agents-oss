/**
 * AddSourceDialog — Manual source creation dialog
 *
 * Allows users to add MCP servers or API sources by filling in a form
 * instead of going through the AI-powered EditPopover.
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AddSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (config: AddSourceFormData) => Promise<void>
  /** Workspace ID for workspace-scoped sources */
  workspaceId: string
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
  mcpArgs?: string
  mcpEnv?: string
  mcpAuthType?: string
  // API fields
  apiBaseUrl?: string
  apiAuthType?: string
}

type TransportOption = 'http' | 'stdio'

export function AddSourceDialog({
  open,
  onOpenChange,
  onSubmit,
  workspaceId,
}: AddSourceDialogProps) {
  const { t } = useTranslation()

  // Form state
  const [name, setName] = React.useState('')
  const [sourceType, setSourceType] = React.useState<'mcp' | 'api'>('mcp')
  const [scope, setScope] = React.useState<'global' | 'workspace'>('workspace')
  const [transport, setTransport] = React.useState<TransportOption>('http')

  // MCP fields
  const [mcpUrl, setMcpUrl] = React.useState('')
  const [mcpCommand, setMcpCommand] = React.useState('')
  const [mcpArgs, setMcpArgs] = React.useState('')
  const [mcpEnv, setMcpEnv] = React.useState('')
  const [mcpAuthType, setMcpAuthType] = React.useState('none')

  // API fields
  const [apiBaseUrl, setApiBaseUrl] = React.useState('')
  const [apiAuthType, setApiAuthType] = React.useState('bearer')

  // UI state
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Auto-generate slug from name
  const slug = React.useMemo(() => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || 'new-source'
  }, [name])

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
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
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const canSubmit = React.useMemo(() => {
    if (!name.trim()) return false
    if (sourceType === 'mcp') {
      if (transport === 'http') return mcpUrl.trim().length > 0
      if (transport === 'stdio') return mcpCommand.trim().length > 0
    }
    if (sourceType === 'api') return apiBaseUrl.trim().length > 0
    return false
  }, [name, sourceType, transport, mcpUrl, mcpCommand, apiBaseUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || submitting) return

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
        if (mcpArgs.trim()) formData.mcpArgs = mcpArgs.trim()
        if (mcpEnv.trim()) formData.mcpEnv = mcpEnv.trim()
      }
    } else {
      formData.apiBaseUrl = apiBaseUrl.trim()
      formData.apiAuthType = apiAuthType
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t('addSource.title', 'Add Source')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

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
            <label className="text-sm font-medium">
              {t('addSource.type', 'Type')}
            </label>
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
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('addSource.scope', 'Scope')}
            </label>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-foreground/[0.02]">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-md",
                scope === 'global' ? 'bg-accent/10 text-accent' : 'bg-foreground/5 text-foreground/40'
              )}>
                {scope === 'global' ? <Globe className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {scope === 'global'
                    ? t('sources.scope.global', '🌐 Global')
                    : t('sources.scope.workspace', '📁 Workspace')
                  }
                </div>
                <div className="text-xs text-muted-foreground">
                  {scope === 'global'
                    ? t('sources.globalDescription', 'Available in all workspaces')
                    : t('sources.workspaceDescription', 'Only available in this workspace')
                  }
                </div>
              </div>
              <Switch
                checked={scope === 'global'}
                onCheckedChange={(checked) => setScope(checked ? 'global' : 'workspace')}
              />
            </div>
          </div>

          {/* MCP-specific fields */}
          {sourceType === 'mcp' && (
            <>
              {/* Transport */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t('addSource.transport', 'Transport')}
                </label>
                <div className="flex gap-2">
                  <TypeButton
                    icon={<Link className="h-3.5 w-3.5" />}
                    label="HTTP / SSE"
                    desc={t('addSource.transportHttpDesc', 'Remote server')}
                    active={transport === 'http'}
                    onClick={() => setTransport('http')}
                  />
                  <TypeButton
                    icon={<Terminal className="h-3.5 w-3.5" />}
                    label="Stdio"
                    desc={t('addSource.transportStdioDesc', 'Local process')}
                    active={transport === 'stdio'}
                    onClick={() => setTransport('stdio')}
                  />
                </div>
              </div>

              {/* HTTP URL */}
              {transport === 'http' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    URL <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="url"
                    value={mcpUrl}
                    onChange={(e) => setMcpUrl(e.target.value)}
                    placeholder="https://mcp.example.com/sse"
                    className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}

              {/* Stdio Command */}
              {transport === 'stdio' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t('addSource.command', 'Command')} <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={mcpCommand}
                      onChange={(e) => setMcpCommand(e.target.value)}
                      placeholder="npx"
                      className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t('addSource.args', 'Arguments')}
                    </label>
                    <input
                      type="text"
                      value={mcpArgs}
                      onChange={(e) => setMcpArgs(e.target.value)}
                      placeholder="-y @modelcontextprotocol/server-memory"
                      className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t('addSource.envVars', 'Environment Variables')}
                    </label>
                    <textarea
                      value={mcpEnv}
                      onChange={(e) => setMcpEnv(e.target.value)}
                      placeholder={"API_KEY=xxx\nDEBUG=true"}
                      rows={3}
                      className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      KEY=VALUE per line
                    </p>
                  </div>
                </>
              )}

              {/* Auth Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t('addSource.authType', 'Authentication')}
                </label>
                <select
                  value={mcpAuthType}
                  onChange={(e) => setMcpAuthType(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="none">{t('addSource.authNone', 'No Auth')}</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="oauth">OAuth</option>
                </select>
              </div>
            </>
          )}

          {/* API-specific fields */}
          {sourceType === 'api' && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t('addSource.baseUrl', 'Base URL')} <span className="text-destructive">*</span>
                </label>
                <input
                  type="url"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t('addSource.authType', 'Authentication')}
                </label>
                <select
                  value={apiAuthType}
                  onChange={(e) => setApiAuthType(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="bearer">Bearer Token / API Key</option>
                  <option value="basic">Basic Auth</option>
                  <option value="header">Custom Header</option>
                  <option value="none">{t('addSource.authNone', 'No Auth')}</option>
                </select>
              </div>
            </>
          )}

          {/* Hint */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent/5 text-xs text-foreground/60">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-accent" />
            <span>
              {t('addSource.hint', 'After creation, you can use "Test Source" in the source details page to verify the connection and configure authentication.')}
            </span>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting
              ? t('addSource.creating', 'Creating...')
              : t('addSource.create', 'Create Source')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Internal type-selector button */
function TypeButton({
  icon,
  label,
  desc,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors text-left',
        active
          ? 'border-foreground/20 bg-foreground/5'
          : 'border-border hover:bg-foreground/[0.02]'
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
