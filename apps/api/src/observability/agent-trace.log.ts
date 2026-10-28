import { Logger } from '@nestjs/common';
import type { TurnEvent } from '../agent/agent.types';

const logger = new Logger('AgentTrace');

const CONTENT_PREVIEW_MAX = 120;

export function previewContent(content: string, max = CONTENT_PREVIEW_MAX): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) {
    return collapsed;
  }
  return `${collapsed.slice(0, max)}…`;
}

/** Stable one-line key=value payload for AgentTrace logs (grep-friendly). */
export function formatTraceFields(
  fields: Readonly<Record<string, string | number | boolean | null | undefined>>,
): string {
  return Object.entries(fields)
    .map(([key, value]) => {
      if (value === null || value === undefined) {
        return `${key}=-`;
      }
      if (typeof value === 'boolean' || typeof value === 'number') {
        return `${key}=${value}`;
      }
      const escaped = value.replace(/"/g, '\\"').replace(/\s+/g, ' ').trim();
      if (escaped.length === 0) {
        return `${key}=-`;
      }
      if (/[\s=]/.test(escaped)) {
        return `${key}="${escaped}"`;
      }
      return `${key}=${escaped}`;
    })
    .join(' ');
}

export function logTurnStarted(input: {
  readonly conversationId: string;
  readonly executionId: string;
  readonly employeeId: string;
  readonly contentPreview: string;
}): void {
  logger.log(
    `turn.started ${formatTraceFields({
      conversationId: input.conversationId,
      executionId: input.executionId,
      employeeId: input.employeeId,
      contentPreview: previewContent(input.contentPreview),
    })}`,
  );
}

export function logTurnCompleted(input: {
  readonly conversationId: string;
  readonly executionId: string;
  readonly status: string;
  readonly draftVersion: number | null;
  readonly eventCount: number;
}): void {
  logger.log(
    `turn.completed ${formatTraceFields({
      conversationId: input.conversationId,
      executionId: input.executionId,
      status: input.status,
      draftVersion: input.draftVersion,
      eventCount: input.eventCount,
    })}`,
  );
}

export function logTurnFailed(input: {
  readonly conversationId: string;
  readonly executionId: string;
  readonly reason: string;
}): void {
  logger.warn(
    `turn.failed ${formatTraceFields({
      conversationId: input.conversationId,
      executionId: input.executionId,
      reason: input.reason,
    })}`,
  );
}

export function logTurnFencedDiscard(input: {
  readonly conversationId: string;
  readonly executionId: string;
}): void {
  logger.warn(
    `turn.fenced_discard ${formatTraceFields({
      conversationId: input.conversationId,
      executionId: input.executionId,
    })}`,
  );
}

export function logBusinessEvent(input: {
  readonly conversationId: string;
  readonly executionId: string;
  readonly event: TurnEvent;
}): void {
  logger.log(
    `turn.event ${formatTraceFields({
      conversationId: input.conversationId,
      executionId: input.executionId,
      intent: input.event.intent,
      tool: input.event.tool,
      rule: input.event.rule,
      result: input.event.result,
      justification: input.event.justification,
    })}`,
  );
}

export function logDraftConfirm(input: {
  readonly conversationId: string;
  readonly draftId: string;
  readonly version: number;
  readonly confirm: boolean;
  readonly rule: string;
  readonly result: string;
}): void {
  logger.log(
    `draft.confirm ${formatTraceFields({
      conversationId: input.conversationId,
      draftId: input.draftId,
      version: input.version,
      confirm: input.confirm,
      rule: input.rule,
      result: input.result,
    })}`,
  );
}
