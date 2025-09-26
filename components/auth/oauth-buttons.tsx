'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { GithubIcon } from '@/components/icons/github'
import { GoogleIcon } from '@/components/icons/google'

type Provider = 'google' | 'github'

interface OAuthButtonsProps {
  redirectPath?: string
  onError?: (message: string | null) => void
}

const providerConfig: Record<Provider, { label: string; icon?: React.ComponentType<{ className?: string }> }> = {
  google: {
    label: 'Continue with Google',
    icon: GoogleIcon,
  },
  github: {
    label: 'Continue with GitHub',
    icon: GithubIcon,
  },
}

export function OAuthButtons({ redirectPath = '/', onError }: OAuthButtonsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null)

  const handleSignIn = async (provider: Provider) => {
    try {
      onError?.(null)
      setLoadingProvider(provider)

      const origin = window.location.origin
      const callbackUrl = new URL('/auth/callback', origin)
      if (redirectPath && redirectPath !== '/') {
        callbackUrl.searchParams.set('next', redirectPath)
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl.toString(),
        },
      })

      if (error) {
        onError?.(error.message)
        setLoadingProvider(null)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      onError?.(message)
      setLoadingProvider(null)
    }
  }

  return (
    <div className="grid gap-2">
      {(Object.keys(providerConfig) as Provider[]).map((provider) => {
        const config = providerConfig[provider]
        const Icon = config.icon
        const isLoading = loadingProvider === provider

        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className="w-full"
            disabled={isLoading}
            onClick={() => handleSignIn(provider)}
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
            <span>{config.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
