import 'server-only';

import { env } from '@/lib/env';

/**
 * Provider-agnostic AI interface. Features (analysis, DM generation, follow-ups)
 * depend on this contract, not on a specific SDK — so swapping Anthropic ↔ OpenAI
 * or adding a new model is a one-file change.
 */
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type GenerateOptions = {
  system?: string;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** When set, the provider is asked to return JSON matching this shape. */
  json?: boolean;
};

export type GenerateResult = {
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
};

export interface AiProvider {
  readonly name: 'anthropic' | 'openai';
  generate(options: GenerateOptions): Promise<GenerateResult>;
}

/**
 * Placeholder Anthropic provider. Wire this to `@anthropic-ai/sdk` once the
 * dependency is added; the interface above is what the rest of the app relies on.
 */
class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic' as const;

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    // TODO: call the Anthropic Messages API here.
    return {
      text: '[stubbed AI response — connect the Anthropic SDK in services/ai/provider.ts]',
      model: options.model ?? env.AI_DEFAULT_MODEL,
    };
  }
}

class OpenAiProvider implements AiProvider {
  readonly name = 'openai' as const;

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    // TODO: call the OpenAI Chat Completions / Responses API here.
    return {
      text: '[stubbed AI response — connect the OpenAI SDK in services/ai/provider.ts]',
      model: options.model ?? env.AI_DEFAULT_MODEL,
    };
  }
}

/** Resolve the configured default provider. */
export function getAiProvider(): AiProvider {
  return env.AI_DEFAULT_PROVIDER === 'openai' ? new OpenAiProvider() : new AnthropicProvider();
}
