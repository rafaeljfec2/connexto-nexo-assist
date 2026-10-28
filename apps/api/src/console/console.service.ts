import { Inject, Injectable, Optional } from '@nestjs/common';
import { createDb, type AppDatabase } from '../db/client';
import { ConversationEventsService } from '../events/conversation-events.service';
import {
  claimConversation,
  closeConversation,
  returnConversationToAgent,
  sendAnalystConversationMessage,
  type ConsoleActionDeps,
} from './console.actions';
import { fetchConversationDetail, fetchQueue } from './console.queries';
import type { ConsoleQueueFilter, ConsoleTicketPayload } from './console.types';

export type { ConsoleTicketPayload } from './console.types';

@Injectable()
export class ConsoleService {
  private readonly db: AppDatabase = createDb();
  private readonly events: ConversationEventsService;
  private readonly actionDeps: ConsoleActionDeps;

  constructor(
    @Optional() @Inject(ConversationEventsService) events?: ConversationEventsService,
  ) {
    this.events = events ?? new ConversationEventsService();
    this.actionDeps = { db: this.db, events: this.events };
  }

  async queue(filter: ConsoleQueueFilter, analystId: string) {
    return fetchQueue(this.db, filter, analystId);
  }

  async getConversation(id: string) {
    return fetchConversationDetail(this.db, id);
  }

  async claim(conversationId: string, analystId: string) {
    await claimConversation(this.actionDeps, conversationId, analystId);
    return this.getConversation(conversationId);
  }

  async returnToAgent(conversationId: string, analystId: string) {
    await returnConversationToAgent(this.actionDeps, conversationId, analystId);
    return this.getConversation(conversationId);
  }

  async close(conversationId: string, analystId: string) {
    await closeConversation(this.actionDeps, conversationId, analystId);
    return this.getConversation(conversationId);
  }

  async sendAnalystMessage(conversationId: string, analystId: string, content: string) {
    await sendAnalystConversationMessage(
      this.actionDeps,
      conversationId,
      analystId,
      content,
    );
    return this.getConversation(conversationId);
  }
}
