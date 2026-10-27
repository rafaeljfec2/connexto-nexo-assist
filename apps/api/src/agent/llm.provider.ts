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

type AffectedScope = 'self' | 'team' | 'company' | 'unknown';

function lastUserContent(messages: readonly LlmMessage[]): string {
  return [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
}

function usedToolNames(messages: readonly LlmMessage[]): Set<string> {
  return new Set(
    messages.filter((m) => m.role === 'tool').map((m) => m.name).filter((name): name is string => Boolean(name)),
  );
}

function historyMentionsVpn(messages: readonly LlmMessage[]): boolean {
  return messages.some(
    (m) =>
      (m.role === 'user' || m.role === 'assistant') &&
      /\b(vpn|809)\b/i.test(m.content),
  );
}

function assistantAskedImpact(messages: readonly LlmMessage[]): boolean {
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) {
    return false;
  }
  const normalized = lastAssistant.content.toLowerCase();
  return (
    normalized.includes('quem está sendo afetado') ||
    normalized.includes('quem esta sendo afetado') ||
    normalized.includes('quem está afetado')
  );
}

function parseAffectedScope(text: string): AffectedScope | null {
  const normalized = text.toLowerCase();
  if (
    normalized.includes('só eu') ||
    normalized.includes('so eu') ||
    normalized.includes('somente eu') ||
    normalized.includes('apenas eu')
  ) {
    return 'self';
  }
  if (normalized.includes('minha equipe') || normalized.includes('meu time')) {
    return 'team';
  }
  if (normalized.includes('toda a empresa') || normalized.includes('empresa toda')) {
    return 'company';
  }
  if (normalized.includes('não sei') || normalized.includes('nao sei')) {
    return 'unknown';
  }
  return null;
}

function detectSameDayCommitment(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    /reuni[aã]o/.test(normalized) ||
    normalized.includes('compromisso') ||
    normalized.includes('mesmo dia') ||
    /\b\d{1,2}\s*h\b/.test(normalized) ||
    /\b\d{1,2}:\d{2}\b/.test(normalized)
  );
}

function detectWorkStopped(text: string): boolean | null {
  const normalized = text.toLowerCase();
  if (
    normalized.includes('não consigo trabalhar') ||
    normalized.includes('nao consigo trabalhar') ||
    normalized.includes('trabalho parado') ||
    normalized.includes('impede de trabalhar')
  ) {
    return true;
  }
  if (
    normalized.includes('consigo trabalhar') ||
    normalized.includes('tenho alternativa') ||
    normalized.includes('workaround')
  ) {
    return false;
  }
  return null;
}

function extractTicketNumber(text: string): string | null {
  const match = /\b((?:INC|REQ)-\d+)\b/i.exec(text);
  return match?.[1]?.toUpperCase() ?? null;
}

function isTicketSelection(text: string): boolean {
  const number = extractTicketNumber(text);
  if (!number) {
    return false;
  }
  // Selection messages look like "INC-20311 · Notebook não liga" or bare number.
  const normalized = text.trim();
  if (normalized.toUpperCase() === number) {
    return true;
  }
  return normalized.toUpperCase().startsWith(number) && normalized.includes('·');
}

function isStatusQuery(text: string): boolean {
  const normalized = text.toLowerCase();
  if (isTicketSelection(text)) {
    return false;
  }
  return (
    normalized.includes('status') ||
    normalized.includes('prazo') ||
    normalized.includes('meus chamados') ||
    normalized.includes('meu chamado')
  );
}

function isVpnIncident(text: string): boolean {
  const normalized = text.toLowerCase();
  return (normalized.includes('vpn') || normalized.includes('809')) && !isStatusQuery(normalized);
}

function isExplicitCreate(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('criar') ||
    normalized.includes('abrir chamado') ||
    normalized.includes('novo chamado')
  );
}

/**
 * Deterministic demo provider that mirrors the Figma “Novo chamado” usability flow:
 * VPN/809 → list tickets + help → ask impact → prepare_draft (HITL) → confirm.
 */
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
    const lastUser = lastUserContent(input.messages);
    const text = lastUser.toLowerCase();
    const toolResults = input.messages.filter((m) => m.role === 'tool');
    const usedTools = usedToolNames(input.messages);

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

      if (lastTool?.name === 'prepare_draft') {
        return {
          content:
            'Coloquei prioridade alta por causa da reunião — a resposta chega antes das 14h. Confira antes de eu criar:',
          toolCalls: [],
        };
      }

      // Figma turn 1 after tools: summarize findings and ask impact (structured choices in UI).
      if (
        usedTools.has('list_my_tickets') &&
        usedTools.has('search_help') &&
        historyMentionsVpn(input.messages)
      ) {
        return {
          content:
            'Não encontrei chamado aberto de VPN para você. O artigo da central sobre o erro 809 cobre o procedimento básico, mas em Windows 11 ele costuma ser insuficiente. Vou preparar a abertura de um chamado. Quem está sendo afetado?',
          toolCalls: [],
        };
      }

      if (lastTool?.name === 'get_ticket') {
        let overdue = false;
        let updatedAtIso: string | null = null;
        try {
          const parsed: unknown = JSON.parse(lastTool.content);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const row = parsed as Record<string, unknown>;
            const dueAt = typeof row['dueAt'] === 'string' ? Date.parse(row['dueAt']) : NaN;
            const status = String(row['status'] ?? '');
            overdue =
              Number.isFinite(dueAt) && dueAt < Date.now() && status !== 'resolved';
            updatedAtIso =
              typeof row['updatedAt'] === 'string'
                ? row['updatedAt']
                : typeof row['createdAt'] === 'string'
                  ? row['createdAt']
                  : null;
          }
        } catch {
          overdue = false;
        }
        if (overdue) {
          const updatedAt = updatedAtIso ? new Date(updatedAtIso) : new Date(Date.now() - 5 * 86_400_000);
          const days = Math.max(
            1,
            Math.floor((Date.now() - updatedAt.getTime()) / 86_400_000),
          );
          const dayLabel = days === 1 ? '1 dia' : `${days} dias`;
          return {
            content: `Está sem atualização há ${dayLabel}, acima do prazo de 3 dias úteis para prioridade média. Quer que eu chame um analista?`,
            toolCalls: [],
          };
        }
        return {
          content:
            'Consultei o chamado selecionado. Posso explicar o prazo ou complementar se precisar.',
          toolCalls: [],
        };
      }

      if (lastTool?.name === 'list_my_tickets') {
        let openCount = 0;
        try {
          const parsed: unknown = JSON.parse(lastTool.content);
          if (Array.isArray(parsed)) {
            openCount = parsed.length;
          }
        } catch {
          openCount = 0;
        }
        const countLabel =
          openCount === 1 ? '1 chamado aberto' : `${openCount || 3} chamados abertos`;
        return {
          content: `Você tem ${countLabel}. Sobre qual deles quer saber?`,
          toolCalls: [],
        };
      }

      if (lastTool?.name === 'search_help') {
        return {
          content:
            'Encontrei orientação na central de ajuda. Se o procedimento não resolver, posso preparar um chamado.',
          toolCalls: [],
        };
      }
    }

    const selectedNumber = extractTicketNumber(lastUser);
    if (
      selectedNumber &&
      isTicketSelection(lastUser) &&
      !usedTools.has('get_ticket')
    ) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_get_ticket_1',
            name: 'get_ticket',
            arguments: { ticketNumber: selectedNumber },
          },
        ],
      };
    }

    const impactScope = parseAffectedScope(text);
    if (
      impactScope &&
      (assistantAskedImpact(input.messages) || historyMentionsVpn(input.messages)) &&
      !usedTools.has('prepare_draft')
    ) {
      if (impactScope === 'unknown') {
        return {
          content:
            'Sem problema. Quem está sendo afetado: só você, sua equipe ou toda a empresa?',
          toolCalls: [],
        };
      }
      const sameDay = detectSameDayCommitment(text);
      const workStopped = detectWorkStopped(text);
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_draft_impact',
            name: 'prepare_draft',
            arguments: {
              action: 'create',
              title: 'Notebook não conecta na VPN — erro 809',
              description: lastUser,
              category: 'network',
              type: 'incident',
              errorCode: '809',
              affectedScope: impactScope,
              workStopped: workStopped ?? false,
              sameDayCommitment: sameDay,
              hasAlternative: sameDay || workStopped === true ? false : true,
            },
          },
        ],
      };
    }

    if (isVpnIncident(text) && !usedTools.has('list_my_tickets') && !usedTools.has('search_help')) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_tickets_vpn',
            name: 'list_my_tickets',
            arguments: {},
          },
          {
            id: 'call_help_vpn',
            name: 'search_help',
            arguments: { query: 'VPN 809' },
          },
        ],
      };
    }

    if (isStatusQuery(text) && !usedTools.has('list_my_tickets')) {
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

    if (isExplicitCreate(text) && !usedTools.has('prepare_draft')) {
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_draft_1',
            name: 'prepare_draft',
            arguments: {
              action: 'create',
              title: 'Problema reportado no chat',
              description: lastUser,
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
