import { SUPPORTED_MODELS, MODEL_LABELS } from '@/ai/constants'
import { getAvailableModels } from '@/ai/gateway'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const allModels = await getAvailableModels()
    return NextResponse.json({
      models: allModels.filter((model) => SUPPORTED_MODELS.includes(model.id)),
    })
  } catch (err) {
    // If the gateway is unreachable or fails, return a sensible fallback
    // so the UI can still show supported models instead of an error state.
    // Log the error in non-production to aid debugging while keeping response stable.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[models] gateway fetch failed', err)
    }
    return NextResponse.json({
      models: SUPPORTED_MODELS.map((id) => ({ id, name: MODEL_LABELS[id as unknown as import('@/ai/constants').Models] ?? id })),
    })
  }
}
