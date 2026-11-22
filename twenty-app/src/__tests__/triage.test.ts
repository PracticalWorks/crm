import { afterEach, describe, expect, it, vi } from 'vitest';

import { BRAND_FLOOR_RATE_FIELDS, TRIAGE_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from '../constants/universal-identifiers';
import { LEAD_STAGES, LEAD_TYPES } from '../lead-record.ts';
import { floorRate, floorRateFieldName, isBeforeEngaged, startScope, triageLead } from '../leads/triage';
import triageFunction from '../leads/triage.logic-function';
import startScopeFunction from '../leads/start-scope.logic-function';
import panelWidget from '../leads/triage-panel.widget';
import brand from '../objects/brand.object';
import { twentyRest } from '../rest';

type Call = { method: string; url: string; auth: string | null; body: any };

/** A Twenty REST API holding one Opportunity: GET answers it, PATCH echoes the update onto it. */
function twenty(opportunity: Record<string, unknown>) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url: String(url), auth: new Headers(init?.headers).get('authorization'), body });
    const data = method === 'GET' ? { opportunity } : { updateOpportunity: { ...opportunity, ...body } };
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, rest: twentyRest('https://twenty.test', 'token-user', fetchFn), fetchFn };
}

const ALL_YES = { FIT: true, PRICE: true, LEVERAGE: true, ACCESS: true, BUYER: true };
const lead = { id: 'opp-1', name: 'Shopify rebuild', stage: LEAD_STAGES.NEW };

describe('the floor rates on the Brand', () => {
  it('are one TEXT field per lead Type, named after it, with no value in the repo', () => {
    const fields = brand.config.fields.filter((f) => f.name.startsWith('floorRate'));
    expect(fields.map((f) => [f.name, f.type, f.universalIdentifier])).toEqual(
      LEAD_TYPES.map((t) => [floorRateFieldName(t.value), 'TEXT', BRAND_FLOOR_RATE_FIELDS[t.value]]),
    );
    expect(fields.map((f) => f.name)).toEqual([
      'floorRateProject',
      'floorRateContractSeat',
      'floorRateJobApplication',
      'floorRateProductSignup',
      'floorRatePartner',
    ]);
    for (const f of fields) expect(f).not.toHaveProperty('defaultValue');
  });
});

describe('floorRate', () => {
  const withBrand = (fields: Record<string, unknown>) => ({ id: 'opp-1', leadType: 'CONTRACT_SEAT', brand: { name: 'Acme', ...fields } });

  it("reads the rate set on the lead's Brand for the lead's Type", () => {
    expect(floorRate(withBrand({ floorRateContractSeat: '  $80 an hour ', floorRateProject: '$4,000' }))).toEqual({ rate: '$80 an hour' });
  });

  it('says plainly when the Brand has no rate for that Type', () => {
    expect(floorRate(withBrand({ floorRateProject: '$4,000', floorRateContractSeat: ' ' }))).toEqual({
      missing: 'No floor rate is set on Acme for Contract seat.',
    });
  });

  it('says so when the lead has no Brand or no Type', () => {
    expect(floorRate({ id: 'opp-1', leadType: 'PROJECT', brand: null })).toEqual({ missing: 'This lead has no Brand, so it has no floor rate.' });
    expect(floorRate({ id: 'opp-1', leadType: null, brand: { name: 'Acme' } })).toEqual({ missing: 'This lead has no Type, so it has no floor rate.' });
  });
});

describe('triageLead', () => {
  it('saves the five checks, the verdict and its pass reason in one update, and moves a New lead to Triaged', async () => {
    const t = twenty(lead);
    const result = await triageLead(
      { opportunityId: 'opp-1', checks: { ...ALL_YES, ACCESS: false }, verdict: 'PASS', passReason: '  Open auction, no access  ' },
      t.rest,
    );
    expect(t.calls.map((c) => `${c.method} ${c.url}`)).toEqual(['GET https://twenty.test/rest/opportunities/opp-1', 'PATCH https://twenty.test/rest/opportunities/opp-1']);
    expect(t.calls[1]!.body).toEqual({
      triageChecks: ['FIT', 'PRICE', 'LEVERAGE', 'BUYER'],
      triageVerdict: 'PASS',
      passReason: 'Open auction, no access',
      stage: LEAD_STAGES.TRIAGED,
    });
    expect(result).toEqual({ status: 'triaged', opportunity: { id: 'opp-1', name: 'Shopify rebuild', stage: LEAD_STAGES.TRIAGED } });
  });

  it('clears a stale pass reason when the verdict is not a pass', async () => {
    const t = twenty({ ...lead, passReason: 'Old reason' });
    await triageLead({ opportunityId: 'opp-1', checks: ALL_YES, verdict: 'WORK', passReason: 'ignored' }, t.rest);
    expect(t.calls[1]!.body).toMatchObject({ triageChecks: ['FIT', 'PRICE', 'LEVERAGE', 'ACCESS', 'BUYER'], triageVerdict: 'WORK', passReason: '' });
  });

  it('never moves a lead already past New back to Triaged', async () => {
    const t = twenty({ ...lead, stage: LEAD_STAGES.ENGAGED });
    const result = await triageLead({ opportunityId: 'opp-1', checks: ALL_YES, verdict: 'DEFER' }, t.rest);
    expect(t.calls[1]!.body).not.toHaveProperty('stage');
    expect(result).toMatchObject({ status: 'triaged', opportunity: { stage: LEAD_STAGES.ENGAGED } });
  });

  it('refuses a pass with no reason, an unanswered check or an unknown verdict, and calls Twenty for none of it', async () => {
    const t = twenty(lead);
    const { FIT: _fit, ...noFit } = ALL_YES;
    expect(await triageLead({ opportunityId: 'opp-1', checks: ALL_YES, verdict: 'PASS', passReason: ' ' }, t.rest)).toEqual({
      status: 'invalid',
      errors: ['a pass needs its pass reason'],
    });
    expect(await triageLead({ opportunityId: ' ', checks: { ...noFit, PRICE: 'yes' }, verdict: 'MAYBE' }, t.rest)).toEqual({
      status: 'invalid',
      errors: ['opportunityId is required', 'answer Fit yes or no', 'answer Price yes or no', 'verdict must be work, pass or defer'],
    });
    expect(t.calls).toEqual([]);
  });
});

describe('a full scope', () => {
  it('is cold when it starts before Engaged, and warm from Engaged on', () => {
    expect([LEAD_STAGES.NEW, LEAD_STAGES.TRIAGED, LEAD_STAGES.LIGHT_REPLY_SENT, null].map(isBeforeEngaged)).toEqual([true, true, true, true]);
    expect([LEAD_STAGES.ENGAGED, LEAD_STAGES.PROPOSAL_OUT, LEAD_STAGES.CLOSED].map(isBeforeEngaged)).toEqual([false, false, false]);
  });

  it('started on a Triaged lead is allowed, and marked cold', async () => {
    const t = twenty({ ...lead, stage: LEAD_STAGES.TRIAGED, fullScope: null });
    expect(await startScope({ opportunityId: 'opp-1' }, t.rest)).toEqual({ status: 'started', fullScope: 'COLD' });
    expect(t.calls[1]).toMatchObject({ method: 'PATCH', body: { fullScope: 'COLD' } });
  });

  it('started on an Engaged lead is marked warm', async () => {
    const t = twenty({ ...lead, stage: LEAD_STAGES.ENGAGED, fullScope: null });
    expect(await startScope({ opportunityId: 'opp-1' }, t.rest)).toEqual({ status: 'started', fullScope: 'WARM' });
  });

  it('keeps the mark it started with: a cold scope stays cold once the lead engages', async () => {
    const t = twenty({ ...lead, stage: LEAD_STAGES.ENGAGED, fullScope: 'COLD' });
    expect(await startScope({ opportunityId: 'opp-1' }, t.rest)).toEqual({ status: 'already', fullScope: 'COLD' });
    expect(t.calls.map((c) => c.method)).toEqual(['GET']);
  });
});

describe('the triage routes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const route = (path: string, body: unknown) => ({ body, headers: {}, queryStringParameters: {}, pathParameters: {}, isBase64Encoded: false, requestContext: { http: { method: 'POST', path } }, userWorkspaceId: 'uw1' });
  const context = { retryCount: 0, maxRetries: 0, workspaceId: 'w1', userWorkspaceId: 'uw1' } as never;

  it('are authenticated POSTs at /leads/triage and /leads/scope', () => {
    expect(triageFunction.config.httpRouteTriggerSettings).toEqual({ path: '/leads/triage', httpMethod: 'POST', isAuthRequired: true });
    expect(startScopeFunction.config.httpRouteTriggerSettings).toEqual({ path: '/leads/scope', httpMethod: 'POST', isAuthRequired: true });
  });

  it('answer 200 or 400, acting as the person who called them', async () => {
    vi.stubEnv('TWENTY_API_URL', 'https://twenty.test');
    vi.stubEnv('TWENTY_APP_ACCESS_TOKEN', 'token-user');
    vi.stubEnv('TWENTY_APP_APPLICATION_ACCESS_TOKEN', 'token-app');
    const t = twenty({ ...lead, fullScope: null });
    vi.stubGlobal('fetch', t.fetchFn);

    const body = { opportunityId: 'opp-1', checks: ALL_YES, verdict: 'WORK' };
    expect(await triageFunction.config.handler(route('/leads/triage', body), context)).toMatchObject({ status: 200, body: { status: 'triaged' } });
    expect(await triageFunction.config.handler(route('/leads/triage', null), context)).toMatchObject({ status: 400, body: { status: 'invalid' } });
    expect(await startScopeFunction.config.handler(route('/leads/scope', { opportunityId: 'opp-1' }), context)).toMatchObject({ status: 200, body: { status: 'started' } });
    expect(await startScopeFunction.config.handler(route('/leads/scope', {}), context)).toMatchObject({ status: 400, body: { status: 'invalid' } });
    expect(t.calls.length).toBeGreaterThan(0);
    expect(t.calls.every((c) => c.auth === 'Bearer token-user')).toBe(true);
  });
});

describe('the panel', () => {
  it('sits on the Home tab of the Opportunity record page, below the built-in widgets', () => {
    expect(panelWidget.config).toMatchObject({
      type: 'FRONT_COMPONENT',
      position: { layoutMode: 'VERTICAL_LIST', index: 1000 },
      configuration: { configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: TRIAGE_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER },
    });
    expect(panelWidget.config.pageLayoutTabUniversalIdentifier).toMatch(/^[0-9a-f-]{36}$/);
  });
});
