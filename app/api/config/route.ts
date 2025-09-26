import { NextResponse } from 'next/server'

export async function GET() {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return NextResponse.json({
    status: 'ok',
    config: {
      hasUrl,
      hasKey,
    },
  })
}