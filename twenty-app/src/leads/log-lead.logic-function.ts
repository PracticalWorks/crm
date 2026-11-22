import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { LOGIC_FUNCTIONS } from '../constants/universal-identifiers';
import { twentyRest } from '../rest';
import { logLead } from './log-lead';

const STATUS = { created: 201, duplicate: 409, invalid: 400 } as const;

// POST /s/leads/log: { link, brandId, source, type, name? }. Runs as the person who
// called it, so the lead is theirs and their permissions apply.
export default defineLogicFunction({
  universalIdentifier: LOGIC_FUNCTIONS.logLead,
  name: 'log-lead',
  description: 'Opens an Opportunity at New from a posting link, refusing a link already logged.',
  timeoutSeconds: 20,
  httpRouteTriggerSettings: { path: '/leads/log', httpMethod: 'POST', isAuthRequired: true },
  handler: async (event: RoutePayload) => {
    const vars = process.env;
    const rest = twentyRest(vars.TWENTY_API_URL, vars.TWENTY_APP_ACCESS_TOKEN ?? vars.TWENTY_APP_APPLICATION_ACCESS_TOKEN, fetch);
    const result = await logLead(event.body, rest);
    return new Response(result, { status: STATUS[result.status] });
  },
});
