import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { TRIAGE_LOGIC_FUNCTIONS } from '../constants/universal-identifiers';
import { twentyRest } from '../rest';
import { startScope } from './triage';

// POST /s/leads/scope: { opportunityId }. Runs as the person who called it.
export default defineLogicFunction({
  universalIdentifier: TRIAGE_LOGIC_FUNCTIONS.startScope,
  name: 'start-full-scope',
  description: 'Marks a full scope started on a lead: cold before Engaged, warm from Engaged on.',
  timeoutSeconds: 20,
  httpRouteTriggerSettings: { path: '/leads/scope', httpMethod: 'POST', isAuthRequired: true },
  handler: async (event: RoutePayload) => {
    const vars = process.env;
    const rest = twentyRest(vars.TWENTY_API_URL, vars.TWENTY_APP_ACCESS_TOKEN ?? vars.TWENTY_APP_APPLICATION_ACCESS_TOKEN, fetch);
    const result = await startScope(event.body, rest);
    return new Response(result, { status: result.status === 'invalid' ? 400 : 200 });
  },
});
