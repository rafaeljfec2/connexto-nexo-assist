import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ConfirmDraftRequestSchema, SendMessageRequestSchema } from '@nexo-assist/contracts';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(
    @Inject(ConversationsService) private readonly conversations: ConversationsService,
  ) {}

  @Get('current')
  async current(@Req() req: AuthedRequest) {
    return this.conversations.getOrCreateCurrent(req.user!.id);
  }

  @Post('current/messages')
  async send(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = SendMessageRequestSchema.parse(body);
    return this.conversations.sendMessage(req.user!.id, parsed.content);
  }

  @Post('current/drafts/confirm')
  async confirm(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = ConfirmDraftRequestSchema.parse(body);
    return this.conversations.confirmDraft(req.user!.id, parsed);
  }
}
