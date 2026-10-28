import { describe, expect, it } from 'vitest';
import { ScriptedLlmProvider } from './scripted.llm.provider';

describe('ScriptedLlmProvider complement (C6)', () => {
  it('asks for complement text instead of impact when adding information', async () => {
    const provider = new ScriptedLlmProvider();
    const result = await provider.complete({
      messages: [
        { role: 'system', content: 'test' },
        {
          role: 'user',
          content: 'Adicionar informação ao chamado INC-20311',
        },
      ],
      tools: [],
      maxTokens: 200,
      timeoutMs: 1000,
    });
    expect(result.toolCalls).toEqual([]);
    expect(result.content).toContain('acrescentar ao INC-20311');
    expect(result.content?.toLowerCase()).not.toContain('afetado');
  });

  it('loads the ticket then drafts an update after complement text', async () => {
    const provider = new ScriptedLlmProvider();
    const ask = await provider.complete({
      messages: [
        { role: 'user', content: 'Adicionar informação ao chamado INC-20311' },
      ],
      tools: [],
      maxTokens: 200,
      timeoutMs: 1000,
    });
    expect(ask.content).toBeTruthy();

    const load = await provider.complete({
      messages: [
        { role: 'user', content: 'Adicionar informação ao chamado INC-20311' },
        { role: 'assistant', content: ask.content ?? '' },
        {
          role: 'user',
          content: 'Reiniciei de novo e o diagnóstico da central não resolveu.',
        },
      ],
      tools: [],
      maxTokens: 200,
      timeoutMs: 1000,
    });
    expect(load.toolCalls).toHaveLength(1);
    expect(load.toolCalls[0]?.name).toBe('get_ticket');
    expect(load.toolCalls[0]?.arguments).toEqual({ ticketNumber: 'INC-20311' });

    const draft = await provider.complete({
      messages: [
        { role: 'user', content: 'Adicionar informação ao chamado INC-20311' },
        { role: 'assistant', content: ask.content ?? '' },
        {
          role: 'user',
          content: 'Reiniciei de novo e o diagnóstico da central não resolveu.',
        },
        { role: 'assistant', content: '' },
        {
          role: 'tool',
          toolCallId: 'call_get_ticket_complement',
          name: 'get_ticket',
          content: JSON.stringify({
            id: 'ticket-uuid-20311',
            number: 'INC-20311',
            title: 'Notebook lento',
            status: 'waiting_analyst',
            dueAt: '2020-01-01T00:00:00.000Z',
            updatedAt: '2020-01-01T00:00:00.000Z',
            createdAt: '2020-01-01T00:00:00.000Z',
          }),
        },
      ],
      tools: [],
      maxTokens: 200,
      timeoutMs: 1000,
    });
    expect(draft.toolCalls).toHaveLength(1);
    expect(draft.toolCalls[0]?.name).toBe('prepare_draft');
    expect(draft.toolCalls[0]?.arguments).toMatchObject({
      action: 'update',
      ticketId: 'ticket-uuid-20311',
      description: 'Reiniciei de novo e o diagnóstico da central não resolveu.',
    });
  });
});
