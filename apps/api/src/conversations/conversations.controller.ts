import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ConfirmDraftRequestSchema, SendMessageRequestSchema } from '@nexo-assist/contracts';
import type { Response } from 'express';
import { eq } from 'drizzle-orm';
import { EmployeeGuard, type AuthedRequest } from '../auth/auth.guard';
import { createDb } from '../db/client';
import { conversations } from '../db/schema';
import { ConversationEventsService } from '../events/conversation-events.service';
import { openConversationEventStream } from '../events/sse-stream';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(EmployeeGuard)
export class ConversationsController {
  constructor(
    @Inject(ConversationsService) private readonly conversationsService: ConversationsService,
    @Inject(ConversationEventsService) private readonly events: ConversationEventsService,
  ) {}

  @Get('current')
  async current(@Req() req: AuthedRequest) {
    return this.conversationsService.getOrCreateCurrent(req.user!.id);
  }

  /** LLM turns are expensive — tighter than the global API budget. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('current/messages')
  async send(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = SendMessageRequestSchema.parse(body);
    return this.conversationsService.sendMessage(req.user!.id, parsed.content, parsed.clientMessageId);
  }

  @Post('current/drafts/confirm')
  async confirm(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = ConfirmDraftRequestSchema.parse(body);
    return this.conversationsService.confirmDraft(req.user!.id, parsed);
  }

  /** Long-lived SSE should not consume the request-rate budget. */
  @SkipThrottle({ default: true })
  @Get(':id/events')
  async streamEvents(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Headers('last-event-id') lastEventId: string | undefined,
    @Query('afterSeq') afterSeq: string | undefined,
  ) {
    const db = createDb();
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.employeeId !== req.user!.id) {
      throw new ForbiddenException('Sem acesso a esta conversa.');
    }

    await openConversationEventStream({
      res,
      events: this.events,
      conversationId: id,
      lastEventIdHeader: lastEventId,
      afterSeqQuery: afterSeq,
    });
  }
}
