'use client'

import useSWR from 'swr'

export interface GitHubRepositorySummary {
  id: number
  name: string
  fullName: string
  description: string | null
  private: boolean
  defaultBranch: string
  updatedAt: string
  owner: string | null
  htmlUrl: string | null
}

interface RepositoryListResponse {
  page: number
  perPage: number
  hasMore: boolean
  repositories: GitHubRepositorySummary[]
}

async function fetchRepositories(url: string) {
  const response = await fetch(url)
  const json = await response.json()
  if (!response.ok) {
    const message = typeof json?.error === 'string' ? json.error : 'Failed to load repositories.'
    throw new Error(message)
  }
  return json as RepositoryListResponse
}

export function useGitHubRepositories({ enabled }: { enabled: boolean }) {
  const swr = useSWR<RepositoryListResponse>(
    enabled ? '/api/github/repositories?per_page=50' : null,
    fetchRepositories,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  )

  return {
    repositories: swr.data?.repositories ?? [],
    page: swr.data?.page ?? 1,
    perPage: swr.data?.perPage ?? 50,
    hasMore: swr.data?.hasMore ?? false,
    isLoading: swr.isLoading,
    isValidating: swr.isValidating,
    error: swr.error as Error | undefined,
    refresh: () => swr.mutate(),
  }
}

