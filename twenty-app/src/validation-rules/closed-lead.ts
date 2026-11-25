import { ruleExpression as r, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS, type ValidationRuleConfig } from 'twenty-sdk/define';

import { CLOSED_LEAD_VALIDATION_RULES, OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';
import { LEAD_STAGES } from '../lead-record.ts';

// Channels are ranked by wins per scoping hour, so Twenty refuses a lead saved in
// Closed without the field. One rule per field, so the refusal names the one missing.
// Twenty enforces these only where its plan offers validation rules; the lead
// warden's CLOSED_INCOMPLETE Task stays as the backstop everywhere else.
export function closedLeadRequires(field: 'outcome' | 'scopingHours', label: string): ValidationRuleConfig {
  return {
    universalIdentifier: CLOSED_LEAD_VALIDATION_RULES[field],
    objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
    name: `closedLeadHas${field[0]!.toUpperCase()}${field.slice(1)}`,
    expression: r.or(r.notEq(r.field('stage'), LEAD_STAGES.CLOSED), r.not(r.isEmpty(r.field(field)))),
    message: `A Closed lead needs ${label}. Set ${label} before moving it to Closed.`,
    errorFieldUniversalIdentifier: OPPORTUNITY_FIELDS[field],
  };
}
