import { MAX_TOOL_STEPS, PROVIDER_TIMEOUT_MS } from '../conversations/usage.guard';

/** Wall-clock lease covers the worst-case multi-step provider budget (+ buffer). */
export const AGENT_LEASE_MS = MAX_TOOL_STEPS * PROVIDER_TIMEOUT_MS + 5_000;

export const AGENT_INCOMPLETE_GRACE_MS = 1_000;
