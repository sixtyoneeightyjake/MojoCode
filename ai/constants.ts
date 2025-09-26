import { type GatewayModelId } from '@ai-sdk/gateway'

export enum Models {
  
  AnthropicClaude4Sonnet = 'anthropic/claude-4-sonnet',
  GPTOSS120 = 'openai/gpt-oss-120B',
  OpenAIGPT5 = 'openai/gpt-5-codex',
  XaiGrokCodeFast = 'xai/grok-code-fast-1',
  GoogleGeminiPro = 'google/gemini-2.5-pro',
  OpenAIo4mini = 'openai/o4-mini',
  Vercelv0 = 'vercel/v0-1.5-md'
}

export const DEFAULT_MODEL = Models.OpenAIGPT5

export const SUPPORTED_MODELS: GatewayModelId[] = [
 
  Models.AnthropicClaude4Sonnet,
  Models.OpenAIGPT5,
  Models.XaiGrokCodeFast,
  Models.GoogleGeminiPro,
  Models.OpenAIo4mini,
  Models.Vercelv0,
]

export const TEST_PROMPTS = [
  'Generate a Next.js app that allows to list and search Pokemons',
  'Create a landing page for a upcoming nudist paintball event benefiting Nudists for Hugs foundation',
]

export const MODEL_LABELS: Record<Models, string> = {
  [Models.AnthropicClaude4Sonnet]: 'Claude 4 Sonnet',
  [Models.GPTOSS120]: 'gpt-oss-120B',
  [Models.OpenAIGPT5]: 'GPT-5',
  [Models.XaiGrokCodeFast]: 'xAI Grok Code Fast',
  [Models.GoogleGeminiPro]: 'Gemini Pro',
  [Models.OpenAIo4mini]: 'o4-mini',
  [Models.Vercelv0]: 'Vercel v0',
}
