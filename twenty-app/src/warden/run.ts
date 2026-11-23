// What the warden's logic functions share: the REST client on the app's own token
// (a cron run has no caller), the sweep cursor in the app's key-value store, and
// the record-event handler.

import { kv } from 'twenty-sdk/logic-function';

import { twentyRest } from '../rest';
import { reconcileLeadById, type CursorStore } from './warden';

export const SWEEP_CURSOR_KEY = 'lead-warden.sweep-cursor';

export function appRest(fetchFn: typeof fetch = fetch) {
  const vars = process.env;
  return twentyRest(vars.TWENTY_API_URL, vars.TWENTY_APP_APPLICATION_ACCESS_TOKEN ?? vars.TWENTY_APP_ACCESS_TOKEN, fetchFn);
}

export const kvCursor: CursorStore = {
  get: async () => (await kv.get<{ after?: string | null }>(SWEEP_CURSOR_KEY))?.after ?? null,
  set: (after) => kv.set(SWEEP_CURSOR_KEY, { after }),
};

/** A lead was created or changed: bring its warden Tasks in line now, not at the next sweep. */
export const onLeadEvent = (event: { recordId: string }) => reconcileLeadById(event.recordId, appRest(), new Date());
