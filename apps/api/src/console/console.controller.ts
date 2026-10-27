import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AnalystGuard, type AuthedRequest } from '../auth/auth.guard';
import { ConsoleService } from './console.service';

@Controller('console')
@UseGuards(AnalystGuard)
export class ConsoleController {
  constructor(@Inject(ConsoleService) private readonly consoleService: ConsoleService) {}

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
