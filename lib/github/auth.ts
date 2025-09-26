import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export type GitHubAuthErrorCode =
  | 'not-authenticated'
  | 'github-not-connected'
  | 'missing-access-token'

export class GitHubAuthError extends Error {
  constructor(public readonly code: GitHubAuthErrorCode, message: string) {
    super(message)
    this.name = 'GitHubAuthError'
  }
}

type Identity = {
  provider?: string | null
  identity_data?: Record<string, unknown> | null
}

interface GitHubSessionResult {
  accessToken: string
  refreshToken: string | null
  user: User
}

export async function requireGitHubSession(): Promise<GitHubSessionResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw new GitHubAuthError('not-authenticated', error.message)
  }

  if (!user) {
    throw new GitHubAuthError('not-authenticated', 'You must be signed in to access GitHub integrations.')
  }

  const identities = (user as unknown as { identities?: Identity[] | null })?.identities ?? []
  const githubIdentity = identities.find((identity) => identity?.provider === 'github') ?? null

  if (!githubIdentity) {
    throw new GitHubAuthError(
      'github-not-connected',
      'A GitHub-connected session is required. Please sign in with GitHub to continue.'
    )
  }

  const identityData = githubIdentity.identity_data ?? {}
  const providerToken =
    typeof identityData['access_token'] === 'string'
      ? (identityData['access_token'] as string)
      : null

  if (!providerToken) {
    throw new GitHubAuthError(
      'missing-access-token',
      'The GitHub provider token is not available. Reauthenticate with GitHub and ensure the required scopes are granted.'
    )
  }

  return {
    accessToken: providerToken,
    refreshToken:
      typeof identityData['refresh_token'] === 'string'
        ? (identityData['refresh_token'] as string)
        : null,
    user,
  }
}
