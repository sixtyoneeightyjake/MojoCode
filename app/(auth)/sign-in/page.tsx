import { redirect } from 'next/navigation'
import { SignInForm } from '@/components/auth/sign-in-form'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type SearchParams = Record<string, string | string[] | undefined>

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/')
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const errorParam = resolvedSearchParams?.error
  const initialError = Array.isArray(errorParam) ? errorParam[0] : errorParam ?? null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border/70 bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your email, Google, or GitHub account.
          </p>
        </div>
        <SignInForm initialError={initialError} />
      </div>
    </div>
  )
}
