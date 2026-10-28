export interface PendingDraft {
  readonly id: string;
  readonly version: number;
  readonly status: 'pending' | 'confirmed' | 'rejected';
}

export type ConfirmationResult =
  | { readonly kind: 'confirm'; readonly rule: string }
  | { readonly kind: 'reject'; readonly rule: string }
  | { readonly kind: 'ask_again'; readonly rule: string; readonly reason: string }
  | { readonly kind: 'mismatch'; readonly rule: string; readonly reason: string };

const EXPLICIT_CONFIRM = new Set([
  'confirmo',
  'confirmado',
  'confirmada',
  'confirmei',
  'pode criar',
  'pode atualizar',
  'pode reabrir',
  'confirmar',
  'sim, confirmo',
  'sim confirmo',
  'sim, confirmado',
  'sim confirmado',
  'eu confirmo',
  'esta confirmado',
  'esta confirmada',
]);

const EXPLICIT_REJECT = new Set([
  'nao',
  'não',
  'cancelar',
  'rejeitar',
  'nao confirmo',
  'não confirmo',
]);

const WEAK_AFFIRMATION = new Set([
  'ok',
  'parece bom',
  'beleza',
  'certo',
  'sim',
  'tudo bem',
]);

/** Past-participle / stem forms people type instead of "confirmo". */
const EXPLICIT_CONFIRM_RE =
  /^(sim[, ]+)?(eu )?confirm(o|ar|ado|ada|ei)$/;

/**
 * Confirms a draft only when the exact version is referenced (button)
 * or free text matches an explicit confirmation phrase tied to a pending draft.
 * Weak affirmations like "ok" / "parece bom" ask again.
 */
export function evaluateConfirmation(input: {
  readonly draft: PendingDraft | null;
  readonly draftId?: string;
  readonly version?: number;
  readonly confirm?: boolean;
  readonly freeText?: string;
}): ConfirmationResult {
  const { draft } = input;

  if (draft === null) {
    return {
      kind: 'ask_again',
      rule: 'confirm.no_pending_draft',
      reason: 'There is no pending draft to confirm.',
    };
  }

  if (draft.status !== 'pending') {
    return {
      kind: 'mismatch',
      rule: 'confirm.draft_not_pending',
      reason: 'Draft is no longer pending.',
    };
  }

  if (input.draftId !== undefined && input.version !== undefined) {
    if (input.draftId !== draft.id || input.version !== draft.version) {
      return {
        kind: 'mismatch',
        rule: 'confirm.version_mismatch',
        reason: 'Confirmation must target the exact draft version.',
      };
    }
    if (input.confirm === true) {
      return { kind: 'confirm', rule: 'confirm.button_confirm' };
    }
    if (input.confirm === false) {
      return { kind: 'reject', rule: 'confirm.button_reject' };
    }
  }

  const text = normalize(input.freeText ?? '');
  if (text.length === 0) {
    return {
      kind: 'ask_again',
      rule: 'confirm.empty',
      reason: 'Need an explicit confirmation of the pending draft.',
    };
  }

  if (EXPLICIT_CONFIRM.has(text) || EXPLICIT_CONFIRM_RE.test(text)) {
    return { kind: 'confirm', rule: 'confirm.explicit_text' };
  }

  if (EXPLICIT_REJECT.has(text)) {
    return { kind: 'reject', rule: 'confirm.explicit_reject' };
  }

  if (WEAK_AFFIRMATION.has(text)) {
    return {
      kind: 'ask_again',
      rule: 'confirm.weak_affirmation',
      reason: 'Please confirm explicitly (e.g. "confirmo" or use the button).',
    };
  }

  return {
    kind: 'ask_again',
    rule: 'confirm.unrecognized',
    reason: 'Unrecognized confirmation phrase.',
  };
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[!?.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
