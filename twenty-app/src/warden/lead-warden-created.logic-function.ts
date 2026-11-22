import { defineLogicFunction } from 'twenty-sdk/define';

import { WARDEN_LOGIC_FUNCTIONS } from '../constants/universal-identifiers';
import { onLeadEvent } from './run';

// A new lead: an incomplete one, or a repeated link, gets its Task at once.
export default defineLogicFunction({
  universalIdentifier: WARDEN_LOGIC_FUNCTIONS.leadCreated,
  name: 'lead-warden-created',
  description: 'Runs the lead warden rules on a lead as it is created.',
  timeoutSeconds: 20,
  databaseEventTriggerSettings: { eventName: 'opportunity.created' },
  handler: onLeadEvent,
});
