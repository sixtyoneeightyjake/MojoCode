import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

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

interface ProviderTokens {
  accessToken: string | null
  refreshToken: string | null
}

interface GitHubSessionResult {
  accessToken: string
  refreshToken: string | null
  user: User
}

function extractProviderTokens(identity: Identity | null): ProviderTokens {
  const identityData = identity?.identity_data ?? {}

  const accessToken =
    typeof identityData['access_token'] === 'string'
      ? (identityData['access_token'] as string)
      : null

  const refreshToken =
    typeof identityData['refresh_token'] === 'string'
      ? (identityData['refresh_token'] as string)
      : null

  return { accessToken, refreshToken }
}

async function fetchAdminIdentity(userId: string) {
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) {
    return null
  }
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)

  if (error) {
    console.error('[github-auth] Failed to load user via admin client', error)
    return null
  }

  const adminIdentity =
    (data?.user as unknown as { identities?: Identity[] | null })?.identities?.find(
      (identity) => identity?.provider === 'github'
    ) ?? null

  return adminIdentity
}

async function fetchSessionTokens(supabase: SupabaseClient): Promise<ProviderTokens> {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('[github-auth] Failed to read session while fetching provider token', error)
      return { accessToken: null, refreshToken: null }
    }

    const session = data.session
    if (!session) {
      return { accessToken: null, refreshToken: null }
    }

    return {
      accessToken:
        typeof session.provider_token === 'string' ? (session.provider_token as string) : null,
      refreshToken:
        typeof session.provider_refresh_token === 'string'
          ? (session.provider_refresh_token as string)
          : null,
    }
  } catch (error) {
    console.error('[github-auth] Unexpected error reading provider token from session', error)
    return { accessToken: null, refreshToken: null }
  }
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

  let { accessToken: providerToken, refreshToken } = await fetchSessionTokens(supabase)

  if (!providerToken) {
    const identityTokens = extractProviderTokens(githubIdentity)
    providerToken = identityTokens.accessToken
    refreshToken = refreshToken ?? identityTokens.refreshToken
  }

  if (!providerToken) {
    const adminIdentity = await fetchAdminIdentity(user.id)
    if (adminIdentity) {
      const adminTokens = extractProviderTokens(adminIdentity)
      providerToken = adminTokens.accessToken
      refreshToken = refreshToken ?? adminTokens.refreshToken
    }
  }

  if (!providerToken) {
    throw new GitHubAuthError(
      'missing-access-token',
      'The GitHub provider token is not available. Reauthenticate with GitHub and ensure the required scopes are granted.'
    )
  }

  return {
    accessToken: providerToken,
    refreshToken,
    user,
  }
}
