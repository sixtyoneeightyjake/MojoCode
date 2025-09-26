import { NextResponse } from 'next/server'
import { Sandbox } from '@vercel/sandbox'
import { GitHubAuthError, requireGitHubSession } from '@/lib/github/auth'
import { getGitHubUser } from '@/lib/github/client'
import { z } from 'zod/v3'
import type { CommandFinished } from '@vercel/sandbox'

const bodySchema = z.object({
  sandboxId: z.string().optional(),
  repository: z
    .string()
    .min(3)
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Use the owner/name format.'),
  branch: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9_.\/-]+$/)
    .optional(),
})

const cwd = '/vercel/sandbox'

function script(lines: string[]): string {
  return lines.join(' && ')
}

async function ensureSuccess(commandPromise: Promise<CommandFinished>) {
  const result = await commandPromise
  if (typeof result.exitCode === 'number' && result.exitCode !== 0) {
    const stderr = await result.stderr()
    throw new Error(stderr.trim() || 'Command failed inside the sandbox.')
  }
  return result
}

function normalisePath(path: string) {
  return path.replace(/^\.\//, '')
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  try {
    const { accessToken } = await requireGitHubSession()
    const githubUser = await getGitHubUser(accessToken)
    const scopes = githubUser.scopes.map((scope) => scope.toLowerCase())

    if (!scopes.includes('repo') && !scopes.includes('public_repo')) {
      return NextResponse.json(
        {
          error:
            'Your GitHub login is missing the "repo" scope. Update the Supabase GitHub provider to request it, then sign in again.',
        },
        { status: 403 }
      )
    }

    const sandbox = await (async () => {
      if (parsed.data.sandboxId) {
        return Sandbox.get({ sandboxId: parsed.data.sandboxId })
      }
      return Sandbox.create({ timeout: 600_000 })
    })()

    const authorName = githubUser.name?.trim() || githubUser.login
    const authorEmail = githubUser.email?.trim() || `${githubUser.login}@users.noreply.github.com`

    await ensureSuccess(
      sandbox.runCommand({
        cmd: 'sh',
        args: [
          '-lc',
          script([
            'set -euo pipefail',
            'git config --global credential.helper store',
            'printf "https://x-access-token:${GITHUB_TOKEN}@github.com\n" > ~/.git-credentials',
            'chmod 600 ~/.git-credentials',
            'git config --global user.name "$GIT_AUTHOR_NAME"',
            'git config --global user.email "$GIT_AUTHOR_EMAIL"',
          ]),
        ],
        cwd,
        env: {
          GITHUB_TOKEN: accessToken,
          GIT_AUTHOR_NAME: authorName,
          GIT_AUTHOR_EMAIL: authorEmail,
        },
      })
    )

    const branchFlag = parsed.data.branch ? ` --branch ${parsed.data.branch}` : ''
    await ensureSuccess(
      sandbox.runCommand({
        cmd: 'sh',
        args: [
          '-lc',
          script([
            'set -euo pipefail',
            'rm -rf /tmp/github-import',
            `git clone${branchFlag} https://github.com/${parsed.data.repository}.git /tmp/github-import`,
            'find /vercel/sandbox -mindepth 1 -maxdepth 1 -exec rm -rf {} +',
            'cp -a /tmp/github-import/. /vercel/sandbox/',
            'rm -rf /tmp/github-import',
          ]),
        ],
        cwd,
        env: {
          GITHUB_TOKEN: accessToken,
        },
      })
    )

    const branchResult = await ensureSuccess(
      sandbox.runCommand({
        cmd: 'git',
        args: ['rev-parse', '--abbrev-ref', 'HEAD'],
        cwd,
      })
    )
    const activeBranch = (await branchResult.stdout()).trim()

    const filesResult = await ensureSuccess(
      sandbox.runCommand({
        cmd: 'find',
        args: ['.', '-type', 'f', '-not', '-path', '.git/*', '-not', '-name', '.git'],
        cwd,
      })
    )

    const paths = (await filesResult.stdout())
      .split('\n')
      .map((path) => path.trim())
      .filter((path): path is string => Boolean(path) && path !== '.' && !path.startsWith('./.git'))
      .map(normalisePath)

    return NextResponse.json({
      sandboxId: sandbox.sandboxId,
      repository: {
        fullName: parsed.data.repository,
        remoteUrl: `https://github.com/${parsed.data.repository}.git`,
      },
      branch: activeBranch || parsed.data.branch || null,
      paths,
    })
  } catch (error) {
    if (error instanceof GitHubAuthError) {
      const status = error.code === 'not-authenticated' ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }

    const message = error instanceof Error ? error.message : 'Unable to import the repository.'
    const status = /not found|404/i.test(message) ? 404 : 500

    console.error('[github-import] unexpected failure', error)
    return NextResponse.json({ error: message }, { status })
  }
}
