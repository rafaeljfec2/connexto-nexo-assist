import { z } from 'zod';
import {
  AffectedScopeSchema,
  AgentIntentSchema,
  ConversationStatusSchema,
  DraftActionSchema,
  DuplicateMatchSchema,
  MessageRoleSchema,
  TicketCategorySchema,
  TicketPrioritySchema,
  TicketStatusSchema,
  TicketTypeSchema,
  UserRoleSchema,
} from './enums';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  area: z.string().min(1),
  role: UserRoleSchema,
});
export type User = z.infer<typeof UserSchema>;

export const TicketSchema = z.object({
  id: z.string().uuid(),
  number: z.string().min(1),
  employeeId: z.string().uuid(),
  type: TicketTypeSchema,
  category: TicketCategorySchema,
  title: z.string().min(1),
  description: z.string().min(1),
  errorCode: z.string().nullable(),
  priority: TicketPrioritySchema,
  status: TicketStatusSchema,
  dueAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Ticket = z.infer<typeof TicketSchema>;

export const TicketHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  fromStatus: TicketStatusSchema.nullable(),
  toStatus: TicketStatusSchema,
  note: z.string(),
  createdAt: z.string().datetime(),
});
export type TicketHistoryEntry = z.infer<typeof TicketHistoryEntrySchema>;

export const HelpArticleSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string()),
  errorCodes: z.array(z.string()),
  isDemo: z.boolean(),
});
export type HelpArticle = z.infer<typeof HelpArticleSchema>;

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  status: ConversationStatusSchema,
  analystId: z.string().uuid().nullable(),
  employeeMessageCount: z.number().int().nonnegative(),
  summary: z.string().nullable(),
  lastEventSeq: z.number().int().nonnegative(),
  activeExecutionId: z.string().uuid().nullable(),
  busyUntil: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string().min(1),
  clientMessageId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationEventTypeSchema = z.enum([
  'message.created',
  'agent.started',
  'agent.completed',
  'agent.failed',
  'agent.incomplete',
  'conversation.updated',
  'sync.required',
]);
export type ConversationEventType = z.infer<typeof ConversationEventTypeSchema>;

export const ConversationEventSchema = z.object({
  conversationId: z.string().uuid(),
  seq: z.number().int().positive(),
  type: ConversationEventTypeSchema,
  version: z.number().int().positive(),
  payload: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  id: z.string().uuid().optional(),
});
export type ConversationEvent = z.infer<typeof ConversationEventSchema>;

export const DraftSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  version: z.number().int().positive(),
  action: DraftActionSchema,
  payload: z.record(z.unknown()),
  ticketId: z.string().uuid().nullable(),
  status: z.enum(['pending', 'confirmed', 'rejected']),
  createdAt: z.string().datetime(),
});
export type Draft = z.infer<typeof DraftSchema>;

export const ExecutionEventSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  executionId: z.string().uuid(),
  intent: AgentIntentSchema.nullable(),
  tool: z.string().nullable(),
  rule: z.string().nullable(),
  result: z.string(),
  justification: z.string(),
  createdAt: z.string().datetime(),
});
export type ExecutionEvent = z.infer<typeof ExecutionEventSchema>;

export const PriorityInputSchema = z.object({
  affectedScope: AffectedScopeSchema,
  workStopped: z.boolean().nullable(),
  sameDayCommitment: z.boolean().nullable(),
  hasAlternative: z.boolean().nullable(),
});
export type PriorityInput = z.infer<typeof PriorityInputSchema>;

export const PriorityDecisionSchema = z.object({
  priority: TicketPrioritySchema.nullable(),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  rule: z.string(),
});
export type PriorityDecision = z.infer<typeof PriorityDecisionSchema>;

export const DuplicateCandidateSchema = z.object({
  ticketId: z.string().uuid(),
  number: z.string(),
  category: TicketCategorySchema,
  title: z.string(),
  description: z.string(),
  errorCode: z.string().nullable(),
  status: TicketStatusSchema,
});
export type DuplicateCandidate = z.infer<typeof DuplicateCandidateSchema>;

export const DuplicateDecisionSchema = z.object({
  match: DuplicateMatchSchema,
  score: z.number().min(0).max(1),
  candidates: z.array(DuplicateCandidateSchema),
  rule: z.string(),
});
export type DuplicateDecision = z.infer<typeof DuplicateDecisionSchema>;

export const ConfirmDraftRequestSchema = z.object({
  draftId: z.string().uuid(),
  version: z.number().int().positive(),
  confirm: z.boolean(),
});
export type ConfirmDraftRequest = z.infer<typeof ConfirmDraftRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SendMessageRequestSchema = z.object({
  content: z.string().min(1).max(4000),
  clientMessageId: z.string().uuid().optional(),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const SendMessageAcceptedSchema = z.object({
  accepted: z.literal(true),
  executionId: z.string().uuid().nullable(),
  clientMessageId: z.string().uuid().nullable(),
  employeeMessage: MessageSchema,
  employeeMessageCount: z.number().int().nonnegative(),
  conversationStatus: ConversationStatusSchema,
});
export type SendMessageAccepted = z.infer<typeof SendMessageAcceptedSchema>;
