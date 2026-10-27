import type { LlmProvider, LlmMessage, LlmToolDefinition, LlmStepResult } from './llm.provider';

/**
 * In-process Mastra-shaped agent runtime.
 * The plan places Mastra inside the API process. This facade owns the tool loop
 * contract (read/draft tools only) while the concrete provider may be scripted
 * or OpenAI-compatible (`openai/gpt-4.1-mini` by default).
 */
export class MastraAgent {
  constructor(private readonly provider: LlmProvider) {}

  async step(input: {
    readonly messages: readonly LlmMessage[];
    readonly tools: readonly LlmToolDefinition[];
    readonly maxTokens: number;
    readonly timeoutMs: number;
  }): Promise<LlmStepResult> {
    return this.provider.complete(input);
  }
}
