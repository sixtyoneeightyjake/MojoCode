import { NextResponse } from 'next/server'
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/route'

function getValidRedirectPath(nextParam: string | null) {
  if (!nextParam) {
    return '/'
  }

  if (!nextParam.startsWith('/')) {
    return '/'
  }

  return nextParam
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error_description')
  const redirectTo = getValidRedirectPath(requestUrl.searchParams.get('next'))

  if (error) {
    const redirectUrl = new URL('/sign-in', requestUrl.origin)
    redirectUrl.searchParams.set('error', error)
    return NextResponse.redirect(redirectUrl)
  }

  if (code) {
    const supabase = await createSupabaseRouteHandlerClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      const redirectUrl = new URL('/sign-in', requestUrl.origin)
      redirectUrl.searchParams.set('error', exchangeError.message)
      return NextResponse.redirect(redirectUrl)
    }
  }

  const targetUrl = new URL(redirectTo, requestUrl.origin)
  return NextResponse.redirect(targetUrl)
}
