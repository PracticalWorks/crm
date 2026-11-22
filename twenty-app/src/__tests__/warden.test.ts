import { describe, expect, it, vi } from 'vitest';

vi.mock('twenty-sdk/logic-function', async (importOriginal) => {
  const store = new Map<string, unknown>();
  return {
    ...(await importOriginal<object>()),
    kv: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
      delete: vi.fn(async (key: string) => store.delete(key)),
    },
  };
});

import { kv } from 'twenty-sdk/logic-function';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { WARDEN_LOGIC_FUNCTIONS, WARDEN_TASK_FIELDS } from '../constants/universal-identifiers';
import role from '../default-role';
import wardenRuleField from '../fields/task-warden-rule.field';
import { LEAD_STAGES } from '../lead-record.ts';
import { twentyRest } from '../rest';
import { businessDaysBetween } from '../warden/business-days';
import createdFn from '../warden/lead-warden-created.logic-function';
import sweepFn from '../warden/lead-warden-sweep.logic-function';
import updatedFn from '../warden/lead-warden-updated.logic-function';
import { kvCursor, SWEEP_CURSOR_KEY } from '../warden/run';
import { reconcileLead, reconcileLeadById, sweep, WARDEN_RULES, type CursorStore, type WardenLead } from '../warden/warden';

// 2026-11-16 is a Monday.
const at = (day: string, time = '09:00') => `2026-11-${day}T${time}:00.000Z`;
const MON = '16', TUE = '17', WED = '18', FRI = '20', MON2 = '23', TUE2 = '24', WED2 = '25', THU2 = '26';

type Row = Record<string, any>;
type Call = { method: string; path: string; body: any };

/**
 * A Twenty REST API with leads, tasks, task targets and note targets in memory.
 * Answers exactly the calls the warden makes; anything else is a 500, so a write
 * the warden should never make fails loudly.
 */
function twenty(opportunities: Row[], seed: { tasks?: Row[]; targets?: Row[]; notes?: Row[] } = {}) {
  const tasks = [...(seed.tasks ?? [])];
  const targets = [...(seed.targets ?? [])];
  const notes = [...(seed.notes ?? [])];
  const calls: Call[] = [];
  let clock = Date.parse(at(MON));
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const u = new URL(String(url));
    const path = decodeURIComponent(u.pathname.replace(/^\/rest\//, ''));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const filter = u.searchParams.get('filter') ?? '';
    calls.push({ method, path: `${path}${u.search ? decodeURIComponent(u.search) : ''}`, body });
    const ok = (data: unknown, extra: object = {}) => new Response(JSON.stringify({ data, ...extra }), { status: 200 });
    const byOpp = (rows: Row[]) => rows.filter((r) => filter === `targetOpportunityId[eq]:${r.targetOpportunityId}`);

    if (method === 'GET' && path.startsWith('opportunities/')) {
      return ok({ opportunity: opportunities.find((o) => o.id === path.split('/')[1]) ?? null });
    }
    if (method === 'GET' && path === 'opportunities' && filter.startsWith('sourceDetail.primaryLinkUrl[ilike]')) {
      const needle = filter.match(/"%(.*)%"/)![1]!;
      return ok({ opportunities: opportunities.filter((o) => (o.sourceDetail?.primaryLinkUrl ?? '').includes(needle)) });
    }
    if (method === 'GET' && path === 'opportunities' && filter === `stage[neq]:${LEAD_STAGES.CLOSED}`) {
      const open = opportunities.filter((o) => o.stage !== LEAD_STAGES.CLOSED);
      const limit = Number(u.searchParams.get('limit'));
      const after = u.searchParams.get('starting_after');
      const start = after ? open.findIndex((o) => o.id === after) + 1 : 0;
      const page = open.slice(start, start + limit);
      return ok({ opportunities: page }, { pageInfo: { hasNextPage: start + limit < open.length, endCursor: page.at(-1)?.id ?? null } });
    }
    if (method === 'GET' && path === 'taskTargets') {
      return ok({ taskTargets: byOpp(targets).map((t) => ({ ...t, task: tasks.find((k) => k.id === t.taskId) ?? null })) });
    }
    if (method === 'GET' && path === 'noteTargets') return ok({ noteTargets: byOpp(notes) });
    if (method === 'POST' && path === 'tasks') {
      const task = { id: `task-${tasks.length + 1}`, createdAt: new Date((clock += 1000)).toISOString(), ...body };
      tasks.push(task);
      return ok({ createTask: { id: task.id } });
    }
    if (method === 'POST' && path === 'taskTargets') {
      targets.push(body);
      return ok({ createTaskTarget: { id: `target-${targets.length}` } });
    }
    if (method === 'PATCH' && path.startsWith('tasks/')) {
      const task = tasks.find((t) => t.id === path.split('/')[1])!;
      Object.assign(task, body);
      return ok({ updateTask: task });
    }
    return new Response('{}', { status: 500 });
  }) as unknown as typeof fetch;
  const setClock = (iso: string) => void (clock = Date.parse(iso));
  return { calls, tasks, targets, notes, setClock, fetchFn, rest: twentyRest('https://twenty.test', 'token-app', fetchFn) };
}

const openTasks = (tasks: Row[], rule?: string) => tasks.filter((t) => t.status !== 'DONE' && (!rule || t.wardenRule === rule));

/** A complete lead: Brand and Source set, owned, at New. */
function lead(fields: Partial<WardenLead> & Row = {}): WardenLead & Row {
  return { id: 'opp-1', name: 'Shopify rebuild', stage: LEAD_STAGES.NEW, brandId: 'brand-1', source: 'UPWORK', ownerId: 'member-1', createdAt: at(MON), updatedAt: at(MON), ...fields };
}

describe('businessDaysBetween', () => {
  it('counts Monday to Friday only, so a weekend never ages anything', () => {
    expect(businessDaysBetween(new Date(at(FRI, '17:00')), new Date(at(TUE2, '17:00')))).toBe(2);
    expect(businessDaysBetween(new Date(at(FRI, '17:00')), new Date(at(TUE2, '17:01')))).toBeGreaterThan(2);
    expect(businessDaysBetween(new Date('2026-11-21T08:00:00.000Z'), new Date(at(MON2, '00:00')))).toBe(0);
    expect(businessDaysBetween(new Date(at(MON)), new Date(at(MON2)))).toBe(5);
  });

  it('is zero for a missing or unparseable start', () => {
    expect(businessDaysBetween(new Date(''), new Date(at(THU2)))).toBe(0);
  });
});

describe('an untriaged lead', () => {
  it('gets one Task for its owner after more than 2 business days, and the Task closes itself once triaged', async () => {
    const opp = lead();
    const t = twenty([opp]);
    expect(await reconcileLead(opp, t.rest, new Date(at(WED, '08:59')))).toEqual({ opened: [], closed: [] });

    expect(await reconcileLead(opp, t.rest, new Date(at(WED, '09:01')))).toEqual({ opened: ['UNTRIAGED'], closed: [] });
    expect(t.tasks).toHaveLength(1);
    expect(t.tasks[0]).toMatchObject({ status: 'TODO', assigneeId: 'member-1', wardenRule: 'UNTRIAGED' });
    expect(t.tasks[0]!.title).toContain('Triage "Shopify rebuild"');
    expect(t.targets).toEqual([{ taskId: 'task-1', targetOpportunityId: 'opp-1' }]);

    await reconcileLead(opp, t.rest, new Date(at(THU2)));
    expect(t.tasks).toHaveLength(1);

    Object.assign(opp, { stage: LEAD_STAGES.TRIAGED, triageVerdict: 'WORK', updatedAt: at(THU2) });
    expect(await reconcileLead(opp, t.rest, new Date(at(THU2, '10:00')))).toEqual({ opened: [], closed: ['UNTRIAGED'] });
    expect(openTasks(t.tasks)).toEqual([]);
  });

  it('is not stale over a weekend: logged Friday, still under 2 business days on Monday', async () => {
    const opp = lead({ createdAt: at(FRI), updatedAt: at(FRI) });
    const t = twenty([opp]);
    expect((await reconcileLead(opp, t.rest, new Date(at(MON2, '23:00')))).opened).toEqual([]);
    expect((await reconcileLead(opp, t.rest, new Date(at(TUE2, '09:01')))).opened).toEqual(['UNTRIAGED']);
  });

  it('counts as triaged once a verdict is saved, even while still at New', async () => {
    const opp = lead({ triageVerdict: 'DEFER' });
    expect((await reconcileLead(opp, twenty([opp]).rest, new Date(at(THU2)))).opened).toEqual([]);
  });

  it('opens no second Task after its owner closes one by hand while it is still untriaged', async () => {
    const opp = lead();
    const t = twenty([opp]);
    await reconcileLead(opp, t.rest, new Date(at(WED, '10:00')));
    t.tasks[0]!.status = 'DONE';
    expect((await reconcileLead(opp, t.rest, new Date(at(THU2)))).opened).toEqual([]);
  });
});

describe('a quiet proposal', () => {
  const contact = { emails: { primaryEmail: 'pat@example.com' }, phones: { primaryPhoneNumber: '' } };
  const proposal = (fields: Row = {}) => lead({ stage: LEAD_STAGES.PROPOSAL_OUT, triageVerdict: 'WORK', pointOfContact: contact, ...fields });

  it('gets a Task after more than 5 business days with no touch', async () => {
    const opp = proposal();
    const t = twenty([opp]);
    expect((await reconcileLead(opp, t.rest, new Date(at(MON2, '08:59')))).opened).toEqual([]);
    expect((await reconcileLead(opp, t.rest, new Date(at(MON2, '09:01')))).opened).toEqual(['PROPOSAL_QUIET']);
    expect(t.tasks[0]).toMatchObject({ wardenRule: 'PROPOSAL_QUIET', assigneeId: 'member-1' });
  });

  it('gets none when the lead has no channel we can send from', async () => {
    const opp = proposal({ pointOfContact: { emails: { primaryEmail: ' ' }, phones: { primaryPhoneNumber: '' } } });
    const t = twenty([opp]);
    expect((await reconcileLead(opp, t.rest, new Date(at(THU2)))).opened).toEqual([]);
    expect(t.calls.some((c) => c.path.startsWith('noteTargets'))).toBe(false);
  });

  it('counts a phone number as a channel', async () => {
    const opp = proposal({ pointOfContact: { emails: null, phones: { primaryPhoneNumber: '5550100' } } });
    expect((await reconcileLead(opp, twenty([opp]).rest, new Date(at(THU2)))).opened).toEqual(['PROPOSAL_QUIET']);
  });

  it('closes its Task on a new note, and opens a fresh one when the lead goes quiet again', async () => {
    const opp = proposal();
    const t = twenty([opp]);
    t.setClock(at(MON2, '10:00'));
    await reconcileLead(opp, t.rest, new Date(at(MON2, '10:00')));
    t.notes.push({ targetOpportunityId: 'opp-1', note: { createdAt: at(TUE2), updatedAt: at(TUE2) } });
    expect(await reconcileLead(opp, t.rest, new Date(at(TUE2, '10:00')))).toEqual({ opened: [], closed: ['PROPOSAL_QUIET'] });

    t.setClock('2026-12-02T10:00:00.000Z');
    expect((await reconcileLead(opp, t.rest, new Date('2026-12-02T10:00:00.000Z'))).opened).toEqual(['PROPOSAL_QUIET']);
    expect(openTasks(t.tasks, 'PROPOSAL_QUIET')).toHaveLength(1);
  });

  it('keeps its open Task, opening no second, when a touch the sweep missed is itself 5 business days old', async () => {
    const opp = proposal();
    const t = twenty([opp], {
      tasks: [{ id: 'open', status: 'TODO', wardenRule: 'PROPOSAL_QUIET', createdAt: at(MON, '10:00') }],
      targets: [{ taskId: 'open', targetOpportunityId: 'opp-1' }],
      notes: [{ targetOpportunityId: 'opp-1', note: { createdAt: at(TUE) } }],
    });
    expect(await reconcileLead(opp, t.rest, new Date(at(WED2, '10:00')))).toEqual({ opened: [], closed: [] });
    expect(openTasks(t.tasks)).toHaveLength(1);
  });

  it("is touched by the lead's other Tasks, never by the warden's own", async () => {
    const opp = proposal();
    const t = twenty([opp], {
      tasks: [{ id: 'mine', status: 'DONE', createdAt: at(MON), updatedAt: at(FRI) }],
      targets: [{ taskId: 'mine', targetOpportunityId: 'opp-1' }],
    });
    expect((await reconcileLead(opp, t.rest, new Date(at(THU2)))).opened).toEqual([]);
    t.tasks[0]!.wardenRule = 'UNTRIAGED';
    expect((await reconcileLead(opp, t.rest, new Date(at(THU2)))).opened).toEqual(['PROPOSAL_QUIET']);
  });
});

describe('an incomplete lead', () => {
  it('gets a Task naming what is missing, closed once Brand and Source are both set', async () => {
    const opp = lead({ brandId: null, source: null });
    const t = twenty([opp]);
    expect((await reconcileLead(opp, t.rest, new Date(at(MON, '09:05')))).opened).toEqual(['MISSING_BRAND_OR_SOURCE']);
    expect(t.tasks[0]!.title).toBe('Set Brand and Source on "Shopify rebuild"');

    opp.brandId = 'brand-1';
    expect((await reconcileLead(opp, t.rest, new Date(at(MON, '09:10')))).closed).toEqual([]);
    opp.source = 'REFERRAL';
    expect((await reconcileLead(opp, t.rest, new Date(at(MON, '09:15')))).closed).toEqual(['MISSING_BRAND_OR_SOURCE']);
  });

  it('holds on a missing Source alone', async () => {
    const opp = lead({ source: '' });
    const t = twenty([opp]);
    await reconcileLead(opp, t.rest, new Date(at(MON, '09:05')));
    expect(t.tasks[0]!.title).toBe('Set Source on "Shopify rebuild"');
  });
});

describe('a link logged twice', () => {
  it('puts one Task on the later lead, naming the earlier, matching the link as the log-lead form does', async () => {
    const first = lead({ id: 'opp-a', name: 'First', sourceDetail: { primaryLinkUrl: 'https://www.upwork.com/jobs/~01abc/' } });
    const again = lead({ id: 'opp-b', name: 'Again', createdAt: at(TUE), sourceDetail: { primaryLinkUrl: 'http://upwork.com/jobs/~01abc' } });
    const t = twenty([first, again]);
    expect((await reconcileLead(first, t.rest, new Date(at(TUE, '10:00')))).opened).toEqual([]);
    expect((await reconcileLead(again, t.rest, new Date(at(TUE, '10:00')))).opened).toEqual(['DUPLICATE_LINK']);
    expect(t.tasks[0]!.title).toBe('"Again" repeats the link of "First": keep one');
    expect(t.targets[0]).toEqual({ taskId: 'task-1', targetOpportunityId: 'opp-b' });

    again.sourceDetail = { primaryLinkUrl: 'https://upwork.com/jobs/~02xyz' };
    expect((await reconcileLead(again, t.rest, new Date(at(TUE, '11:00')))).closed).toEqual(['DUPLICATE_LINK']);
  });

  it('is not a repeat when the query string names a different posting', async () => {
    const first = lead({ id: 'opp-a', sourceDetail: { primaryLinkUrl: 'https://board.example/job?id=1' } });
    const other = lead({ id: 'opp-b', createdAt: at(TUE), sourceDetail: { primaryLinkUrl: 'https://board.example/job?id=2' } });
    expect((await reconcileLead(other, twenty([first, other]).rest, new Date(at(TUE, '10:00')))).opened).toEqual([]);
  });
});

describe('the warden', () => {
  it('keeps one open Task per rule when a race left two, closing the newer', async () => {
    const opp = lead();
    const t = twenty([opp], {
      tasks: [
        { id: 'old', status: 'TODO', wardenRule: 'UNTRIAGED', createdAt: at(WED, '10:00') },
        { id: 'new', status: 'TODO', wardenRule: 'UNTRIAGED', createdAt: at(WED, '10:01') },
      ],
      targets: [
        { taskId: 'new', targetOpportunityId: 'opp-1' },
        { taskId: 'old', targetOpportunityId: 'opp-1' },
      ],
    });
    expect(await reconcileLead(opp, t.rest, new Date(at(THU2)))).toEqual({ opened: [], closed: ['UNTRIAGED'] });
    expect(openTasks(t.tasks).map((x) => x.id)).toEqual(['old']);
  });

  it('closes every open warden Task once the lead is closed, and leaves other Tasks alone', async () => {
    const opp = lead({ brandId: null, stage: LEAD_STAGES.CLOSED });
    const t = twenty([opp], {
      tasks: [
        { id: 'w', status: 'TODO', wardenRule: 'MISSING_BRAND_OR_SOURCE', createdAt: at(MON) },
        { id: 'human', status: 'TODO', createdAt: at(MON) },
      ],
      targets: [
        { taskId: 'w', targetOpportunityId: 'opp-1' },
        { taskId: 'human', targetOpportunityId: 'opp-1' },
      ],
    });
    expect((await reconcileLead(opp, t.rest, new Date(at(THU2)))).closed).toEqual(['MISSING_BRAND_OR_SOURCE']);
    expect(openTasks(t.tasks).map((x) => x.id)).toEqual(['human']);
  });

  it('leaves a lead with no owner with an unassigned Task rather than none', async () => {
    const opp = lead({ ownerId: null, source: null });
    const t = twenty([opp]);
    await reconcileLead(opp, t.rest, new Date(at(MON, '10:00')));
    expect(t.tasks[0]).not.toHaveProperty('assigneeId');
  });

  it('closes a Task it could not link, so the next pass never opens a twin', async () => {
    const opp = lead({ source: null });
    const t = twenty([opp]);
    const failing = (async (url: string, init?: RequestInit) =>
      String(url).endsWith('/rest/taskTargets') && init?.method === 'POST' ? new Response('{}', { status: 400 }) : t.fetchFn(url, init)) as typeof fetch;
    await expect(reconcileLead(opp, twentyRest('https://twenty.test', 'token-app', failing), new Date(at(MON, '10:00')))).rejects.toThrow(
      'POST /rest/taskTargets answered 400',
    );
    expect(t.tasks[0]).toMatchObject({ status: 'DONE' });
  });

  it('never writes an Opportunity, in any rule, so it never moves a stage', async () => {
    const leads = [
      lead({ id: 'a' }),
      lead({ id: 'b', stage: LEAD_STAGES.PROPOSAL_OUT, triageVerdict: 'WORK', pointOfContact: { emails: { primaryEmail: 'p@example.com' } } }),
      lead({ id: 'c', brandId: null, sourceDetail: { primaryLinkUrl: 'https://x.example/1' } }),
      lead({ id: 'd', createdAt: at(TUE), sourceDetail: { primaryLinkUrl: 'https://x.example/1' } }),
    ];
    const t = twenty(leads);
    for (const l of leads) await reconcileLead(l, t.rest, new Date(at(THU2)));
    for (const l of leads) Object.assign(l, { stage: LEAD_STAGES.CLOSED });
    for (const l of leads) await reconcileLead(l, t.rest, new Date(at(THU2)));
    expect(t.tasks.length).toBeGreaterThanOrEqual(4);
    expect(t.calls.filter((c) => c.method !== 'GET' && !/^tasks|^taskTargets/.test(c.path))).toEqual([]);
  });

  it('reads the lead fresh by id on a record event', async () => {
    const t = twenty([lead({ source: null })]);
    expect((await reconcileLeadById('opp-1', t.rest, new Date(at(MON, '10:00')))).opened).toEqual(['MISSING_BRAND_OR_SOURCE']);
    expect(t.calls[0]).toMatchObject({ method: 'GET', path: 'opportunities/opp-1?depth=1' });
  });
});

describe('the sweep', () => {
  const memory = (start: string | null = null): CursorStore & { saved: (string | null)[] } => {
    const saved: (string | null)[] = [];
    let at: string | null = start;
    return { saved, get: async () => at, set: async (v) => void saved.push((at = v)) };
  };

  it('works one page of open leads per run from the stored cursor, and starts a new lap after the last', async () => {
    const leads = ['a', 'b', 'c'].map((id) => lead({ id }));
    leads.push(lead({ id: 'closed', stage: LEAD_STAGES.CLOSED }));
    const t = twenty(leads);
    const cursor = memory();
    const now = new Date(at(THU2));
    expect(await sweep(t.rest, cursor, now, 2)).toEqual({ leads: 2, opened: 2, closed: 0, next: 'b' });
    expect(await sweep(t.rest, cursor, now, 2)).toEqual({ leads: 1, opened: 1, closed: 0, next: null });
    expect(await sweep(t.rest, cursor, now, 2)).toMatchObject({ leads: 2, opened: 0, next: 'b' });
    expect(cursor.saved).toEqual(['b', null, 'b']);
    expect(t.calls.filter((c) => c.path.startsWith('opportunities?filter=stage')).map((c) => c.path)).toEqual([
      'opportunities?filter=stage[neq]:CUSTOMER&depth=1&limit=2',
      'opportunities?filter=stage[neq]:CUSTOMER&depth=1&limit=2&starting_after=b',
      'opportunities?filter=stage[neq]:CUSTOMER&depth=1&limit=2',
    ]);
  });

  it('runs every lead even when one fails, saves the cursor, then fails the run naming the lead', async () => {
    const t = twenty([lead({ id: 'a' }), lead({ id: 'b' })]);
    const breaking = (async (url: string, init?: RequestInit) =>
      decodeURIComponent(String(url)).includes('targetOpportunityId[eq]:a') ? new Response('{}', { status: 503 }) : t.fetchFn(url, init)) as typeof fetch;
    const cursor = memory();
    await expect(sweep(twentyRest('https://twenty.test', 'token-app', breaking), cursor, new Date(at(THU2)), 5)).rejects.toThrow(
      'lead warden: 1 lead(s) not reconciled: a: GET /rest/taskTargets answered 503',
    );
    expect(openTasks(t.tasks).map((x) => t.targets.find((g) => g.taskId === x.id)?.targetOpportunityId)).toEqual(['b']);
    expect(cursor.saved).toEqual([null]);
  });

  it("keeps its cursor in the app's key-value store", async () => {
    await kvCursor.set('cursor-1');
    expect(kv.set).toHaveBeenCalledWith(SWEEP_CURSOR_KEY, { after: 'cursor-1' });
    expect(await kvCursor.get()).toBe('cursor-1');
    await kvCursor.set(null);
    expect(await kvCursor.get()).toBeNull();
  });
});

describe('the warden declarations', () => {
  it('run on cron and on lead create and update events', () => {
    expect(sweepFn.config).toMatchObject({ universalIdentifier: WARDEN_LOGIC_FUNCTIONS.sweep, cronTriggerSettings: { pattern: '*/10 * * * *' } });
    expect(createdFn.config).toMatchObject({ universalIdentifier: WARDEN_LOGIC_FUNCTIONS.leadCreated, databaseEventTriggerSettings: { eventName: 'opportunity.created' } });
    expect(updatedFn.config).toMatchObject({ universalIdentifier: WARDEN_LOGIC_FUNCTIONS.leadUpdated, databaseEventTriggerSettings: { eventName: 'opportunity.updated' } });
  });

  it('mark their Tasks with a Warden rule select holding the four rules', () => {
    expect(wardenRuleField.config).toMatchObject({
      universalIdentifier: WARDEN_TASK_FIELDS.wardenRule,
      objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
      type: 'SELECT',
      name: 'wardenRule',
    });
    expect(wardenRuleField.config.options!.map((o: { value: string }) => o.value)).toEqual(WARDEN_RULES.map((r) => r.value));
  });

  it("run as a role that cannot update an Opportunity, and may read a lead's contact and notes", () => {
    const perms = Object.fromEntries(role.config.objectPermissions!.map((p) => [p.objectUniversalIdentifier, p]));
    const ids = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS;
    expect(role.config.canUpdateAllObjectRecords).toBe(false);
    expect(perms[ids.opportunity.universalIdentifier]).toMatchObject({ canReadObjectRecords: true, canUpdateObjectRecords: false });
    for (const o of [ids.person, ids.note, ids.noteTarget]) expect(perms[o.universalIdentifier]).toMatchObject({ canReadObjectRecords: true, canUpdateObjectRecords: false });
    expect(perms[ids.task.universalIdentifier]).toMatchObject({ canUpdateObjectRecords: true });
  });
});
