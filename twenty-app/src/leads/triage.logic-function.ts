import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { TRIAGE_LOGIC_FUNCTIONS } from '../constants/universal-identifiers';
import { twentyRest } from '../rest';
import { triageLead } from './triage';

// POST /s/leads/triage: { opportunityId, checks, verdict, passReason? }. Runs as the
// person who called it, so their permissions apply to the update.
export default defineLogicFunction({
  universalIdentifier: TRIAGE_LOGIC_FUNCTIONS.triageLead,
  name: 'triage-lead',
  description: 'Saves a lead\'s five triage checks, verdict and pass reason in one update, moving a New lead to Triaged.',
  timeoutSeconds: 20,
  httpRouteTriggerSettings: { path: '/leads/triage', httpMethod: 'POST', isAuthRequired: true },
  handler: async (event: RoutePayload) => {
    const vars = process.env;
    const rest = twentyRest(vars.TWENTY_API_URL, vars.TWENTY_APP_ACCESS_TOKEN ?? vars.TWENTY_APP_APPLICATION_ACCESS_TOKEN, fetch);
    const result = await triageLead(event.body, rest);
    return new Response(result, { status: result.status === 'invalid' ? 400 : 200 });
  },
});
