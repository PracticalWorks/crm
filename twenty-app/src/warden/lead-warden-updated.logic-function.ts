import { defineLogicFunction } from 'twenty-sdk/define';

import { WARDEN_LOGIC_FUNCTIONS } from '../constants/universal-identifiers';
import { onLeadEvent } from './run';

// A changed lead: a Task whose rule just cleared (triaged, Brand set, closed) closes now.
export default defineLogicFunction({
  universalIdentifier: WARDEN_LOGIC_FUNCTIONS.leadUpdated,
  name: 'lead-warden-updated',
  description: 'Runs the lead warden rules on a lead each time it changes.',
  timeoutSeconds: 20,
  databaseEventTriggerSettings: { eventName: 'opportunity.updated' },
  handler: onLeadEvent,
});
