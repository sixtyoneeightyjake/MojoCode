import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Session } from '@supabase/supabase-js'

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

type SessionWithProviderToken = Session & {
  provider_token?: string | null
  provider_refresh_token?: string | null
}

type Identity = {
  provider?: string | null
  identity_data?: Record<string, unknown> | null
}

interface GitHubSessionResult {
  accessToken: string
  refreshToken: string | null
  session: SessionWithProviderToken
}

export async function requireGitHubSession(): Promise<GitHubSessionResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw new GitHubAuthError('not-authenticated', error.message)
  }

  if (!session) {
    throw new GitHubAuthError('not-authenticated', 'You must be signed in to access GitHub integrations.')
  }

  const extended = session as SessionWithProviderToken
  const identities = (extended.user as unknown as { identities?: Identity[] | null })?.identities ?? []
  const githubIdentity = identities.find((identity) => identity?.provider === 'github') ?? null

  if (!githubIdentity) {
    throw new GitHubAuthError(
      'github-not-connected',
      'A GitHub-connected session is required. Please sign in with GitHub to continue.'
    )
  }

  const providerToken =
    extended.provider_token ??
    (typeof githubIdentity.identity_data?.['access_token'] === 'string'
      ? (githubIdentity.identity_data['access_token'] as string)
      : null)

  if (!providerToken) {
    throw new GitHubAuthError(
      'missing-access-token',
      'The GitHub provider token is not available. Reauthenticate with GitHub and ensure the required scopes are granted.'
    )
  }

  return {
    accessToken: providerToken,
    refreshToken: extended.provider_refresh_token ?? null,
    session: extended,
  }
}
