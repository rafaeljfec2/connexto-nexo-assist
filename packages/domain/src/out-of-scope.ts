export type OutOfScopeMatch = {
  readonly outOfScope: boolean;
  readonly area: 'hr' | 'finance' | 'facilities' | null;
  readonly redirectMessage: string | null;
};

const HR_PATTERNS =
  /\b(rh|recursos humanos|folha de pagamento|f[eé]rias|admiss[aã]o|demiss[aã]o|benef[ií]cio|vale[- ]?(refei[cç][aã]o|alimenta[cç][aã]o)|ponto eletr[oô]nico)\b/i;

const FINANCE_PATTERNS =
  /\b(financeiro|reembolso|pagamento de fornecedor|contas a pagar|contas a receber|or[cç]amento da empresa)\b/i;

/** Finance-only tokens that also appear in IT incidents — only count when IT_GUARD is absent. */
const FINANCE_SOFT_PATTERNS = /\b(nota fiscal|boleto|faturamento)\b/i;

const FACILITIES_PATTERNS =
  /\b(facilities|manuten[cç][aã]o predial|ar[- ]?condicionado|limpeza|mobili[aá]rio|cadeira|mesa de escrit[oó]rio|sala de reuni[aã]o|chave do pr[eé]dio|estacionamento)\b/i;

/**
 * IT topics that must never be treated as out-of-scope (negative cases).
 * Includes systems/apps/outages so finance soft tokens do not false-positive.
 */
const IT_GUARD =
  /\b(vpn|wifi|wi-?fi|notebook|laptop|email|e-mail|outlook|senha|acesso|sap|erp|impressora|software|hardware|rede|809|sistema|aplicativo|aplica[cç][aã]o|portal|erro|indispon[ií]vel|fora do ar|timeout|login|autentica(?:[cç][aã]o)?|servidor|banco de dados|api)\b/i;

const REDIRECT: Record<'hr' | 'finance' | 'facilities', string> = {
  hr: 'Esse assunto é de Recursos Humanos, fora do escopo de TI. Procure o time de RH pelos canais internos.',
  finance:
    'Esse assunto é do Financeiro, fora do escopo de TI. Procure o time Financeiro pelos canais internos.',
  facilities:
    'Esse assunto é de Facilities / predial, fora do escopo de TI. Procure Facilities pelos canais internos.',
};

/**
 * Heuristic detector for non-IT topics (Annex A AA-7).
 * Prefer IT when both IT and non-IT tokens appear.
 */
export function detectOutOfItScope(text: string): OutOfScopeMatch {
  const trimmed = text.trim();
  if (!trimmed) {
    return { outOfScope: false, area: null, redirectMessage: null };
  }
  if (IT_GUARD.test(trimmed)) {
    return { outOfScope: false, area: null, redirectMessage: null };
  }
  if (HR_PATTERNS.test(trimmed)) {
    return { outOfScope: true, area: 'hr', redirectMessage: REDIRECT.hr };
  }
  if (FINANCE_PATTERNS.test(trimmed) || FINANCE_SOFT_PATTERNS.test(trimmed)) {
    return { outOfScope: true, area: 'finance', redirectMessage: REDIRECT.finance };
  }
  if (FACILITIES_PATTERNS.test(trimmed)) {
    return {
      outOfScope: true,
      area: 'facilities',
      redirectMessage: REDIRECT.facilities,
    };
  }
  return { outOfScope: false, area: null, redirectMessage: null };
}
