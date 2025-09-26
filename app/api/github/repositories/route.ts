import { NextResponse } from 'next/server'
import { GitHubAuthError, requireGitHubSession } from '@/lib/github/auth'
import { GitHubAPIError, githubRequest } from '@/lib/github/client'
import { z } from 'zod/v3'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
})

interface GitHubRepositoryResponse {
  id: number
  name: string
  full_name: string
  private: boolean
  description: string | null
  default_branch: string
  updated_at: string
  owner?: {
    login?: string
  }
  html_url?: string
}

function hasNextPage(headers: Headers) {
  const link = headers.get('link')
  if (!link) return false
  return link
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .some((part) => part.includes('rel="next"'))
}

function normaliseScopes(scopes: string[]) {
  return scopes.map((scope) => scope.toLowerCase())
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const query = querySchema.parse({
      page: url.searchParams.get('page') ?? undefined,
      per_page: url.searchParams.get('per_page') ?? undefined,
    })
    const { accessToken } = await requireGitHubSession()

    const { data, scopes, headers } = await githubRequest<GitHubRepositoryResponse[]>(
      `/user/repos?sort=updated&direction=desc&page=${query.page}&per_page=${query.per_page}`,
      { token: accessToken }
    )

    const normalisedScopes = normaliseScopes(scopes)
    const hasRepoScope = normalisedScopes.includes('repo') || normalisedScopes.includes('public_repo')

    if (!hasRepoScope) {
      return NextResponse.json(
        {
          error:
            'Your GitHub login is missing the "repo" scope. Update the Supabase GitHub provider to request it, then sign in again.',
        },
        { status: 403 }
      )
    }

    return NextResponse.json({
      page: query.page,
      perPage: query.per_page,
      hasMore: hasNextPage(headers),
      repositories: data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        owner: repo.owner?.login ?? null,
        htmlUrl: repo.html_url ?? null,
      })),
    })
  } catch (error) {
    if (error instanceof GitHubAuthError) {
      const status = error.code === 'not-authenticated' ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }

    if (error instanceof GitHubAPIError) {
      const status = error.status === 401 ? 401 : error.status === 403 ? 403 : 500
      return NextResponse.json({ error: error.message }, { status })
    }

    console.error('[github-repositories] unexpected failure', error)
    const message =
      error instanceof Error ? error.message : 'Unable to load GitHub repositories at this time.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
