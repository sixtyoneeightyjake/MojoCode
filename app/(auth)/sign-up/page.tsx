import { redirect } from 'next/navigation'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function SignUpPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border/70 bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Start building with the Vibe Coding Platform using Google, GitHub, or email.
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  )
}
