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

export class ScriptedLlmProvider implements LlmProvider {
  readonly name = 'scripted';
  callCount = 0;
  /** Test seam: keep requesting tools with unique args to exercise the step ceiling. */
  forceToolLoop = false;

  async complete(input: {
    readonly messages: readonly LlmMessage[];
    readonly tools: readonly LlmToolDefinition[];
    readonly maxTokens: number;
    readonly timeoutMs: number;
  }): Promise<LlmStepResult> {
    this.callCount += 1;
    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
    const text = (lastUser?.content ?? '').toLowerCase();
    const toolResults = input.messages.filter((m) => m.role === 'tool');
    const usedTools = new Set(toolResults.map((m) => m.name).filter(Boolean));

    if (this.forceToolLoop) {
      return {
        content: null,
        toolCalls: [
          {
            id: `call_help_loop_${this.callCount}`,
            name: 'search_help',
            arguments: { query: `VPN 809 step ${this.callCount}` },
          },
        ],
      };
    }

    if (toolResults.length > 0) {
      const lastTool = toolResults[toolResults.length - 1];
      if (lastTool?.name === 'search_help') {
        return {
          content:
            'Encontrei orientação na central de ajuda sobre VPN/erro 809. Se o procedimento não resolver, posso preparar um chamado.',
          toolCalls: [],
        };
      }
      if (lastTool?.name === 'list_my_tickets') {
        return {
          content:
            'Listei os seus chamados. Se algum estiver atrasado, posso explicar o prazo e oferecer falar com um analista.',
          toolCalls: [],
        };
      }
      if (lastTool?.name === 'prepare_draft') {
        return {
          content: 'Rascunho preparado. Confirme a versão exibida para eu gravar no serviço de chamados.',
          toolCalls: [],
        };
      }
    }

    if ((text.includes('vpn') || text.includes('809')) && !usedTools.has('search_help')) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_help_1',
            name: 'search_help',
            arguments: { query: 'VPN 809' },
          },
        ],
      };
    }

    if (
      (text.includes('chamado') ||
        text.includes('prazo') ||
        text.includes('inc-') ||
        text.includes('status')) &&
      !usedTools.has('list_my_tickets')
    ) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_tickets_1',
            name: 'list_my_tickets',
            arguments: {},
          },
        ],
      };
    }

    if (
      (text.includes('criar') ||
        text.includes('abrir chamado') ||
        text.includes('novo chamado')) &&
      !usedTools.has('prepare_draft')
    ) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_draft_1',
            name: 'prepare_draft',
            arguments: {
              action: 'create',
              title: 'Problema reportado no chat',
              description: lastUser?.content ?? '',
              category: 'other',
              type: 'incident',
              affectedScope: 'self',
              workStopped: false,
              sameDayCommitment: false,
              hasAlternative: true,
            },
          },
        ],
      };
    }

    if (
      text.includes('quero falar com um analista') ||
      text.includes('falar com um analista')
    ) {
      return {
        content:
          'Entendi que você quer falar com um analista. Vou transferir esta conversa para a fila humana.',
        toolCalls: [],
      };
    }

    return {
      content:
        'Posso ajudar com a central de ajuda, consulta de chamados ou abertura de um novo chamado. O que você precisa?',
      toolCalls: [],
    };
  }
}

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
