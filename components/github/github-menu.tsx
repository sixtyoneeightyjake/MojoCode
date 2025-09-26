'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { GithubIcon } from '@/components/icons/github'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ImportDialog } from '@/components/github/import-dialog'
import { ExportDialog } from '@/components/github/export-dialog'
import { useGitHubStatus } from '@/components/github/use-github-status'
import { useSandboxStore } from '@/app/state'
import { cn } from '@/lib/utils'

export function GitHubMenu() {
  const { sandboxId, status, isLoading } = useGitHubStatus()
  const repository = useSandboxStore((state) => state.repository)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)

  const hasSandbox = Boolean(sandboxId)
  const isExistingRepo = Boolean(status?.isGitRepo && status.remoteFullName)

  const exportDisabled = useMemo(() => {
    if (!hasSandbox) return true
    if (isExistingRepo) {
      return !status?.hasChanges
    }
    return false
  }, [hasSandbox, isExistingRepo, status?.hasChanges])

  const statusMessage = useMemo(() => {
    if (!hasSandbox) {
      return 'Start a coding session before importing a repository.'
    }
    if (isLoading) {
      return 'Detecting Git status…'
    }
    if (!status?.isGitRepo) {
      return 'Workspace is not yet a git repository.'
    }
    if (!status.remoteFullName) {
      return 'Git repo detected without a remote. Export to create one.'
    }
    if (status.hasChanges) {
      return `Unpushed changes on ${status.branch ?? 'current branch'}.`
    }
    return 'Repository is up to date with the remote.'
  }, [hasSandbox, isLoading, status])

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="GitHub actions">
            <GithubIcon className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-3">
          <div className="space-y-2">
            <ActionButton
              disabled={!hasSandbox}
              onClick={() => {
                setIsPopoverOpen(false)
                setIsImportOpen(true)
              }}
            >
              Import repository
            </ActionButton>
            <ActionButton
              disabled={exportDisabled}
              onClick={() => {
                setIsPopoverOpen(false)
                setIsExportOpen(true)
              }}
            >
              Export to GitHub
            </ActionButton>
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            {repository?.fullName ? (
              <p className="font-mono text-[11px] text-primary">
                {repository.fullName}
                {repository.branch ? ` • ${repository.branch}` : ''}
              </p>
            ) : null}
            <p>{statusMessage}</p>
          </div>
        </PopoverContent>
      </Popover>

      <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <ExportDialog open={isExportOpen} onOpenChange={setIsExportOpen} />
    </>
  )
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm transition hover:bg-accent hover:text-accent-foreground',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      {children}
    </button>
  )
}
