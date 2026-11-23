import { afterEach, describe, expect, it, vi } from 'vitest';

import { deliver, failureTitle, restNotifier, type FailureNotice } from '../events/deliver';
import { handleOpportunityEvent, toChange } from '../events/handle';
import { opportunityEvents } from '../../../packages/client/src/events.ts';
import opened from '../events/opportunity-opened.logic-function';
import changed from '../events/opportunity-changed.logic-function';
import role from '../default-role';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

const KEY = 'test-event-key';
const config = { url: 'https://inngest.test/', key: KEY };
const before = { id: 'opp1', name: 'Shop floor', stage: 'SCREENING', ownerId: 'member1', brandId: 'brand1', leadType: 'PROJECT', updatedAt: 't0' };
const after = { ...before, stage: 'MEETING', updatedAt: 't1' };
const events = opportunityEvents({ operation: 'updated', recordId: 'opp1', before, after });

class Retry extends Error {}

function harness(responses: Array<Response | Error>) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const notices: FailureNotice[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = responses.shift()!;
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  const deps = {
    fetch: fetchFn,
    notify: async (n: FailureNotice) => void notices.push(n),
    retryable: (m: string) => new Retry(m),
    log: () => {},
  };
  return { calls, notices, deps };
}

describe('deliver', () => {
  it('posts the events to <url>/e/<key> once and reports their ids', async () => {
    const h = harness([new Response('{}', { status: 200 })]);
    const result = await deliver(events, config, { retryCount: 0, maxRetries: 3 }, h.deps);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.url).toBe(`https://inngest.test/e/${KEY}`);
    expect(h.calls[0]!.body).toEqual(events);
    expect(result).toEqual({ sent: 1, ids: ['opp1:crm/opportunity.stage-changed:t1'] });
    expect(h.notices).toEqual([]);
  });

  it('asks for a retry on 5xx, 429 and network errors, naming the host and never the key', async () => {
    for (const failure of [new Response('', { status: 503 }), new Response('', { status: 429 }), new TypeError('fetch failed')]) {
      const h = harness([failure]);
      const err = await deliver(events, config, { retryCount: 1, maxRetries: 3 }, h.deps).catch((e) => e);
      expect(err).toBeInstanceOf(Retry);
      expect(err.message).toContain('inngest.test');
      expect(err.message).toContain('retry 2 of 3');
      expect(err.message).not.toContain(KEY);
      expect(h.notices).toEqual([]);
    }
  });

  it('on the last attempt, tells the owner with a Task on the lead and fails the run', async () => {
    const h = harness([new Response('', { status: 502 })]);
    const err = await deliver(events, config, { retryCount: 3, maxRetries: 3 }, h.deps).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(Retry);
    expect(h.notices).toHaveLength(1);
    expect(h.notices[0]).toMatchObject({ opportunityId: 'opp1', ownerId: 'member1' });
    expect(h.notices[0]!.title).toContain('crm/opportunity.stage-changed');
    expect(h.notices[0]!.title).toContain('"Shop floor"');
    expect(h.notices[0]!.title).toContain('stage Engaged');
    expect(h.notices[0]!.title).not.toContain(KEY);
  });

  it('treats a 4xx refusal as final at once: no retry, a Task, a failed run', async () => {
    const h = harness([new Response('', { status: 401 })]);
    const err = await deliver(events, config, { retryCount: 0, maxRetries: 3 }, h.deps).catch((e) => e);
    expect(err).not.toBeInstanceOf(Retry);
    expect(err.message).toContain('401');
    expect(h.notices).toHaveLength(1);
  });

  it('never sends without a URL and key, and says which setting is missing', async () => {
    const h = harness([]);
    const err = await deliver(events, { url: 'https://inngest.test' }, { retryCount: 0, maxRetries: 3 }, h.deps).catch((e) => e);
    expect(h.calls).toEqual([]);
    expect(err.message).toContain('INNGEST_EVENT_KEY not set');
    expect(h.notices[0]!.title).toContain('INNGEST_EVENT_KEY');
  });

  it('still fails the run when the Task itself cannot be created', async () => {
    const h = harness([new Response('', { status: 400 })]);
    h.deps.notify = async () => {
      throw new Error('task create refused');
    };
    await expect(deliver(events, config, { retryCount: 0, maxRetries: 3 }, h.deps)).rejects.toThrow('400');
  });

  it('sends nothing for a change that produces no events', async () => {
    const h = harness([]);
    expect(await deliver([], config, { retryCount: 0, maxRetries: 3 }, h.deps)).toEqual({ sent: 0, ids: [] });
    expect(h.calls).toEqual([]);
  });

  it('keeps the Task title short enough for Twenty', () => {
    expect(failureTitle(events, 'x'.repeat(500)).length).toBeLessThanOrEqual(250);
  });
});

describe('restNotifier', () => {
  it('creates the Task for the owner, then targets it at the Opportunity through targetOpportunityId', async () => {
    const calls: Array<{ url: string; auth: string | null; body: any }> = [];
    const fetchFn = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), auth: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ data: { createTask: { id: 'task1' } } }), { status: 201 });
    }) as unknown as typeof fetch;
    await restNotifier('https://twenty.test/', 'app-token', fetchFn)({ opportunityId: 'opp1', ownerId: 'member1', title: 'T' });
    expect(calls.map((c) => c.url)).toEqual(['https://twenty.test/rest/tasks', 'https://twenty.test/rest/taskTargets']);
    expect(calls[0]!.body).toMatchObject({ title: 'T', status: 'TODO', assigneeId: 'member1' });
    // Twenty 2.x's morph relation: a bare `opportunityId` is a 400, so the Task never reaches the lead.
    expect(calls[1]!.body).toEqual({ taskId: 'task1', targetOpportunityId: 'opp1' });
    expect(calls[0]!.auth).toBe('Bearer app-token');
  });
});

describe('the hooks', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('fire on Opportunity create, and on updates to stage, Type, Step and Outcome only', () => {
    expect(opened.config.databaseEventTriggerSettings).toEqual({ eventName: 'opportunity.created' });
    expect(changed.config.databaseEventTriggerSettings).toEqual({
      eventName: 'opportunity.updated',
      updatedFields: ['stage', 'leadType', 'step', 'outcome'],
    });
  });

  it('run as a role that can read Opportunities, or Twenty never delivers their events', () => {
    const grants = (role.config.objectPermissions ?? []) as Array<{ objectUniversalIdentifier: string; canReadObjectRecords?: boolean; canUpdateObjectRecords?: boolean }>;
    const opportunity = grants.find((g) => g.objectUniversalIdentifier === STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier);
    expect(opportunity).toMatchObject({ canReadObjectRecords: true, canUpdateObjectRecords: false });
  });

  it('read a created event as opened and an updated one as a change', () => {
    expect(toChange({ recordId: 'opp1', properties: { after } })).toMatchObject({ operation: 'created' });
    expect(toChange({ recordId: 'opp1', workspaceMemberId: 'm2', properties: { before, after } })).toMatchObject({ operation: 'updated', actorId: 'm2' });
    expect(toChange({ recordId: 'opp1', properties: {} })).toBeNull();
  });

  it('send a drag to Engaged as one stage-changed event with both stages, using the app settings', async () => {
    vi.stubEnv('INNGEST_EVENT_URL', 'https://inngest.test');
    vi.stubEnv('INNGEST_EVENT_KEY', KEY);
    const bodies: any[] = [];
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    await handleOpportunityEvent({ recordId: 'opp1', properties: { before, after, updatedFields: ['stage'] } }, { retryCount: 0, maxRetries: 3 }, fetchFn);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toHaveLength(1);
    expect(bodies[0][0]).toMatchObject({ name: 'crm/opportunity.stage-changed', data: { fromStage: 'SCREENING', toStage: 'MEETING' } });
  });
});
