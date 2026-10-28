import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import {
  computeDueAt,
  canComplement,
  canReopen,
  canTransferTicket,
  nextStatusAfterReopen,
} from '@nexo-assist/domain';
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@nexo-assist/contracts';
import { createDb, type AppDatabase } from '../db/client';
import { operations, ticketHistory, tickets } from '../db/schema';

export interface CreateTicketInput {
  readonly employeeId: string;
  readonly type: TicketType;
  readonly category: TicketCategory;
  readonly title: string;
  readonly description: string;
  readonly errorCode: string | null;
  readonly priority: TicketPriority;
  readonly operationId: string;
}

export interface UpdateTicketInput {
  readonly ticketId: string;
  readonly employeeId: string;
  readonly descriptionAppend?: string;
  readonly priority?: TicketPriority;
  readonly operationId: string;
}

@Injectable()
export class TicketGateway {
  private db: AppDatabase = createDb();

  static withDb(db: AppDatabase): TicketGateway {
    const gateway = new TicketGateway();
    gateway.db = db;
    return gateway;
  }

  private static readonly FAULT_MESSAGE =
    'O sistema de chamados está temporariamente indisponível. Tente novamente em instantes.';

  /**
   * Affordance (read per call — does not mutate process.env):
   * - `unavailable` — fail every attempt (after short retries)
   * - `fail_once` — one synthetic fail inside this retry loop, then succeed
   * - `off` — healthy
   */
  private async withFaultRetry<T>(operation: () => Promise<T>): Promise<T> {
    const mode = (process.env.TICKET_FAULT ?? 'off').toLowerCase();
    let remainingSyntheticFails = mode === 'fail_once' ? 1 : 0;
    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        if (mode === 'unavailable') {
          throw new ServiceUnavailableException(TicketGateway.FAULT_MESSAGE);
        }
        if (remainingSyntheticFails > 0) {
          remainingSyntheticFails -= 1;
          throw new ServiceUnavailableException(TicketGateway.FAULT_MESSAGE);
        }
        return await operation();
      } catch (error: unknown) {
        lastError = error;
        const unavailable =
          error instanceof ServiceUnavailableException ||
          (error instanceof Error && /indisponível|unavailable/i.test(error.message));
        if (!unavailable || attempt >= maxAttempts - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    throw lastError;
  }

  async listOwned(employeeId: string) {
    return this.withFaultRetry(() => this.listOwnedRaw(employeeId));
  }

  private async listOwnedRaw(employeeId: string) {
    return this.db.select().from(tickets).where(eq(tickets.employeeId, employeeId));
  }

  async getOwned(ticketId: string, employeeId: string) {
    return this.withFaultRetry(() => this.getOwnedRaw(ticketId, employeeId));
  }

  private async getOwnedRaw(ticketId: string, employeeId: string) {
    const rows = await this.db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.employeeId, employeeId)));
    const ticket = rows[0];
    if (!ticket) {
      throw new ForbiddenException('Ticket not found for this employee');
    }
    return ticket;
  }

  async findOwnedByNumberOrId(employeeId: string, numberOrId: string) {
    const needle = numberOrId.trim();
    if (!needle) {
      return null;
    }
    const owned = await this.listOwned(employeeId);
    return (
      owned.find(
        (ticket) =>
          ticket.id === needle || ticket.number.toLowerCase() === needle.toLowerCase(),
      ) ?? null
    );
  }

  async getHistory(ticketId: string, employeeId: string) {
    await this.getOwned(ticketId, employeeId);
    return this.db.select().from(ticketHistory).where(eq(ticketHistory.ticketId, ticketId));
  }

  async create(input: CreateTicketInput, attempt = 0): Promise<Record<string, unknown>> {
    return this.withFaultRetry(() => this.createOnce(input, attempt));
  }

  private async createOnce(
    input: CreateTicketInput,
    attempt: number,
  ): Promise<Record<string, unknown>> {
    const existing = await this.findOperation(input.operationId);
    if (existing) {
      return existing.result;
    }

    const dueAt = computeDueAt(input.priority, new Date());

    try {
      return await this.db.transaction(async (tx) => {
        const number = await this.nextNumberIn(tx, input.type);
        const [created] = await tx
          .insert(tickets)
          .values({
            number,
            employeeId: input.employeeId,
            type: input.type,
            category: input.category,
            title: input.title,
            description: input.description,
            errorCode: input.errorCode,
            priority: input.priority,
            status: 'waiting_analyst',
            dueAt,
          })
          .returning();

        if (!created) {
          throw new Error('Failed to create ticket');
        }

        await tx.insert(ticketHistory).values({
          ticketId: created.id,
          fromStatus: null,
          toStatus: 'waiting_analyst',
          note: 'Created via Nexo Assist draft confirmation.',
        });

        const result = {
          ticketId: created.id,
          number: created.number,
          status: created.status,
        };
        await tx.insert(operations).values({
          operationId: input.operationId,
          kind: 'create',
          result,
        });
        return result;
      });
    } catch (error: unknown) {
      const raced = await this.findOperation(input.operationId);
      if (raced) {
        return raced.result;
      }
      if (isUniqueViolation(error) && attempt < 3) {
        return this.create(input, attempt + 1);
      }
      throw error;
    }
  }

  async complement(input: UpdateTicketInput) {
    return this.withFaultRetry(() => this.complementOnce(input));
  }

  private async complementOnce(input: UpdateTicketInput) {
    const existing = await this.findOperation(input.operationId);
    if (existing) {
      return existing.result;
    }

    const ticket = await this.getOwnedRaw(input.ticketId, input.employeeId);
    const allowed = canComplement(ticket.status as TicketStatus);
    if (!allowed.allowed) {
      throw new ForbiddenException(allowed.reason);
    }

    const priority = input.priority ?? (ticket.priority as TicketPriority);
    const dueAt = computeDueAt(priority, new Date());
    const description =
      input.descriptionAppend && input.descriptionAppend.length > 0
        ? `${ticket.description}\n\n---\n${input.descriptionAppend}`
        : ticket.description;

    const [updated] = await this.db
      .update(tickets)
      .set({
        description,
        priority,
        dueAt,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticket.id))
      .returning();

    await this.db.insert(ticketHistory).values({
      ticketId: ticket.id,
      fromStatus: ticket.status,
      toStatus: ticket.status,
      note: 'Complement added via Nexo Assist.',
    });

    const result = {
      ticketId: updated?.id ?? ticket.id,
      number: updated?.number ?? ticket.number,
      status: updated?.status ?? ticket.status,
    };
    await this.saveOperation(input.operationId, 'update', result);
    return result;
  }

  async reopen(input: {
    readonly ticketId: string;
    readonly employeeId: string;
    readonly note: string;
    readonly operationId: string;
  }) {
    return this.withFaultRetry(() => this.reopenOnce(input));
  }

  private async reopenOnce(input: {
    readonly ticketId: string;
    readonly employeeId: string;
    readonly note: string;
    readonly operationId: string;
  }) {
    const existing = await this.findOperation(input.operationId);
    if (existing) {
      return existing.result;
    }

    const ticket = await this.getOwnedRaw(input.ticketId, input.employeeId);
    const allowed = canReopen(ticket.status as TicketStatus, ticket.resolvedAt, new Date());
    if (!allowed.allowed) {
      throw new ForbiddenException(allowed.reason);
    }

    const next = nextStatusAfterReopen();
    const priority = ticket.priority as TicketPriority;
    const dueAt = computeDueAt(priority, new Date());
    const [updated] = await this.db
      .update(tickets)
      .set({
        status: next,
        resolvedAt: null,
        dueAt,
        description: `${ticket.description}\n\n---\nReabertura: ${input.note}`,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticket.id))
      .returning();

    await this.db.insert(ticketHistory).values({
      ticketId: ticket.id,
      fromStatus: ticket.status,
      toStatus: next,
      note: input.note,
    });

    const result = {
      ticketId: updated?.id ?? ticket.id,
      number: updated?.number ?? ticket.number,
      status: next,
    };
    await this.saveOperation(input.operationId, 'reopen', result);
    return result;
  }

  async transferTicket(input: {
    readonly ticketId: string;
    readonly employeeId: string;
    readonly operationId: string;
  }) {
    return this.withFaultRetry(() => this.transferOnce(input));
  }

  private async transferOnce(input: {
    readonly ticketId: string;
    readonly employeeId: string;
    readonly operationId: string;
  }) {
    const existing = await this.findOperation(input.operationId);
    if (existing) {
      return existing.result;
    }

    const ticket = await this.getOwnedRaw(input.ticketId, input.employeeId);
    const allowed = canTransferTicket(ticket.status as TicketStatus);
    if (!allowed.allowed) {
      throw new ForbiddenException(allowed.reason);
    }

    const [updated] = await this.db
      .update(tickets)
      .set({ status: 'transferred', updatedAt: new Date() })
      .where(eq(tickets.id, ticket.id))
      .returning();

    await this.db.insert(ticketHistory).values({
      ticketId: ticket.id,
      fromStatus: ticket.status,
      toStatus: 'transferred',
      note: 'Transferred to analyst queue.',
    });

    const result = {
      ticketId: updated?.id ?? ticket.id,
      number: updated?.number ?? ticket.number,
      status: 'transferred',
    };
    await this.saveOperation(input.operationId, 'transfer', result);
    return result;
  }

  private async nextNumber(type: TicketType): Promise<string> {
    return this.nextNumberIn(this.db, type);
  }

  private async nextNumberIn(queryable: AppDatabase, type: TicketType): Promise<string> {
    const prefix = type === 'request' ? 'REQ' : 'INC';
    const rows = await queryable.select({ number: tickets.number }).from(tickets);
    let max = 20000;
    for (const row of rows) {
      const match = /^((?:INC|REQ)-)(\d+)$/.exec(row.number);
      if (match?.[2]) {
        max = Math.max(max, Number(match[2]));
      }
    }
    return `${prefix}-${max + 1}`;
  }

  private async findOperation(operationId: string) {
    const rows = await this.db
      .select()
      .from(operations)
      .where(eq(operations.operationId, operationId));
    return rows[0] ?? null;
  }

  private async saveOperation(
    operationId: string,
    kind: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(operations).values({ operationId, kind, result });
  }

  async listOpenForDuplicity(employeeId: string) {
    return this.withFaultRetry(() =>
      this.db
        .select()
        .from(tickets)
        .where(and(eq(tickets.employeeId, employeeId), ne(tickets.status, 'resolved'))),
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  return code === '23505';
}
