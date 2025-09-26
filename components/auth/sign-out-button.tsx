'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        throw error
      }

      router.replace('/sign-in')
      router.refresh()
    } catch (error) {
      console.error('Failed to sign out', error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to sign out. Please try again.'
      toast.error(message)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isSigningOut}
      onClick={handleSignOut}
      className="gap-1.5"
    >
      {isSigningOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      <span>Sign out</span>
    </Button>
  )
}
