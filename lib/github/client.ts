const GITHUB_API_BASE = 'https://api.github.com'

export class GitHubAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string
  ) {
    super(message)
    this.name = 'GitHubAPIError'
  }
}

interface GitHubRequestOptions extends RequestInit {
  token: string
  parseJson?: boolean
}

interface GitHubResponse<T> {
  data: T
  scopes: string[]
  headers: Headers
}

function parseScopeHeader(header: string | null): string[] {
  return header
    ? header
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean)
    : []
}

export async function githubRequest<T = unknown>(
  path: string,
  { token, parseJson = true, headers, ...init }: GitHubRequestOptions
): Promise<GitHubResponse<T>> {
  const response = await fetch(
    path.startsWith('http') ? path : `${GITHUB_API_BASE}${path}`,
    {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'vibe-coding-platform',
        ...headers,
      },
    }
  )

  if (!response.ok) {
    let message = response.statusText
    try {
      const body = await response.json()
      if (body && typeof body.message === 'string') {
        message = body.message
      }
    } catch (error) {
      // ignore json parse errors
    }
    throw new GitHubAPIError(response.status, response.url, message)
  }

  let data: T
  if (!parseJson) {
    data = (null as unknown) as T
  } else if (response.status === 204) {
    data = (null as unknown) as T
  } else {
    data = (await response.json()) as T
  }

  return {
    data,
    scopes: parseScopeHeader(response.headers.get('x-oauth-scopes')),
    headers: response.headers,
  }
}

export async function getGitHubUser(token: string) {
  const { data, scopes } = await githubRequest<{
    login: string
    name: string | null
    email: string | null
  }>('/user', { token })

  return { ...data, scopes }
}

interface CreateRepoPayload {
  name: string
  description?: string | null
  private?: boolean
  auto_init?: boolean
  default_branch?: string
}

export async function createGitHubRepository(
  token: string,
  payload: CreateRepoPayload
) {
  const { data } = await githubRequest<{
    clone_url: string
    ssh_url: string
    html_url: string
    full_name: string
    default_branch: string
  }>('/user/repos', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  })

  return data
}
