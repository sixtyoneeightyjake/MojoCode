'use client'

import { useCallback, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Loader2Icon, PlugIcon, ShieldAlertIcon } from 'lucide-react'
import { toast } from 'sonner'

interface SupabaseBootstrapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAppendSystemMessage: (message: string) => void
  supabaseUrl?: string
}

interface BootstrapResponse {
  ok: boolean
  steps?: string[]
  warnings?: string[]
  error?: string
}

export function SupabaseBootstrapDialog({
  open,
  onOpenChange,
  onAppendSystemMessage,
  supabaseUrl,
}: SupabaseBootstrapDialogProps) {
  const [seedDemoData, setSeedDemoData] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [statusLines, setStatusLines] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const connectionStatus = useMemo(() => {
    if (supabaseUrl) {
      return {
        label: 'Connected',
        tone: 'success' as const,
        description: supabaseUrl,
      }
    }
    return {
      label: 'Not Configured',
      tone: 'destructive' as const,
      description: 'Set NEXT_PUBLIC_SUPABASE_URL in your environment first.',
    }
  }, [supabaseUrl])

  const resetState = useCallback(() => {
    setStatusLines([])
    setErrorMessage(null)
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetState()
        setSeedDemoData(false)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetState]
  )

  const handleBootstrap = useCallback(async () => {
    if (!supabaseUrl) {
      return
    }

    setIsRunning(true)
    setErrorMessage(null)
    setStatusLines(['Starting Supabase bootstrap...'])

    try {
      const response = await fetch('/api/admin/supabase/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seed: seedDemoData }),
      })

      let data: BootstrapResponse | null = null
      try {
        data = (await response.json()) as BootstrapResponse
      } catch (error) {
        console.error('[supabase-bootstrap-dialog] Failed to parse response', error)
      }

      if (!response.ok || !data?.ok) {
        const error = data?.error ?? `Request failed (${response.status})`
        throw new Error(error)
      }

      const steps = data.steps ?? []
      const warnings = data.warnings ?? []

      setStatusLines(steps)
      if (warnings.length > 0) {
        setStatusLines((prev) => [...prev, ...warnings.map((warning) => `Warning: ${warning}`)])
      }

      toast.success('Supabase database bootstrapped')

      const lines = [
        '✅ Supabase DB bootstrapped: tables created, RLS off (dev).',
        ...steps.map((step) => `• ${step}`),
      ]

      if (warnings.length > 0) {
        lines.push('', 'Warnings:', ...warnings.map((warning) => `• ${warning}`))
      }

      onAppendSystemMessage(lines.join('\n'))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Bootstrap failed. Check server logs for details.'

      setErrorMessage(message)
      toast.error(message)
      onAppendSystemMessage(`❌ Supabase bootstrap failed: ${message}`)
    } finally {
      setIsRunning(false)
    }
  }, [onAppendSystemMessage, seedDemoData, supabaseUrl])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PlugIcon className="w-4 h-4" /> Add Supabase (DB)
          </DialogTitle>
          <DialogDescription>
            Bootstrap the chat history schema in your Supabase project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Connection Status</span>
              <Badge variant={connectionStatus.tone === 'success' ? 'secondary' : 'destructive'}>
                {connectionStatus.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground break-words">
              {connectionStatus.description}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-dashed border-border/60 p-3">
            <Checkbox
              id="seed-demo"
              checked={seedDemoData}
              onCheckedChange={(checked) =>
                setSeedDemoData(checked === 'indeterminate' ? false : Boolean(checked))
              }
            />
            <div className="space-y-1">
              <Label htmlFor="seed-demo" className="text-sm font-medium">
                Also seed demo data
              </Label>
              <p className="text-xs text-muted-foreground">
                Inserts a sample conversation and two messages so you can verify persistence.
              </p>
            </div>
          </div>

          {statusLines.length > 0 && (
            <div className="rounded-md bg-muted/60 p-3 text-sm font-mono space-y-1">
              {statusLines.map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldAlertIcon className="h-4 w-4 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isRunning}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleBootstrap}
            disabled={isRunning || !supabaseUrl}
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <Loader2Icon className="h-4 w-4 animate-spin" /> Running...
              </span>
            ) : (
              'Run DB Bootstrap'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
