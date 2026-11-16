import { defineLogicFunction } from 'twenty-sdk/define';

import { LOGIC_FUNCTIONS } from '../constants/universal-identifiers';
import { handleOpportunityEvent } from './handle';

// A new lead: crm/opportunity.opened.
export default defineLogicFunction({
  universalIdentifier: LOGIC_FUNCTIONS.opportunityOpened,
  name: 'opportunity-opened',
  description: 'Tells Inngest a lead was opened (crm/opportunity.opened).',
  timeoutSeconds: 20,
  databaseEventTriggerSettings: { eventName: 'opportunity.created' },
  handler: handleOpportunityEvent,
});
