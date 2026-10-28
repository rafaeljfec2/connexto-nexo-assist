export type ConsoleTicketPayload = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  description: string;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastHistory: { note: string; createdAt: Date } | null;
};

export type ConsoleQueueFilter = 'for_you' | 'with_agent' | 'mine' | 'all';
