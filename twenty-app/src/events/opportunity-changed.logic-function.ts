import { defineLogicFunction } from 'twenty-sdk/define';

import { OPPORTUNITY_WATCHED_FIELDS } from '../../../packages/client/src/events.ts';
import { LOGIC_FUNCTIONS } from '../constants/universal-identifiers';
import { handleOpportunityEvent } from './handle';

// A lead moved: crm/opportunity.stage-changed, .closed and .updated, by what changed.
export default defineLogicFunction({
  universalIdentifier: LOGIC_FUNCTIONS.opportunityChanged,
  name: 'opportunity-changed',
  description: 'Tells Inngest a lead changed stage, closed, or moved Type or Step.',
  timeoutSeconds: 20,
  databaseEventTriggerSettings: { eventName: 'opportunity.updated', updatedFields: [...OPPORTUNITY_WATCHED_FIELDS] },
  handler: handleOpportunityEvent,
});
