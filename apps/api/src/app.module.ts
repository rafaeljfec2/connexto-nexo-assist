import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard, AnalystGuard, EmployeeGuard } from './auth/auth.guard';
import { ConversationsController } from './conversations/conversations.controller';
import { ConversationsService } from './conversations/conversations.service';
import { UsageGuard } from './conversations/usage.guard';
import { AgentOrchestrator } from './agent/orchestrator/agent.orchestrator';
import { PolicyEngine } from './agent/policy/policy.engine';
import { TicketGateway } from './tickets/ticket.gateway';
import { TicketsController } from './tickets/tickets.controller';
import { ConsoleController } from './console/console.controller';
import { ConsoleService } from './console/console.service';
import { HealthController } from './health.controller';
import { ConversationEventsService } from './events/conversation-events.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
  ],
  controllers: [
    HealthController,
    AuthController,
    ConversationsController,
    TicketsController,
    ConsoleController,
  ],
  providers: [
    AuthService,
    AuthGuard,
    AnalystGuard,
    EmployeeGuard,
    ConversationsService,
    UsageGuard,
    AgentOrchestrator,
    PolicyEngine,
    TicketGateway,
    ConsoleService,
    ConversationEventsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [AuthService, TicketGateway, ConversationEventsService],
})
export class AppModule {}
