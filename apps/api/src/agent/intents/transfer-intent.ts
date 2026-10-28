/**
 * Explicit employee phrases that request human handoff.
 * Substring matches like bare "analista" alone in unrelated questions are excluded
 * by requiring the full phrases below (incl. atendente / humano synonyms).
 */
const EXPLICIT_TRANSFER_PHRASES: readonly string[] = [
  'quero falar com um analista',
  'quero falar com uma analista',
  'falar com um analista',
  'falar com uma analista',
  'falar com analista',
  'transferir para um analista',
  'transferir para analista',
  'preciso de um analista',
  'preciso de uma analista',
  'chamar um analista',
  'chamar uma analista',
  'quero falar com um atendente',
  'quero falar com uma atendente',
  'falar com um atendente',
  'falar com uma atendente',
  'falar com atendente',
  'quero falar com um humano',
  'falar com um humano',
  'quero atendimento humano',
  'preciso de um atendente',
  'preciso de uma atendente',
  'chamar um atendente',
  'chamar uma atendente',
  'transferir para um atendente',
  'transferir para atendente',
  'quero falar com o suporte',
  'quero falar com suporte',
  'falar com o suporte',
  'falar com suporte',
  'preciso do suporte',
  'preciso de suporte',
  'chamar o suporte',
  'chamar suporte',
  'transferir para o suporte',
  'transferir para suporte',
];

export const TRANSFER_CONFIRMATION_TEXT =
  'Entendi que você quer falar com um analista. Vou transferir esta conversa para a fila humana.';

export function requestsAnalystTransfer(content: string): boolean {
  const normalized = content
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');

  return EXPLICIT_TRANSFER_PHRASES.some((phrase) => {
    const needle = phrase
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    return normalized.includes(needle);
  });
}
