'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useGitHubStatus } from '@/components/github/use-github-status'
import { useSandboxStore } from '@/app/state'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function normaliseRepositoryInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  let normalised = trimmed
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '')

  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalised)) {
    return normalised
  }

  return null
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { sandboxId, mutate } = useGitHubStatus()
  const replacePaths = useSandboxStore((state) => state.replacePaths)
  const setSandboxId = useSandboxStore((state) => state.setSandboxId)
  const setRepository = useSandboxStore((state) => state.setRepository)

  const [repository, setRepositoryInput] = useState('')
  const [branch, setBranch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValidRepo = useMemo(() => normaliseRepositoryInput(repository) !== null, [repository])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const repo = normaliseRepositoryInput(repository)
    if (!repo) {
      setError('Use the owner/repository format or a GitHub URL.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/github/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandboxId,
          repository: repo,
          branch: branch.trim() || undefined,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Import failed. Confirm you granted GitHub repo access.'
        setError(message)
        toast.error(message)
        return
      }

      if (!sandboxId || sandboxId !== payload.sandboxId) {
        setSandboxId(payload.sandboxId)
      }

      const safePaths: string[] = Array.isArray(payload.paths)
        ? payload.paths.filter((path: unknown): path is string => typeof path === 'string' && path.length > 0)
        : []

      replacePaths(safePaths)
      setRepository({
        fullName: payload.repository?.fullName ?? repo,
        remoteUrl: payload.repository?.remoteUrl ?? null,
        branch: payload.branch ?? (branch.trim() || null),
      })

      toast.success('Repository imported successfully.')
      mutate()
      onOpenChange(false)
    } catch (fetchError) {
      console.error('Failed to import repository', fetchError)
      const message =
        fetchError instanceof Error ? fetchError.message : 'Unable to import the repository.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import from GitHub</DialogTitle>
          <DialogDescription>
            Clone one of your repositories into the active workspace. Private
            repositories require the `repo` scope when signing in with GitHub.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="repository">Repository</Label>
            <Input
              id="repository"
              autoFocus
              placeholder="owner/repository or full URL"
              value={repository}
              onChange={(event) => setRepositoryInput(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch">Branch (optional)</Label>
            <Input
              id="branch"
              placeholder="main"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValidRepo || isSubmitting}>
              {isSubmitting ? 'Importing…' : 'Import repository'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
