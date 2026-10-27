/**
 * Explicit employee phrases that request human handoff.
 * Substring matches like bare "analista" or "falar com" are intentionally excluded.
 */
const EXPLICIT_TRANSFER_PHRASES: readonly string[] = [
  'quero falar com um analista',
  'falar com um analista',
  'falar com analista',
  'transferir para um analista',
  'transferir para analista',
  'preciso de um analista',
  'chamar um analista',
];

export function requestsAnalystTransfer(content: string): boolean {
  const normalized = content
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');

  return EXPLICIT_TRANSFER_PHRASES.some((phrase) => normalized.includes(phrase));
}
