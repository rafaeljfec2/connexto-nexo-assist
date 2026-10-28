import { describe, expect, it } from 'vitest';
import {
  findPriorProblemReport,
  inferCategoryFromText,
  lastAssistantAskedImpact,
  parseAffectedScope,
} from './impact-answer';

describe('parseAffectedScope', () => {
  it('parses Figma impact chips', () => {
    expect(parseAffectedScope('Só eu')).toBe('self');
    expect(parseAffectedScope('Minha equipe')).toBe('team');
    expect(parseAffectedScope('Toda a empresa')).toBe('company');
    expect(parseAffectedScope('Não sei')).toBe('unknown');
  });
});

describe('lastAssistantAskedImpact', () => {
  it('reads newest-first history and detects the impact question', () => {
    expect(
      lastAssistantAskedImpact([
        { role: 'employee', content: 'Só eu' },
        {
          role: 'agent',
          content:
            'Quem está sendo afetado pelo problema no notebook? Você pode detalhar?',
        },
        { role: 'employee', content: 'Estou com problema em meu noteboo' },
      ]),
    ).toBe(true);
  });

  it('returns false when the latest agent turn was a list intro', () => {
    expect(
      lastAssistantAskedImpact([
        { role: 'employee', content: 'Só eu' },
        {
          role: 'agent',
          content: 'Você tem 4 chamados abertos. Sobre qual deles quer saber?',
        },
      ]),
    ).toBe(false);
  });
});

describe('findPriorProblemReport', () => {
  it('skips the chip answer and returns the problem report', () => {
    expect(
      findPriorProblemReport(
        [
          { role: 'employee', content: 'Só eu' },
          {
            role: 'agent',
            content: 'Quem está sendo afetado pelo problema no notebook?',
          },
          { role: 'employee', content: 'Estou com problema em meu noteboo' },
        ],
        'Só eu',
      ),
    ).toBe('Estou com problema em meu noteboo');
  });
});

describe('inferCategoryFromText', () => {
  it('maps notebook problems to hardware', () => {
    expect(inferCategoryFromText('Estou com problema em meu notebook')).toBe('hardware');
  });
});
