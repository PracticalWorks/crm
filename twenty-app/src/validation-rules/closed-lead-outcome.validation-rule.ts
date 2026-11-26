import { defineValidationRule } from 'twenty-sdk/define';

import { closedLeadRequires } from './closed-lead';

// `twenty app build` finds a definition by this literal `export default defineX(...)`.
export default defineValidationRule(closedLeadRequires('outcome', 'Outcome'));
