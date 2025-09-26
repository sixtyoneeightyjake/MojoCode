import { NextResponse } from 'next/server'
import { Sandbox } from '@vercel/sandbox'
import { GitHubAuthError, requireGitHubSession } from '@/lib/github/auth'
import { createGitHubRepository, getGitHubUser } from '@/lib/github/client'
import { z } from 'zod/v3'
import type { CommandFinished } from '@vercel/sandbox'

const cwd = '/vercel/sandbox'

const baseSchema = z.object({
  sandboxId: z.string(),
  commitMessage: z.string().min(1).max(500),
})

const existingSchema = baseSchema.extend({
  mode: z.literal('existing'),
  repository: z.object({
    fullName: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
    remoteUrl: z.string().url().optional(),
  }),
  branch: z.string().min(1).max(255).regex(/^[A-Za-z0-9_.\/-]+$/),
})

const newRepoSchema = baseSchema.extend({
  mode: z.literal('new'),
  repository: z.object({
    name: z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/),
    description: z.string().max(256).optional(),
    private: z.boolean().optional(),
    defaultBranch: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[A-Za-z0-9_.\/-]+$/)
      .optional(),
  }),
})

type ExportPayload = z.infer<typeof existingSchema> | z.infer<typeof newRepoSchema>

function script(lines: string[]) {
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

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  let payload: ExportPayload
  const parseExisting = existingSchema.safeParse(json)
  if (parseExisting.success) {
    payload = parseExisting.data
  } else {
    const parseNew = newRepoSchema.safeParse(json)
    if (!parseNew.success) {
      return NextResponse.json(
        { error: parseNew.error.message ?? 'Invalid payload' },
        { status: 400 }
      )
    }
    payload = parseNew.data
  }

  try {
    const { accessToken } = await requireGitHubSession()
    const githubUser = await getGitHubUser(accessToken)
    const scopes = githubUser.scopes.map((scope) => scope.toLowerCase())

    if (!scopes.includes('repo')) {
      return NextResponse.json(
        {
          error:
            'The GitHub token lacks the "repo" scope. Update your Supabase provider to request it and sign in again.',
        },
        { status: 403 }
      )
    }

    const sandbox = await Sandbox.get({ sandboxId: payload.sandboxId })

    const authorName = githubUser.name?.trim() || githubUser.login
    const authorEmail = githubUser.email?.trim() || `${githubUser.login}@users.noreply.github.com`

    const runShell = (lines: string[], env?: Record<string, string>) =>
      ensureSuccess(
        sandbox.runCommand({
          cmd: 'sh',
          args: ['-lc', script(lines)],
          cwd,
          env,
        })
      )
    const runGit = (args: string[], env?: Record<string, string>) =>
      ensureSuccess(
        sandbox.runCommand({
          cmd: 'git',
          args,
          cwd,
          env,
        })
      )

    await runShell([
      'set -euo pipefail',
      'git config --global credential.helper store',
      'printf "https://x-access-token:${GITHUB_TOKEN}@github.com\n" > ~/.git-credentials',
      'chmod 600 ~/.git-credentials',
      'git config --global user.name "$GIT_AUTHOR_NAME"',
      'git config --global user.email "$GIT_AUTHOR_EMAIL"',
    ], {
      GITHUB_TOKEN: accessToken,
      GIT_AUTHOR_NAME: authorName,
      GIT_AUTHOR_EMAIL: authorEmail,
    })

    let remoteUrl: string
    let branchName: string

    if (payload.mode === 'new') {
      const repo = await createGitHubRepository(accessToken, {
        name: payload.repository.name,
        description: payload.repository.description ?? null,
        private: payload.repository.private ?? false,
      })

      remoteUrl = repo.clone_url
      branchName = payload.repository.defaultBranch || repo.default_branch || 'main'
    } else {
      remoteUrl = payload.repository.remoteUrl ?? `https://github.com/${payload.repository.fullName}.git`
      branchName = payload.branch
    }

    await runShell(['set -euo pipefail', 'git rev-parse --is-inside-work-tree || git init'])

    await sandbox
      .runCommand({
        cmd: 'git',
        args: ['remote', 'remove', 'origin'],
        cwd,
      })
      .catch(() => null)

    await runGit(['remote', 'add', 'origin', remoteUrl])

    await runGit(['add', '--all'])

    const commitResult = await sandbox.runCommand({
      cmd: 'git',
      args: ['commit', '-m', payload.commitMessage],
      cwd,
    })

    if (typeof commitResult.exitCode === 'number' && commitResult.exitCode !== 0) {
      const stderr = await commitResult.stderr()
      if (/nothing to commit/i.test(stderr)) {
        return NextResponse.json({ status: 'noop', message: 'Nothing to commit.' })
      }
      throw new Error(stderr.trim() || 'Commit failed.')
    }

    let currentBranch = ''
    try {
      const branchRes = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'])
      currentBranch = (await branchRes.stdout()).trim()
    } catch {
      currentBranch = ''
    }

    if (!currentBranch) {
      await runGit(['checkout', '-B', branchName])
      currentBranch = branchName
    } else if (currentBranch !== branchName) {
      try {
        await runGit(['checkout', branchName])
      } catch {
        await runGit(['checkout', '-b', branchName])
      }
    }

    await runGit(['push', '-u', 'origin', branchName], { GITHUB_TOKEN: accessToken })

    return NextResponse.json({
      status: 'ok',
      repository:
        payload.mode === 'existing'
          ? payload.repository.fullName
          : `${githubUser.login}/${payload.repository.name}`,
      branch: branchName,
      remoteUrl,
    })
  } catch (error) {
    if (error instanceof GitHubAuthError) {
      const status = error.code === 'not-authenticated' ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }

    console.error('[github-export] unexpected failure', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to export the repository.' },
      { status: 500 }
    )
  }
}
