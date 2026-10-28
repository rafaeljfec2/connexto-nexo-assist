import {
  buildTicketListIntro,
  inferPrioritySignalsFromText,
} from '@nexo-assist/domain';
import {
  lastAssistantAskedImpact,
  parseAffectedScope,
} from '../intents/impact-answer';
import type {
  LlmMessage,
  LlmProvider,
  LlmStepResult,
  LlmToolDefinition,
} from './llm.provider';
import {
  requestsAnalystTransfer,
  TRANSFER_CONFIRMATION_TEXT,
} from '../intents/transfer-intent';

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
  // Scripted LLM messages are oldest-first; convert to newest-first for the helper.
  return lastAssistantAskedImpact([...messages].reverse());
}

function detectSameDayCommitment(text: string): boolean {
  return inferPrioritySignalsFromText(text).sameDayCommitment === true;
}

function detectWorkStopped(text: string): boolean | null {
  return inferPrioritySignalsFromText(text).workStopped;
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

function isAddInformationRequest(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const asksAddInfo =
    normalized.includes('adicionar informacao') ||
    normalized.includes('acrescentar informacao') ||
    /\badicionar info\b/.test(normalized);
  return asksAddInfo && /\b(?:inc|req)-\d+\b/i.test(text);
}

function isComplementPrompt(content: string): boolean {
  const normalized = content.toLowerCase();
  return (
    normalized.includes('qual informação deseja acrescentar') ||
    normalized.includes('qual informacao deseja acrescentar') ||
    normalized.includes('o que deseja acrescentar') ||
    normalized.includes('informação para acrescentar') ||
    normalized.includes('informacao para acrescentar')
  );
}

function assistantAskedComplement(messages: readonly LlmMessage[]): boolean {
  // Scan recent assistants — a tool-call turn may insert an empty assistant after the prompt.
  for (const message of [...messages].reverse()) {
    if (message.role !== 'assistant' || !message.content.trim()) {
      continue;
    }
    return isComplementPrompt(message.content);
  }
  return false;
}

function ticketNumberFromHistory(messages: readonly LlmMessage[]): string | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue;
    }
    const number = extractTicketNumber(message.content);
    if (number) {
      return number;
    }
  }
  return null;
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
        // handlePrepareDraft already sets the HITL confirmation text; keep a create fallback.
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
        let ticketId: string | null = null;
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
            ticketId = typeof row['id'] === 'string' ? row['id'] : null;
          }
        } catch {
          overdue = false;
        }

        if (assistantAskedComplement(input.messages) && ticketId && !usedTools.has('prepare_draft')) {
          return {
            content: null,
            toolCalls: [
              {
                id: 'call_draft_complement',
                name: 'prepare_draft',
                arguments: {
                  action: 'update',
                  ticketId,
                  description: lastUser,
                },
              },
            ],
          };
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
        return {
          content: buildTicketListIntro(openCount),
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

    if (isAddInformationRequest(text)) {
      const number =
        extractTicketNumber(lastUser) ?? ticketNumberFromHistory(input.messages) ?? 'chamado';
      return {
        content: `Pode me dizer qual informação deseja acrescentar ao ${number}?`,
        toolCalls: [],
      };
    }

    if (
      assistantAskedComplement(input.messages) &&
      lastUser.trim().length > 0 &&
      !usedTools.has('get_ticket') &&
      !usedTools.has('prepare_draft')
    ) {
      const number = ticketNumberFromHistory(input.messages);
      if (number) {
        return {
          content: null,
          toolCalls: [
            {
              id: 'call_get_ticket_complement',
              name: 'get_ticket',
              arguments: { ticketNumber: number },
            },
          ],
        };
      }
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

    if (requestsAnalystTransfer(lastUser)) {
      return {
        content: TRANSFER_CONFIRMATION_TEXT,
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
