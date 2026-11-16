// Sends a change's events to Inngest's event API, and makes sure a send that
// cannot land is never dropped in silence.
//
// - 2xx: done.
// - A network error, 429 or 5xx: transient. The run asks Twenty for a retry
//   (`RetryableLogicFunctionError`, up to `maxRetries`, with backoff). Every event
//   carries an `id`, so a retry that repeats a send Inngest already took is
//   deduplicated there.
// - Anything else (a 4xx, a missing URL or key), or a transient failure on the last
//   attempt: final. A Task lands on the Opportunity for its owner, saying which
//   event did not go and why, then the run fails, so it also shows as a failed
//   logic-function run.
//
// The event key is part of the URL Inngest takes it on, so no message here ever
// carries the URL: errors name the host only.

import { LEAD_STAGE_LABELS, LEAD_STAGES } from '../lead-record.ts';
import type { OpportunityEvent } from '../../../packages/client/src/events.ts';

export type DeliveryConfig = {
  /** INNGEST_EVENT_URL: the Inngest server's base URL, set in the app's settings. */
  url?: string;
  /** INNGEST_EVENT_KEY: secret, set in the app's settings from Infisical. */
  key?: string;
};

export type Attempt = { retryCount: number; maxRetries: number };

export type FailureNotice = {
  opportunityId: string;
  ownerId: string | null;
  title: string;
};

export type DeliveryDeps = {
  fetch: typeof fetch;
  /** Puts the failure where a person sees it. A failure to notify is logged, never thrown. */
  notify: (notice: FailureNotice) => Promise<void>;
  /** Thrown to ask Twenty for another attempt. */
  retryable: (message: string) => Error;
  log?: (line: string) => void;
};

export type DeliveryResult = { sent: number; ids: string[] };

class FinalFailure extends Error {}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'an unparseable URL';
  }
}

function stageLabel(value: unknown): string {
  const name = (Object.keys(LEAD_STAGES) as (keyof typeof LEAD_STAGES)[]).find((k) => LEAD_STAGES[k] === value);
  return name ? LEAD_STAGE_LABELS[name] : String(value ?? 'none');
}

/** The Task title a person reads: which event, on which lead, and why. */
export function failureTitle(events: OpportunityEvent[], reason: string): string {
  const first = events[0]!;
  const what = events.map((e) => e.name).join(', ');
  const lead = first.data.after.name ? `"${first.data.after.name}"` : first.data.opportunityId;
  const at = `stage ${stageLabel(first.data.stage)}`;
  return `Agents were not told: ${what} for ${lead} (${at}). ${reason}`.slice(0, 250);
}

export async function deliver(
  events: OpportunityEvent[],
  config: DeliveryConfig,
  attempt: Attempt,
  deps: DeliveryDeps,
): Promise<DeliveryResult> {
  if (events.length === 0) return { sent: 0, ids: [] };
  const log = deps.log ?? console.log;

  const fail = async (reason: string): Promise<never> => {
    const first = events[0]!;
    try {
      await deps.notify({ opportunityId: first.data.opportunityId, ownerId: first.data.ownerId, title: failureTitle(events, reason) });
    } catch (err) {
      log(`[opportunity-events] could not create the failure task: ${err instanceof Error ? err.message : String(err)}`);
    }
    throw new FinalFailure(`opportunity events not delivered: ${reason}`);
  };

  const url = config.url?.trim();
  const key = config.key?.trim();
  if (!url || !key) {
    const missing = [!url && 'INNGEST_EVENT_URL', !key && 'INNGEST_EVENT_KEY'].filter(Boolean).join(' and ');
    return fail(`${missing} not set in the Lead record app's settings.`);
  }

  const endpoint = `${url.replace(/\/+$/, '')}/e/${encodeURIComponent(key)}`;
  const host = hostOf(url);
  const lastAttempt = attempt.retryCount >= attempt.maxRetries;
  const transient = async (reason: string): Promise<never> => {
    if (lastAttempt) return fail(`${reason}, after ${attempt.retryCount} retries.`);
    throw deps.retryable(`${reason}; retry ${attempt.retryCount + 1} of ${attempt.maxRetries}`);
  };

  let res: Response;
  try {
    res = await deps.fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(events),
    });
  } catch (err) {
    return transient(`${host} unreachable (${err instanceof Error ? err.name : 'error'})`);
  }
  if (res.ok) {
    log(`[opportunity-events] sent ${events.map((e) => e.name).join(', ')} for ${events[0]!.data.opportunityId}`);
    return { sent: events.length, ids: events.map((e) => e.id) };
  }
  if (res.status === 429 || res.status >= 500) return transient(`${host} answered ${res.status}`);
  return fail(`${host} refused the events with ${res.status}.`);
}

/** Creates the failure Task on the Opportunity, through Twenty's REST API with the app's own token. */
export function restNotifier(apiUrl: string | undefined, token: string | undefined, fetchFn: typeof fetch) {
  return async (notice: FailureNotice): Promise<void> => {
    if (!apiUrl || !token) throw new Error('no TWENTY_API_URL or app token in the run');
    const call = async (path: string, body: Record<string, unknown>) => {
      const res = await fetchFn(`${apiUrl.replace(/\/+$/, '')}/rest/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`POST /rest/${path} answered ${res.status}`);
      return (await res.json()) as { data?: Record<string, { id?: string }> };
    };
    const task: Record<string, unknown> = { title: notice.title, status: 'TODO', dueAt: new Date().toISOString() };
    if (notice.ownerId) task.assigneeId = notice.ownerId;
    const created = await call('tasks', task);
    const taskId = created.data?.createTask?.id;
    if (!taskId) throw new Error('task create returned no id');
    await call('taskTargets', { taskId, opportunityId: notice.opportunityId });
  };
}
