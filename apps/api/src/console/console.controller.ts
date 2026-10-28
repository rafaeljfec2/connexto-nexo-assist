import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import type { Response } from 'express';
import { AnalystGuard, type AuthedRequest } from '../auth/auth.guard';
import { ConversationEventsService } from '../events/conversation-events.service';
import { openConversationEventStream } from '../events/sse-stream';
import { ConsoleService } from './console.service';

@Controller('console')
@UseGuards(AnalystGuard)
export class ConsoleController {
  constructor(
    @Inject(ConsoleService) private readonly consoleService: ConsoleService,
    @Inject(ConversationEventsService) private readonly events: ConversationEventsService,
  ) {}

  @Get('queue')
  queue(
    @Query('filter') filter: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const parsed =
      filter === 'with_agent' || filter === 'mine' || filter === 'all' || filter === 'for_you'
        ? filter
        : 'for_you';
    return this.consoleService.queue(parsed, req.user!.id);
  }

  @Get('events')
  async streamEvents(
    @Res() res: Response,
    @Headers('last-event-id') lastEventId: string | undefined,
    @Query('conversationId') conversationId: string | undefined,
    @Query('afterSeq') afterSeq: string | undefined,
  ) {
    const scoped =
      conversationId && z.string().uuid().safeParse(conversationId).success
        ? conversationId
        : null;
    await openConversationEventStream({
      res,
      events: this.events,
      conversationId: scoped,
      lastEventIdHeader: scoped ? lastEventId : undefined,
      afterSeqQuery: scoped ? afterSeq : undefined,
    });
  }

  @Get('conversations/:id')
  get(@Param('id') id: string) {
    return this.consoleService.getConversation(id);
  }

  @Post('conversations/:id/claim')
  claim(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.consoleService.claim(id, req.user!.id);
  }

  @Post('conversations/:id/return')
  returnToAgent(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.consoleService.returnToAgent(id, req.user!.id);
  }

  @Post('conversations/:id/close')
  close(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.consoleService.close(id, req.user!.id);
  }

  @Post('conversations/:id/messages')
  send(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ content: z.string().min(1).max(4000) }).parse(body);
    return this.consoleService.sendAnalystMessage(id, req.user!.id, parsed.content);
  }
}
