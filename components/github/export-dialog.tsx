'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { useGitHubStatus } from '@/components/github/use-github-status'
import { useSandboxStore } from '@/app/state'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { sandboxId, status, mutate } = useGitHubStatus()
  const { repository, setRepository } = useSandboxStore((state) => ({
    repository: state.repository,
    setRepository: state.setRepository,
  }))

  const existingFullName = useMemo(() => {
    if (status?.remoteFullName) return status.remoteFullName
    return repository?.fullName ?? null
  }, [status?.remoteFullName, repository?.fullName])

  const [commitMessage, setCommitMessage] = useState('Update project')
  const [newRepoName, setNewRepoName] = useState('')
  const [newRepoDescription, setNewRepoDescription] = useState('')
  const [newRepoPrivate, setNewRepoPrivate] = useState(true)
  const [branchName, setBranchName] = useState('main')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isExistingRepo = Boolean(status?.isGitRepo && existingFullName)

  useEffect(() => {
    if (status?.branch) {
      setBranchName(status.branch)
    } else if (repository?.branch) {
      setBranchName(repository.branch)
    }
  }, [status?.branch, repository?.branch])

  useEffect(() => {
    if (existingFullName) {
      const [, name] = existingFullName.split('/')
      if (name) {
        setNewRepoName(name)
      }
    }
  }, [existingFullName])

  const exportDisabled = useMemo(() => {
    if (!sandboxId) return true
    if (isExistingRepo) {
      return !status?.hasChanges
    }
    return newRepoName.trim().length === 0
  }, [sandboxId, isExistingRepo, status?.hasChanges, newRepoName])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!sandboxId) {
      setError('Create or import a project before exporting to GitHub.')
      return
    }

    if (isExistingRepo && !status?.hasChanges) {
      setError('There are no changes to push.')
      return
    }

    if (!isExistingRepo && newRepoName.trim().length === 0) {
      setError('Provide a name for the new repository.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = isExistingRepo
        ? {
            mode: 'existing' as const,
            sandboxId,
            commitMessage,
            branch: branchName.trim() || 'main',
            repository: {
              fullName: existingFullName!,
              remoteUrl: status?.remoteUrl ?? repository?.remoteUrl ?? undefined,
            },
          }
        : {
            mode: 'new' as const,
            sandboxId,
            commitMessage,
            repository: {
              name: newRepoName.trim(),
              description: newRepoDescription.trim() || undefined,
              private: newRepoPrivate,
              defaultBranch: branchName.trim() || 'main',
            },
          }

      const response = await fetch('/api/github/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await response.json()

      if (!response.ok) {
        const message = typeof json?.error === 'string' ? json.error : 'Export failed.'
        setError(message)
        toast.error(message)
        return
      }

      if (json.status === 'noop') {
        toast.info(json.message ?? 'No changes to push.')
        onOpenChange(false)
        return
      }

      setRepository({
        fullName: json.repository ?? existingFullName ?? null,
        remoteUrl: json.remoteUrl ?? status?.remoteUrl ?? null,
        branch: json.branch ?? branchName,
      })

      toast.success('Repository exported to GitHub.')
      mutate()
      onOpenChange(false)
    } catch (fetchError) {
      console.error('Failed to export repository', fetchError)
      const message =
        fetchError instanceof Error ? fetchError.message : 'Unable to export the repository.'
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
          <DialogTitle>Export to GitHub</DialogTitle>
          <DialogDescription>
            {isExistingRepo
              ? 'Commit your recent changes and push them to the linked GitHub repository.'
              : 'Create a new GitHub repository and push the current workspace into it.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isExistingRepo ? (
            <div className="space-y-1">
              <p className="text-sm">Connected repository</p>
              <p className="font-mono text-sm text-muted-foreground">{existingFullName}</p>
              <p className="text-xs text-muted-foreground">
                {status?.hasChanges
                  ? 'Unpushed changes detected. Commit message below will be used.'
                  : 'Workspace matches the latest commit. Add changes before exporting.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="repo-name">Repository name</Label>
                <Input
                  id="repo-name"
                  placeholder="my-awesome-project"
                  value={newRepoName}
                  onChange={(event) => setNewRepoName(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="repo-description">Description (optional)</Label>
                <Input
                  id="repo-description"
                  placeholder="Short summary for the repository"
                  value={newRepoDescription}
                  onChange={(event) => setNewRepoDescription(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="repo-private"
                  checked={newRepoPrivate}
                  onCheckedChange={(checked) => setNewRepoPrivate(Boolean(checked))}
                  disabled={isSubmitting}
                />
                <Label htmlFor="repo-private" className="text-sm">
                  Private repository
                </Label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="branch">Branch</Label>
            <Input
              id="branch"
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commit-message">Commit message</Label>
            <Input
              id="commit-message"
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              disabled={isSubmitting}
              required
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
            <Button type="submit" disabled={exportDisabled || isSubmitting}>
              {isSubmitting ? 'Exporting…' : 'Export to GitHub'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
