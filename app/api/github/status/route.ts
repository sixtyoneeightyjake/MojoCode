import { NextResponse } from 'next/server'
import { Sandbox } from '@vercel/sandbox'
import { z } from 'zod/v3'

const querySchema = z.object({
  sandboxId: z.string(),
})

export async function GET(request: Request) {
  const parsedQuery = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  )

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'sandboxId query parameter is required' },
      { status: 400 }
    )
  }

  try {
    const sandbox = await Sandbox.get({ sandboxId: parsedQuery.data.sandboxId })
    const cwd = '/vercel/sandbox'

    const git = async (args: string[]) => {
      const result = await sandbox.runCommand({
        cmd: 'git',
        args,
        cwd,
      })
      return result.stdout()
    }

    const isRepo = await (async () => {
      try {
        const output = await git(['rev-parse', '--is-inside-work-tree'])
        return output.trim() === 'true'
      } catch (error) {
        return false
      }
    })()

    let hasChanges = false
    let branch: string | null = null
    let remoteUrl: string | null = null
    let remoteFullName: string | null = null
    let trackedFiles: string[] = []

    if (isRepo) {
      try {
        const statusOutput = await git(['status', '--porcelain'])
        hasChanges = statusOutput.trim().length > 0
      } catch (error) {
        hasChanges = false
      }

      try {
        const branchOutput = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
        branch = branchOutput.trim()
      } catch (error) {
        branch = null
      }

      try {
        const remoteOutput = await git(['config', '--get', 'remote.origin.url'])
        remoteUrl = remoteOutput.trim() || null
        if (remoteUrl && remoteUrl.includes('github.com')) {
          const normalised = remoteUrl
            .replace(/\.git$/, '')
            .replace(/^https?:\/\/github\.com\//, '')
            .replace(/^git@github\.com:/, '')
          remoteFullName = normalised
        } else {
          remoteFullName = null
        }
      } catch (error) {
        remoteUrl = null
        remoteFullName = null
      }

      try {
        const lsFiles = await git(['ls-files'])
        trackedFiles = lsFiles
          .split('\n')
          .map((file) => file.trim())
          .filter(Boolean)
      } catch (error) {
        trackedFiles = []
      }
    }

    return NextResponse.json({
      sandboxId: parsedQuery.data.sandboxId,
      isGitRepo: isRepo,
      hasChanges,
      branch,
      remoteUrl,
      remoteFullName,
      trackedFiles,
    })
  } catch (error) {
    console.error('[github-status] Failed to inspect sandbox', error)
    return NextResponse.json({ error: 'Unable to inspect sandbox Git status.' }, { status: 500 })
  }
}
