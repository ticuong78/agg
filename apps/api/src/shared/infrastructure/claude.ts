import Anthropic from '@anthropic-ai/sdk';
import type { ConfigService } from '@nestjs/config';

/** Model per task, from the environment. No model name is hard-coded anywhere else. */
export interface ClaudeModels {
  /** Reads documents for accounts (layout, scans, images). */
  reader: string;
  /** Reads text documents for guests: cheaper, text layer only. */
  guestReader: string;
  /** Rewrites one section. */
  writer: string;
  /** Proposes tests and computes their outputs with code execution. */
  testCases: string;
}

/**
 * Shared access to the Claude API for the AI adapters. Disabled when ANTHROPIC_API_KEY is not configured:
 * the adapters then report themselves unavailable and the product falls back (rule-based parser) or
 * says the feature is off, never crashes.
 */
export class ClaudeClient {
  constructor(
    readonly api: Anthropic | null,
    readonly models: ClaudeModels,
  ) {}

  get enabled(): boolean {
    return this.api !== null;
  }

  /** Model plus the server-side refusal fallback. Haiku has no server-side fallback, so it gets none. */
  static target(model: string): {
    model: string;
    betas?: Anthropic.Beta.AnthropicBeta[];
    fallbacks?: Anthropic.Beta.Messages.BetaFallbacksParam;
  } {
    if (model.startsWith('claude-haiku')) return { model };
    return { model, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
  }
}

export function createClaudeClient(config: ConfigService): ClaudeClient {
  const apiKey = config.get<string>('ANTHROPIC_API_KEY');
  const main = config.get<string>('CLAUDE_MODEL') || 'claude-sonnet-5-5';
  return new ClaudeClient(apiKey ? new Anthropic({ apiKey, maxRetries: 2 }) : null, {
    reader: main,
    guestReader: config.get<string>('CLAUDE_GUEST_MODEL') || 'claude-haiku-5-5',
    writer: config.get<string>('CLAUDE_WRITER_MODEL') || main,
    testCases: config.get<string>('CLAUDE_TESTGEN_MODEL') || main,
  });
}
