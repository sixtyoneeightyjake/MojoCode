import { ToggleWelcome } from '@/components/modals/welcome'
import { VercelDashed } from '@/components/icons/vercel-dashed'
import { cn } from '@/lib/utils'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { GitHubMenu } from '@/components/github/github-menu'

interface Props {
  className?: string
}

export async function Header({ className }: Props) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const email = session?.user.email

  return (
    <header className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center">
        <VercelDashed className="ml-1 md:ml-2.5 mr-1.5" />
        <span className="hidden md:inline text-sm uppercase font-mono font-bold tracking-tight">
          sixtyoneeighty:MojoCode
        </span>
      </div>
      <div className="flex items-center ml-auto space-x-2">
        {email ? (
          <span className="hidden text-xs text-muted-foreground sm:inline-block">{email}</span>
        ) : null}
        <GitHubMenu />
        <SignOutButton />
        <ToggleWelcome />
      </div>
    </header>
  )
}
