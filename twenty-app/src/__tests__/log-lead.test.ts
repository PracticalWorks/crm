import { afterEach, describe, expect, it, vi } from 'vitest';

import { linkKey, logLead } from '../leads/log-lead';
import logLeadFunction from '../leads/log-lead.logic-function';
import command from '../leads/log-lead.command-menu-item';
import { LOG_LEAD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from '../constants/universal-identifiers';
import { twentyRest } from '../rest';

const POSTING = 'https://www.upwork.com/jobs/~021abc?source=rss';
const input = { link: POSTING, brandId: 'brand-1', source: 'UPWORK', type: 'CONTRACT_SEAT' };

type Call = { method: string; url: string; auth: string | null; body: any };

/** A Twenty REST API answering the duplicate lookup with `existing`, and every create with `created`. */
function twenty(existing: unknown[], created: unknown = { id: 'opp-new' }) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url: String(url), auth: new Headers(init?.headers).get('authorization'), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const data = method === 'GET' ? { opportunities: existing } : { createOpportunity: created };
    return new Response(JSON.stringify({ data }), { status: method === 'GET' ? 200 : 201 });
  }) as unknown as typeof fetch;
  return { calls, rest: twentyRest('https://twenty.test/', 'token-user', fetchFn), fetchFn };
}

describe('logLead', () => {
  it('opens an Opportunity at New, with Source detail = the link, Brand, Source and Type', async () => {
    const t = twenty([]);
    const result = await logLead(input, t.rest);
    const create = t.calls.find((c) => c.method === 'POST')!;
    expect(create.url).toBe('https://twenty.test/rest/opportunities');
    expect(create.body).toEqual({
      name: 'upwork.com/jobs/~021abc',
      stage: 'NEW',
      brandId: 'brand-1',
      source: 'UPWORK',
      leadType: 'CONTRACT_SEAT',
      sourceDetail: { primaryLinkUrl: POSTING, primaryLinkLabel: '', secondaryLinks: [] },
    });
    expect(result).toEqual({ status: 'created', opportunity: { id: 'opp-new', name: 'upwork.com/jobs/~021abc' } });
  });

  it('uses the name given, trimmed, over the one made from the link', async () => {
    const t = twenty([]);
    await logLead({ ...input, name: '  Shopify rebuild  ' }, t.rest);
    expect(t.calls.find((c) => c.method === 'POST')!.body.name).toBe('Shopify rebuild');
  });

  it('refuses a link already logged, naming the existing Opportunity, and creates nothing', async () => {
    const t = twenty([
      { id: 'opp-other', name: 'Nearby posting', sourceDetail: { primaryLinkUrl: 'https://upwork.com/jobs/~021abcdef' } },
      { id: 'opp-old', name: 'Shopify rebuild', sourceDetail: { primaryLinkUrl: 'http://upwork.com/jobs/~021abc/?source=rss#apply' } },
    ]);
    const result = await logLead(input, t.rest);
    expect(result).toEqual({
      status: 'duplicate',
      existing: { id: 'opp-old', name: 'Shopify rebuild' },
      message: 'This link is already logged as "Shopify rebuild".',
    });
    expect(t.calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('narrows the lookup on the link host and path, quoted, before comparing exactly', async () => {
    const t = twenty([{ id: 'opp-other', name: 'Nearby posting', sourceDetail: { primaryLinkUrl: 'https://upwork.com/jobs/~021abcdef' } }]);
    const result = await logLead(input, t.rest);
    const filter = new URL(t.calls[0]!.url).searchParams.get('filter');
    expect(filter).toBe('sourceDetail.primaryLinkUrl[ilike]:"%upwork.com/jobs/~021abc%"');
    expect(result.status).toBe('created');
  });

  it('fails, and creates nothing, when the duplicate lookup is refused', async () => {
    const methods: string[] = [];
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      methods.push(init?.method ?? 'GET');
      return new Response('{"data":{"opportunities":[]}}', { status: 403 });
    }) as unknown as typeof fetch;
    const err = await logLead(input, twentyRest('https://twenty.test', 'token-user', fetchFn)).catch((e) => e);
    expect(err.message).toBe('GET /rest/opportunities answered 403');
    expect(methods).toEqual(['GET']);
  });

  it('refuses input it cannot map, naming each field, and calls Twenty for none of it', async () => {
    const t = twenty([]);
    const result = await logLead({ link: 'ftp://example.test/x', brandId: ' ', source: 'FAX', type: 'GIG' }, t.rest);
    expect(result).toEqual({
      status: 'invalid',
      errors: ['link must be an http(s) URL', 'brandId is required', 'source must be one of the lead sources', 'type must be one of the lead types'],
    });
    expect(t.calls).toEqual([]);
  });
});

describe('linkKey', () => {
  it('treats scheme, www., case of the host, a trailing slash and the fragment as the same link', () => {
    expect(linkKey('HTTPS://WWW.Upwork.com/jobs/~021abc/#apply')).toBe('upwork.com/jobs/~021abc');
    expect(linkKey('http://upwork.com/jobs/~021abc')).toBe('upwork.com/jobs/~021abc');
  });

  it('keeps the query, which names the posting on some boards', () => {
    expect(linkKey('https://www.linkedin.com/jobs/search/?currentJobId=42')).toBe('linkedin.com/jobs/search?currentJobId=42');
  });

  it('has no key for what is not an http(s) URL', () => {
    expect(linkKey('not a link')).toBeNull();
    expect(linkKey('mailto:someone@example.test')).toBeNull();
  });
});

describe('the log-lead route', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is an authenticated POST at /leads/log, which the form calls as /s/leads/log', () => {
    expect(logLeadFunction.config.httpRouteTriggerSettings).toEqual({ path: '/leads/log', httpMethod: 'POST', isAuthRequired: true });
  });

  it('answers 201, 409 and 400, acting as the person who called it', async () => {
    vi.stubEnv('TWENTY_API_URL', 'https://twenty.test');
    vi.stubEnv('TWENTY_APP_ACCESS_TOKEN', 'token-user');
    vi.stubEnv('TWENTY_APP_APPLICATION_ACCESS_TOKEN', 'token-app');
    const route = (body: unknown) => ({ body, headers: {}, queryStringParameters: {}, pathParameters: {}, isBase64Encoded: false, requestContext: { http: { method: 'POST', path: '/leads/log' } }, userWorkspaceId: 'uw1' });
    const context = { retryCount: 0, maxRetries: 0, workspaceId: 'w1', userWorkspaceId: 'uw1' } as never;

    const fresh = twenty([]);
    vi.stubGlobal('fetch', fresh.fetchFn);
    expect(await logLeadFunction.config.handler(route(input), context)).toMatchObject({ status: 201, body: { status: 'created' } });
    expect(fresh.calls.every((c) => c.auth === 'Bearer token-user')).toBe(true);

    vi.stubGlobal('fetch', twenty([{ id: 'opp-old', name: 'Old', sourceDetail: { primaryLinkUrl: POSTING } }]).fetchFn);
    expect(await logLeadFunction.config.handler(route(input), context)).toMatchObject({ status: 409, body: { status: 'duplicate' } });

    expect(await logLeadFunction.config.handler(route(null), context)).toMatchObject({ status: 400, body: { status: 'invalid' } });
    vi.unstubAllGlobals();
  });
});

describe('the command-menu item', () => {
  it('opens the log-lead form from anywhere in the command menu', () => {
    expect(command.config).toMatchObject({ availabilityType: 'GLOBAL', frontComponentUniversalIdentifier: LOG_LEAD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER });
  });
});
