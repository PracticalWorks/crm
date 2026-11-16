// One handler body for both hooks: turn Twenty's database event into the
// contract's events and deliver them. The logic-function files only declare when
// it runs.

import { RetryableLogicFunctionError, type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import {
  opportunityEvents,
  type OpportunityChange,
  type OpportunityDiff,
  type OpportunitySnapshot,
} from '../../../packages/client/src/events.ts';
import { deliver, restNotifier, type DeliveryResult } from './deliver';

/** The part of Twenty's database event payload the hooks read. */
export type OpportunityDatabaseEvent = {
  name?: string;
  recordId: string;
  workspaceMemberId?: string;
  properties: {
    before?: OpportunitySnapshot;
    after?: OpportunitySnapshot;
    diff?: OpportunityDiff;
    updatedFields?: string[];
  };
};

export function toChange(event: OpportunityDatabaseEvent): OpportunityChange | null {
  const { before, after, diff, updatedFields } = event.properties;
  if (!after) return null;
  const actorId = event.workspaceMemberId ?? null;
  if (!before) return { operation: 'created', recordId: event.recordId, actorId, after };
  return { operation: 'updated', recordId: event.recordId, actorId, before, after, diff, updatedFields };
}

export async function handleOpportunityEvent(
  event: OpportunityDatabaseEvent,
  context: Pick<LogicFunctionExecutionContext, 'retryCount' | 'maxRetries'>,
  fetchFn: typeof fetch = fetch,
): Promise<DeliveryResult> {
  const change = toChange(event);
  if (!change) return { sent: 0, ids: [] };
  const vars = process.env;
  return deliver(
    opportunityEvents(change),
    { url: vars.INNGEST_EVENT_URL, key: vars.INNGEST_EVENT_KEY },
    { retryCount: context.retryCount ?? 0, maxRetries: context.maxRetries ?? 0 },
    {
      fetch: fetchFn,
      notify: restNotifier(vars.TWENTY_API_URL, vars.TWENTY_APP_APPLICATION_ACCESS_TOKEN ?? vars.TWENTY_APP_ACCESS_TOKEN, fetchFn),
      retryable: (message) => new RetryableLogicFunctionError(message),
    },
  );
}
