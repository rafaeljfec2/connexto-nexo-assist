import type { DraftRow } from './agent.draft-store';

export type TurnEvent = {
  readonly intent: string | null;
  readonly tool: string | null;
  readonly rule: string | null;
  readonly result: string;
  readonly justification: string;
};

export type PersistAgentOutcome = (input: {
  readonly conversationId: string;
  readonly executionId: string;
  readonly agentContent: string;
  readonly events: TurnEvent[];
  readonly draft: DraftRow | null;
  readonly status: string;
  readonly summary: string | null;
}) => Promise<unknown>;

export type FailExecution = (input: {
  readonly conversationId: string;
  readonly executionId: string;
  readonly reason: string;
  readonly agentContent: string | null;
}) => Promise<void>;
