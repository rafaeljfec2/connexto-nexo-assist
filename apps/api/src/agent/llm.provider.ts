import { ScriptedLlmProvider } from './scripted.llm.provider';

export interface LlmMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolCallId?: string;
  readonly name?: string;
}

export interface LlmToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface LlmToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface LlmStepResult {
  readonly content: string | null;
  readonly toolCalls: LlmToolCall[];
  readonly usage?: { readonly promptTokens?: number; readonly completionTokens?: number };
}

export interface LlmProvider {
  readonly name: string;
  complete(input: {
    readonly messages: readonly LlmMessage[];
    readonly tools: readonly LlmToolDefinition[];
    readonly maxTokens: number;
    readonly timeoutMs: number;
  }): Promise<LlmStepResult>;
}

export { ScriptedLlmProvider } from './scripted.llm.provider';

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async complete(input: {
    readonly messages: readonly LlmMessage[];
    readonly tools: readonly LlmToolDefinition[];
    readonly maxTokens: number;
    readonly timeoutMs: number;
  }): Promise<LlmStepResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: input.maxTokens,
          messages: input.messages.map((m) => {
            if (m.role === 'tool') {
              return {
                role: 'tool',
                tool_call_id: m.toolCallId,
                content: m.content,
              };
            }
            return { role: m.role, content: m.content };
          }),
          tools: input.tools.map((t) => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM provider error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              function: { name: string; arguments: string };
            }>;
          };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const message = data.choices?.[0]?.message;
      const toolCalls: LlmToolCall[] = (message?.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: safeJson(tc.function.arguments),
      }));

      return {
        content: message?.content ?? null,
        toolCalls,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export function createLlmProvider(): LlmProvider | null {
  const mode = (process.env.LLM_PROVIDER ?? 'openai').toLowerCase();
  if (mode === 'scripted') {
    return new ScriptedLlmProvider();
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return null;
  }
  return new OpenAiCompatibleProvider(
    key,
    process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  );
}
