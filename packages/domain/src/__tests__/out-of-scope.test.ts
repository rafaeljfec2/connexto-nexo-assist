import { describe, expect, it } from 'vitest';
import { detectOutOfItScope } from '../out-of-scope.js';

describe('detectOutOfItScope (AA-7)', () => {
  it('redirects HR topics', () => {
    const result = detectOutOfItScope('Preciso tirar férias na próxima semana, como faço no RH?');
    expect(result.outOfScope).toBe(true);
    expect(result.area).toBe('hr');
    expect(result.redirectMessage).toMatch(/Recursos Humanos/i);
  });

  it('redirects finance topics', () => {
    const result = detectOutOfItScope('Preciso de reembolso de uma nota fiscal do financeiro');
    expect(result.outOfScope).toBe(true);
    expect(result.area).toBe('finance');
  });

  it('redirects facilities topics', () => {
    const result = detectOutOfItScope('O ar-condicionado da sala de reunião não funciona');
    expect(result.outOfScope).toBe(true);
    expect(result.area).toBe('facilities');
  });

  it('does not redirect VPN / IT incidents', () => {
    expect(detectOutOfItScope('VPN corporativa erro 809 no notebook').outOfScope).toBe(false);
    expect(detectOutOfItScope('Não consigo acessar o e-mail Outlook').outOfScope).toBe(false);
  });

  it('does not redirect IT outages that mention finance soft tokens', () => {
    expect(detectOutOfItScope('O sistema de nota fiscal está fora do ar').outOfScope).toBe(
      false,
    );
    expect(detectOutOfItScope('Erro no portal de faturamento ao fazer login').outOfScope).toBe(
      false,
    );
  });
});
