import { defineApplication } from 'twenty-sdk/define';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  APPLICATION_VARIABLES,
} from './constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Lead record',
  description:
    'One Opportunity per lead, bid, job application or inquiry: the Brand object, the lead fields on Opportunity and the pipeline views.',
  // Where the opportunity hooks send events. Neither value lives in this repo: the
  // URL is set in the app's settings, and the key is copied there from Infisical.
  applicationVariables: {
    INNGEST_EVENT_URL: {
      universalIdentifier: APPLICATION_VARIABLES.inngestEventUrl,
      label: 'Inngest URL',
      description: "The Inngest server's base URL. Events go to <url>/e/<key>.",
      type: 'TEXT',
      isRequired: true,
    },
    INNGEST_EVENT_KEY: {
      universalIdentifier: APPLICATION_VARIABLES.inngestEventKey,
      label: 'Inngest event key',
      description: 'The event key the hooks send with. Set from Infisical; never committed.',
      type: 'TEXT',
      isRequired: true,
      isSecret: true,
    },
  },
});
