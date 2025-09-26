'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { useSandboxStore } from '@/app/state'

interface GitHubStatusResponse {
  sandboxId: string
  isGitRepo: boolean
  hasChanges: boolean
  branch: string | null
  remoteUrl: string | null
  remoteFullName: string | null
  trackedFiles: string[]
}

async function fetcher(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch GitHub status')
  }
  return (await response.json()) as GitHubStatusResponse
}

export function useGitHubStatus() {
  const sandboxId = useSandboxStore((state) => state.sandboxId)
  const swr = useSWR(sandboxId ? `/api/github/status?sandboxId=${sandboxId}` : null, fetcher, {
    refreshInterval: 10_000,
  })

  const mutate = useCallback(() => swr.mutate(), [swr])

  return {
    sandboxId,
    status: swr.data,
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    mutate,
  }
}
