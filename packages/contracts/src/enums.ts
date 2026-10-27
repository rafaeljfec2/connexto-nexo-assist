import { z } from 'zod';

export const UserRoleSchema = z.enum(['employee', 'analyst']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const TicketTypeSchema = z.enum(['incident', 'request']);
export type TicketType = z.infer<typeof TicketTypeSchema>;

export const TicketCategorySchema = z.enum([
  'access',
  'hardware',
  'software',
  'network',
  'email',
  'other',
]);
export type TicketCategory = z.infer<typeof TicketCategorySchema>;

export const TicketPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

export const TicketStatusSchema = z.enum([
  'waiting_analyst',
  'in_progress',
  'approved',
  'resolved',
  'transferred',
]);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const AffectedScopeSchema = z.enum(['self', 'team', 'company', 'unknown']);
export type AffectedScope = z.infer<typeof AffectedScopeSchema>;

export const ConversationStatusSchema = z.enum([
  'with_agent',
  'waiting_analyst',
  'with_analyst',
  'closed',
]);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const MessageRoleSchema = z.enum(['employee', 'agent', 'analyst', 'system']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const DraftActionSchema = z.enum(['create', 'update', 'reopen', 'transfer']);
export type DraftAction = z.infer<typeof DraftActionSchema>;

export const AgentIntentSchema = z.enum([
  'help',
  'ticket_lookup',
  'deadline',
  'complement',
  'create',
  'talk_to_analyst',
  'critical',
  'out_of_it',
  'ambiguous',
]);
export type AgentIntent = z.infer<typeof AgentIntentSchema>;

export const DuplicateMatchSchema = z.enum([
  'none',
  'strong',
  'ambiguous',
  'multiple',
]);
export type DuplicateMatch = z.infer<typeof DuplicateMatchSchema>;
