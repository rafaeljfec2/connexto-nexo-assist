/**
 * Mark third-party / user-sourced strings so the model treats them as data,
 * not as instructions (prompt-injection hygiene for tool results sent to the LLM).
 * Keep UI/event payloads clean — wrap only on the model-facing boundary.
 */
export const UNTRUSTED_MAX_CHARS = 800;

export function clipUntrustedText(value: string, maxChars = UNTRUSTED_MAX_CHARS): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars)}…`;
}

/** Wrap a free-text field that came from tickets, help articles, or similar. */
export function asUntrustedData(value: string, maxChars = UNTRUSTED_MAX_CHARS): string {
  return `[untrusted_data] ${clipUntrustedText(value, maxChars)} [/untrusted_data]`;
}

/** Model-facing view of tool JSON: wrap free-text fields, leave ids/enums intact. */
export function wrapToolResultForLlm(toolName: string, result: unknown): unknown {
  if (result == null || typeof result !== 'object') {
    return result;
  }
  if (toolName === 'search_help' && Array.isArray(result)) {
    return result.map((row) => {
      if (!row || typeof row !== 'object') {
        return row;
      }
      const article = row as Record<string, unknown>;
      return {
        ...article,
        title:
          typeof article['title'] === 'string'
            ? asUntrustedData(article['title'], 200)
            : article['title'],
        body:
          typeof article['body'] === 'string'
            ? asUntrustedData(article['body'])
            : article['body'],
      };
    });
  }
  if (toolName === 'list_my_tickets' && Array.isArray(result)) {
    return result.map((row) => wrapTicketRowForLlm(row));
  }
  if (toolName === 'get_ticket') {
    return wrapTicketRowForLlm(result);
  }
  return result;
}

function wrapTicketRowForLlm(row: unknown): unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return row;
  }
  const ticket = row as Record<string, unknown>;
  if (typeof ticket['error'] === 'string') {
    return row;
  }
  return {
    ...ticket,
    title:
      typeof ticket['title'] === 'string'
        ? asUntrustedData(ticket['title'], 200)
        : ticket['title'],
    description:
      typeof ticket['description'] === 'string'
        ? asUntrustedData(ticket['description'])
        : ticket['description'],
  };
}
