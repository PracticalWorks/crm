import { defineValidationRule } from 'twenty-sdk/define';

import { closedLeadRequires } from './closed-lead';

export default defineValidationRule(closedLeadRequires('scopingHours', 'Scoping hours'));
