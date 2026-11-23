// Logs a lead that has no app (an Upwork or LinkedIn posting, an outreach reply)
// from its link: one Opportunity at New, under its Brand, with the link as its
// Source detail. A link already logged is refused, naming the Opportunity that has
// it. The refusal lives here, behind the route, so every caller gets it: the
// command-menu form and any agent that posts to the same route.

import { LEAD_SOURCES, LEAD_STAGES, LEAD_TYPES, type LeadSource, type LeadType } from '../lead-record.ts';
import { toOpportunityBody } from '../../../packages/client/src/client.ts';
import type { TwentyRest } from '../rest';

export type LogLeadInput = { link: string; brandId: string; source: LeadSource; type: LeadType; name?: string };

export type LoggedOpportunity = { id: string; name: string };

export type LogLeadResult =
  | { status: 'created'; opportunity: LoggedOpportunity }
  | { status: 'duplicate'; existing: LoggedOpportunity; message: string }
  | { status: 'invalid'; errors: string[] };

/**
 * What makes two links the same posting: host without `www.`, path without a
 * trailing slash, and the query, which names the posting on some boards. Scheme,
 * host case and the fragment are ignored. Null for anything not http(s).
 */
export function linkKey(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`;
}

const SOURCES: readonly string[] = LEAD_SOURCES.map((o) => o.value);
const TYPES: readonly string[] = LEAD_TYPES.map((o) => o.value);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function validate(input: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!linkKey(text(input.link))) errors.push('link must be an http(s) URL');
  if (!text(input.brandId)) errors.push('brandId is required');
  if (!SOURCES.includes(text(input.source))) errors.push('source must be one of the lead sources');
  if (!TYPES.includes(text(input.type))) errors.push('type must be one of the lead types');
  return errors;
}

type OpportunityRow = { id?: string; name?: string; createdAt?: string; sourceDetail?: { primaryLinkUrl?: string } | null };

/** Every Opportunity whose Source detail is this link. Twenty narrows with ilike; the match is exact here. */
export async function opportunitiesWithLink(key: string, rest: TwentyRest): Promise<(LoggedOpportunity & { createdAt?: string })[]> {
  // Narrowed on host and path only. URL parsing has already percent-encoded any quote.
  const narrow = key.replace(/\?.*$/, '');
  const filter = encodeURIComponent(`sourceDetail.primaryLinkUrl[ilike]:"%${narrow}%"`);
  const res = await rest<{ data?: { opportunities?: OpportunityRow[] } }>('GET', `opportunities?filter=${filter}&limit=60`);
  return (res.data?.opportunities ?? [])
    .filter((o) => o?.id && linkKey(o.sourceDetail?.primaryLinkUrl ?? '') === key)
    .map((o) => ({ id: String(o.id), name: o.name ?? '', ...(o.createdAt && { createdAt: o.createdAt }) }));
}

export async function logLead(raw: unknown, rest: TwentyRest): Promise<LogLeadResult> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors = validate(input);
  if (errors.length > 0) return { status: 'invalid', errors };

  const link = text(input.link);
  const key = linkKey(link)!;
  const [hit] = await opportunitiesWithLink(key, rest);
  if (hit) {
    const existing = { id: hit.id, name: hit.name };
    return { status: 'duplicate', existing, message: `This link is already logged as "${existing.name}".` };
  }

  const name = text(input.name) || key.replace(/\?.*$/, '');
  const body = toOpportunityBody({
    name,
    stage: LEAD_STAGES.NEW,
    brandId: text(input.brandId),
    source: text(input.source) as LeadSource,
    type: text(input.type) as LeadType,
    sourceDetail: link,
  });
  const res = await rest<{ data?: Record<string, OpportunityRow> }>('POST', 'opportunities', body);
  const created = res.data?.createOpportunity ?? res.data?.opportunity;
  if (!created?.id) throw new Error('opportunity create returned no id');
  return { status: 'created', opportunity: { id: String(created.id), name: created.name ?? name } };
}
