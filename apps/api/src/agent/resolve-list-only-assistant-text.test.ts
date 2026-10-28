import { describe, expect, it } from 'vitest';
import { resolveListOnlyAssistantText } from './agent.tools';

describe('resolveListOnlyAssistantText', () => {
  it('replaces LLM ticket enumerations on list-only turns', () => {
    const text = resolveListOnlyAssistantText({
      events: [
        {
          intent: null,
          tool: 'list_my_tickets',
          rule: null,
          result: 'ok',
          justification: 'Executed list_my_tickets',
        },
      ],
      listedOpenCount: 4,
      fallback:
        'Encontrei 4 chamados abertos:\n1. INC-20311: Notebook\n2. INC-20298: Acesso',
    });
    expect(text).toBe('Você tem 4 chamados abertos. Sobre qual deles quer saber?');
    expect(text).not.toMatch(/INC-/i);
  });

  it('keeps fallback when other tools ran in the same turn', () => {
    const fallback =
      'Não encontrei chamado aberto de VPN. Quem está sendo afetado?';
    expect(
      resolveListOnlyAssistantText({
        events: [
          {
            intent: null,
            tool: 'list_my_tickets',
            rule: null,
            result: 'ok',
            justification: 'Executed list_my_tickets',
          },
          {
            intent: null,
            tool: 'search_help',
            rule: null,
            result: 'ok',
            justification: 'Executed search_help',
          },
        ],
        listedOpenCount: 0,
        fallback,
      }),
    ).toBe(fallback);
  });
});
