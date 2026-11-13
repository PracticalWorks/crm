import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from './constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Lead record',
  description:
    'One Opportunity per lead, bid, job application or inquiry: the Brand object, the lead fields on Opportunity and the pipeline views.',
});
