'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useGitHubStatus } from '@/components/github/use-github-status'
import { useGitHubRepositories } from '@/components/github/use-github-repositories'
import { useSandboxStore } from '@/app/state'
import { cn } from '@/lib/utils'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { sandboxId, mutate } = useGitHubStatus()
  const replacePaths = useSandboxStore((state) => state.replacePaths)
  const setSandboxId = useSandboxStore((state) => state.setSandboxId)
  const setRepository = useSandboxStore((state) => state.setRepository)

  const {
    repositories,
    isLoading: isLoadingRepos,
    isValidating,
    error: repositoriesError,
    refresh,
  } = useGitHubRepositories({ enabled: open })

  const [search, setSearch] = useState('')
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [branch, setBranch] = useState('')
  const [lastAutoAssignedRepoId, setLastAutoAssignedRepoId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedRepo = useMemo(
    () => repositories.find((repo) => repo.id === selectedRepoId) ?? null,
    [repositories, selectedRepoId]
  )

  const filteredRepositories = useMemo(() => {
    if (!search.trim()) return repositories
    const query = search.trim().toLowerCase()
    return repositories.filter((repo) => {
      const haystack = [repo.fullName, repo.name, repo.description ?? '']
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [repositories, search])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedRepoId(null)
      setBranch('')
      setError(null)
      setIsSubmitting(false)
      setLastAutoAssignedRepoId(null)
    }
  }, [open])

  useEffect(() => {
    if (selectedRepo) {
      if (selectedRepo.id !== lastAutoAssignedRepoId) {
        setBranch(selectedRepo.defaultBranch || 'main')
        setLastAutoAssignedRepoId(selectedRepo.id)
      }
      setError(null)
    } else {
      setBranch('')
      setLastAutoAssignedRepoId(null)
    }
  }, [selectedRepo, lastAutoAssignedRepoId])

  const handleImport = async () => {
    if (!selectedRepo) {
      setError('Select a repository to import.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/github/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandboxId,
          repository: selectedRepo.fullName,
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
        ? payload.paths.filter(
            (path: unknown): path is string => typeof path === 'string' && path.length > 0
          )
        : []

      replacePaths(safePaths)
      setRepository({
        fullName: payload.repository?.fullName ?? selectedRepo.fullName,
        remoteUrl: payload.repository?.remoteUrl ?? null,
        branch: payload.branch ?? (branch.trim() || selectedRepo.defaultBranch || null),
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from GitHub</DialogTitle>
          <DialogDescription>
            Select one of your GitHub repositories to clone into the active workspace. Private
            repositories require the `repo` scope when signing in with GitHub.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              autoFocus
              placeholder="Search repositories"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={isLoadingRepos}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => refresh()}
              disabled={isLoadingRepos}
            >
              Refresh
            </Button>
            {isValidating && !isLoadingRepos ? (
              <p className="text-xs text-muted-foreground">Refreshing…</p>
            ) : null}
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border border-input">
            {isLoadingRepos ? (
              <div className="flex h-40 items-center justify-center p-6 text-sm text-muted-foreground">
                Loading repositories…
              </div>
            ) : repositoriesError ? (
              <div className="space-y-3 p-6">
                <p className="text-sm text-destructive">{repositoriesError.message}</p>
                <Button type="button" size="sm" onClick={() => refresh()}>
                  Try again
                </Button>
              </div>
            ) : filteredRepositories.length > 0 ? (
              <ul className="divide-y border-t border-input/50">
                {filteredRepositories.map((repo) => (
                  <li key={repo.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRepoId(repo.id)}
                      aria-pressed={selectedRepo?.id === repo.id}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-accent',
                        selectedRepo?.id === repo.id ? 'bg-accent/60' : undefined
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{repo.fullName}</p>
                        {repo.description ? (
                          <p className="mt-1 overflow-hidden text-ellipsis text-xs text-muted-foreground">
                            {repo.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-muted-foreground">
                          Updated {new Date(repo.updatedAt).toLocaleString()} • Default branch{' '}
                          {repo.defaultBranch}
                        </p>
                      </div>
                      <Badge variant={repo.private ? 'secondary' : 'outline'}>
                        {repo.private ? 'Private' : 'Public'}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-40 items-center justify-center p-6 text-sm text-muted-foreground">
                {repositories.length === 0
                  ? 'No repositories found on your GitHub account.'
                  : 'No repositories match your search.'}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {selectedRepo ? (
              <div className="space-y-1 rounded-md border bg-muted/50 p-3 text-sm">
                <p className="font-medium">{selectedRepo.fullName}</p>
                {selectedRepo.description ? (
                  <p className="text-xs text-muted-foreground">{selectedRepo.description}</p>
                ) : null}
                {selectedRepo.htmlUrl ? (
                  <a
                    href={selectedRepo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    View on GitHub
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a repository above to configure the import.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                placeholder="main"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                disabled={!selectedRepo || isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                {selectedRepo
                  ? 'Leave blank to use the repository\'s default branch.'
                  : 'Default branch will be used once a repository is selected.'}
              </p>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!selectedRepo || isSubmitting}
          >
            {isSubmitting ? 'Importing…' : 'Import repository'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
