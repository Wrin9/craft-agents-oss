/**
 * WeChatConnectDialog — QR scan login flow for WeChat via iLink Bot API.
 *
 * Two-phase flow:
 * 1. Auto-fetch QR code from iLink API → display as base64 image
 * 2. Poll scan status every 2 seconds → on confirmed, save bot_token → done
 *
 * Falls back to manual token entry if QR fetch fails.
 */

import * as React from 'react'
import { Check, X, QrCode, RefreshCw, Key } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@craft-agent/ui'

interface WeChatConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When true, treat the flow as "replace existing credentials". */
  reconfigure?: boolean
  onSaved?: () => void
}

type Phase =
  | { id: 'loading' }
  | { id: 'qr'; qrcode: string; qrImage: string }
  | { id: 'scanned' }
  | { id: 'saving' }
  | { id: 'manual' }
  | { id: 'error'; error: string }

const QR_POLL_INTERVAL_MS = 2000
const QR_EXPIRY_MS = 120_000 // 2 minutes

export function WeChatConnectDialog({
  open,
  onOpenChange,
  reconfigure = false,
  onSaved,
}: WeChatConnectDialogProps) {
  const { t } = useTranslation()
  const [phase, setPhase] = React.useState<Phase>({ id: 'loading' })
  const [manualToken, setManualToken] = React.useState('')
  const [testResult, setTestResult] = React.useState<
    { state: 'idle' } | { state: 'testing' } | { state: 'success' } | { state: 'error'; error: string }
  >({ state: 'idle' })

  // Reset state on dialog open/close
  React.useEffect(() => {
    if (open) {
      setPhase({ id: 'loading' })
      setManualToken('')
      setTestResult({ state: 'idle' })
    }
  }, [open])

  // ---- Phase 1: Fetch QR code on dialog open ----
  React.useEffect(() => {
    if (!open || phase.id !== 'loading') return

    let cancelled = false

    const fetchQR = async () => {
      try {
        const result = await window.electronAPI.wechatGetQR()
        if (cancelled) return

        if (result.qrcode && result.qrcode_img_content) {
          setPhase({ id: 'qr', qrcode: result.qrcode, qrImage: result.qrcode_img_content })
        } else {
          // API returned no QR — fall back to manual
          setPhase({ id: 'manual' })
        }
      } catch (err) {
        if (cancelled) return
        setPhase({ id: 'manual' })
      }
    }

    fetchQR()
    return () => { cancelled = true }
  }, [open, phase.id])

  // ---- Phase 2: Poll QR scan status ----
  React.useEffect(() => {
    if (phase.id !== 'qr') return

    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const startTime = Date.now()

    const poll = async () => {
      if (cancelled) return

      // Check expiry
      if (Date.now() - startTime > QR_EXPIRY_MS) {
        setPhase({ id: 'error', error: t('settings.messaging.wechat.qrExpired', 'QR code expired. Click refresh to get a new one.') })
        return
      }

      try {
        const result = await window.electronAPI.wechatPollQR({ qrcode: phase.qrcode })
        if (cancelled) return

        if (result.status === 'confirmed' && result.bot_token) {
          // Scanned & confirmed — save the token (skip validation, trusted by iLink)
          setPhase({ id: 'saving' })
          try {
            await window.electronAPI.saveWeChatCredentials({ botToken: result.bot_token, skipValidation: true })
            toast.success(t('settings.messaging.wechat.saved', 'WeChat connected successfully'))
            onSaved?.()
            onOpenChange(false)
          } catch (err) {
            setPhase({ id: 'error', error: err instanceof Error ? err.message : 'Failed to save credentials' })
          }
          return
        }

        if (result.status === 'scanned') {
          setPhase({ id: 'scanned' })
        }

        if (result.status === 'expired') {
          setPhase({ id: 'error', error: t('settings.messaging.wechat.qrExpired', 'QR code expired. Click refresh to get a new one.') })
          return
        }

        // Continue polling (waiting or scanned)
        timeout = setTimeout(poll, QR_POLL_INTERVAL_MS)
      } catch {
        // Network hiccup — retry
        timeout = setTimeout(poll, QR_POLL_INTERVAL_MS)
      }
    }

    // Start polling after a short delay
    timeout = setTimeout(poll, 1500)

    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
    }
  }, [phase.id === 'qr' ? phase.qrcode : '', phase.id])

  // ---- Handlers ----

  const handleRefreshQR = () => {
    setPhase({ id: 'loading' })
  }

  const handleSwitchToManual = () => {
    setPhase({ id: 'manual' })
  }

  const handleSwitchToQR = () => {
    setPhase({ id: 'loading' })
  }

  const handleTestToken = async () => {
    if (!manualToken.trim()) return
    setTestResult({ state: 'testing' })
    try {
      const result = await window.electronAPI.testWeChatCredentials({ botToken: manualToken.trim() })
      if (result.success) {
        setTestResult({ state: 'success' })
      } else {
        setTestResult({ state: 'error', error: result.error ?? t('common.error') })
      }
    } catch (err) {
      setTestResult({ state: 'error', error: err instanceof Error ? err.message : t('common.error') })
    }
  }

  const handleSaveManual = async () => {
    if (!manualToken.trim()) return
    setPhase({ id: 'saving' })
    try {
      await window.electronAPI.saveWeChatCredentials({ botToken: manualToken.trim() })
      toast.success(t('settings.messaging.wechat.saved', 'WeChat connected successfully'))
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.messaging.wechat.saveFailed', 'Failed to connect WeChat'))
      setPhase({ id: 'manual' })
    }
  }

  const ready = manualToken.trim().length > 0

  // ---- Render ----

  const renderQRContent = () => {
    if (phase.id === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Spinner className="text-[32px]" />
          <span className="text-sm text-muted-foreground">
            {t('settings.messaging.wechat.loadingQR', 'Loading QR code…')}
          </span>
        </div>
      )
    }

    if (phase.id === 'qr') {
      return (
        <div className="flex flex-col items-center gap-4 py-4">
          {/* QR Code Image */}
          <div className="relative rounded-lg border bg-white p-3">
            <QRCodeSVG value={phase.qrImage} size={200} level="M" />
            {/* Scanned overlay */}
            {false && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                <div className="text-white text-sm font-medium flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-400" />
                  Scanned
                </div>
              </div>
            )}
          </div>

          {/* Status indicator */}
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">
              {t('settings.messaging.wechat.scanQR', 'Scan with WeChat')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                'settings.messaging.wechat.scanInstructions',
                'Open WeChat → tap + → Scan to log in',
              )}
            </p>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Spinner className="text-[12px]" />
              {t('settings.messaging.wechat.waitingScan', 'Waiting for scan…')}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshQR}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              {t('settings.messaging.wechat.refreshQR', 'Refresh')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSwitchToManual}>
              <Key className="mr-1 h-3.5 w-3.5" />
              {t('settings.messaging.wechat.enterToken', 'Enter token manually')}
            </Button>
          </div>
        </div>
      )
    }

    if (phase.id === 'scanned') {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
            <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-sm font-medium">
            {t('settings.messaging.wechat.scanned', 'QR code scanned!')}
          </span>
          <span className="text-xs text-muted-foreground">
            {t('settings.messaging.wechat.confirmOnPhone', 'Please confirm on your phone…')}
          </span>
          <Spinner className="text-[16px]" />
        </div>
      )
    }

    if (phase.id === 'saving') {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Spinner className="text-[24px]" />
          <span className="text-sm text-muted-foreground">
            {t('settings.messaging.wechat.saving', 'Connecting…')}
          </span>
        </div>
      )
    }

    if (phase.id === 'error') {
      return (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm text-destructive">{phase.error}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshQR}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              {t('settings.messaging.wechat.tryAgain', 'Try again')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSwitchToManual}>
              <Key className="mr-1 h-3.5 w-3.5" />
              {t('settings.messaging.wechat.enterToken', 'Enter token manually')}
            </Button>
          </div>
        </div>
      )
    }

    // Manual entry mode
    if (phase.id === 'manual') {
      return (
        <div className="space-y-3 py-2">
          <div>
            <div className="mb-1.5 text-xs text-muted-foreground">
              {t('settings.messaging.wechat.tokenLabel', 'Bot Token')}
            </div>
            <input
              type="password"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder={t(
                'settings.messaging.wechat.tokenPlaceholder',
                'Paste your iLink bot_token here',
              )}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestToken}
              disabled={!ready || testResult.state === 'testing'}
            >
              {testResult.state === 'testing' && <Spinner className="mr-1 text-[14px]" />}
              {t('settings.messaging.wechat.testConnection', 'Test Connection')}
            </Button>

            {testResult.state === 'success' && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                {t('settings.messaging.wechat.testOk', 'Connected')}
              </span>
            )}
            {testResult.state === 'error' && (
              <span className="inline-flex items-center gap-1 text-xs text-destructive">
                <X className="h-3.5 w-3.5" />
                {testResult.error}
              </span>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={handleSwitchToQR} className="text-xs">
            <QrCode className="mr-1 h-3.5 w-3.5" />
            {t('settings.messaging.wechat.scanInstead', 'Scan QR code instead')}
          </Button>
        </div>
      )
    }

    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {reconfigure
              ? t('settings.messaging.wechat.reconfigureTitle', 'Reconnect WeChat')
              : t('settings.messaging.wechat.connectTitle', 'Connect WeChat')}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-line">
            {phase.id === 'manual'
              ? t(
                  'settings.messaging.wechat.instructions',
                  'Enter your WeChat iLink bot_token to connect.',
                )
              : t(
                  'settings.messaging.wechat.scanInstructions',
                  'Open WeChat → tap + → Scan to log in',
                )}
          </DialogDescription>
        </DialogHeader>

        {renderQRContent()}

        {/* Manual mode footer with save button */}
        {phase.id === 'manual' && (
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveManual}
              disabled={!ready || testResult.state !== 'success'}
            >
              {t('settings.messaging.wechat.save', 'Connect')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
