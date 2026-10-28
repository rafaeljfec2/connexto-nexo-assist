const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = 'Falha na requisição';
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      } else if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export type User = {
  id: string;
  email: string;
  name: string;
  area: string;
  role: 'employee' | 'analyst';
};

export type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export type ExecutionEvent = {
  id: string;
  executionId: string;
  intent: string | null;
  tool: string | null;
  rule: string | null;
  result: string;
  justification: string;
  createdAt: string;
};

export type Draft = {
  id: string;
  version: number;
  action: string;
  payload: Record<string, unknown>;
  status: string;
};

export type ConversationPayload = {
  conversation: {
    id: string;
    status: string;
    employeeMessageCount: number;
    analystId: string | null;
    summary: string | null;
    lastEventSeq?: number;
    activeExecutionId?: string | null;
  } | null;
  messages: Message[];
  events: ExecutionEvent[];
  draft: Draft | null;
};

export type SendMessageAccepted = {
  accepted: true;
  executionId: string | null;
  clientMessageId: string | null;
  employeeMessage: Message;
  employeeMessageCount: number;
  conversationStatus: string;
};

export const api = {
  login: (email: string, password: string, rememberMe: boolean) =>
    request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/auth/me'),
  currentConversation: () => request<ConversationPayload>('/conversations/current'),
  sendMessage: (content: string, clientMessageId?: string) =>
    request<SendMessageAccepted>('/conversations/current/messages', {
      method: 'POST',
      body: JSON.stringify({ content, clientMessageId }),
    }),
  confirmDraft: (draftId: string, version: number, confirm: boolean) =>
    request<{ ok: boolean; mutation: unknown }>('/conversations/current/drafts/confirm', {
      method: 'POST',
      body: JSON.stringify({ draftId, version, confirm }),
    }),
  listTickets: () => request<Array<Record<string, unknown>>>('/tickets'),
  queue: (filter: string) =>
    request<
      Array<{
        conversation: {
          id: string;
          status: string;
          summary: string | null;
          employeeMessageCount: number;
          analystId: string | null;
          updatedAt?: string;
        };
        employeeName: string;
        employeeEmail: string;
        employeeArea: string;
      }>
    >(`/console/queue?filter=${encodeURIComponent(filter)}`),
  getConsoleConversation: (id: string) =>
    request<{
      conversation: {
        id: string;
        status: string;
        summary: string | null;
        analystId: string | null;
      };
      employeeName: string;
      employeeEmail: string;
      employeeArea: string;
      messages: Message[];
      tickets: Array<Record<string, unknown>>;
    }>(`/console/conversations/${id}`),
  claim: (id: string) => request(`/console/conversations/${id}/claim`, { method: 'POST' }),
  returnToAgent: (id: string) =>
    request(`/console/conversations/${id}/return`, { method: 'POST' }),
  close: (id: string) => request(`/console/conversations/${id}/close`, { method: 'POST' }),
  sendAnalystMessage: (id: string, content: string) =>
    request(`/console/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};
