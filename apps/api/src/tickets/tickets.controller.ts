import { Controller, Get, Inject, Param, Req, UseGuards } from '@nestjs/common';
import { EmployeeGuard, type AuthedRequest } from '../auth/auth.guard';
import { TicketGateway } from './ticket.gateway';

@Controller('tickets')
@UseGuards(EmployeeGuard)
export class TicketsController {
  constructor(@Inject(TicketGateway) private readonly tickets: TicketGateway) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.tickets.listOwned(req.user!.id);
  }

  @Get(':id')
  async get(@Req() req: AuthedRequest, @Param('id') id: string) {
    const ticket = await this.tickets.getOwned(id, req.user!.id);
    const history = await this.tickets.getHistory(id, req.user!.id);
    return { ticket, history };
  }
}
