import { defineLogicFunction } from 'twenty-sdk/define';

import { WARDEN_LOGIC_FUNCTIONS } from '../constants/universal-identifiers';
import { appRest, kvCursor } from './run';
import { sweep } from './warden';

// Every 10 minutes, one page of open leads: the age rules need no edit to fire.
export default defineLogicFunction({
  universalIdentifier: WARDEN_LOGIC_FUNCTIONS.sweep,
  name: 'lead-warden-sweep',
  description: 'Opens a Task for a stale, quiet or incomplete lead, and closes it once that clears. Never moves a stage.',
  timeoutSeconds: 120,
  cronTriggerSettings: { pattern: '*/10 * * * *' },
  handler: () => sweep(appRest(), kvCursor, new Date()),
});
