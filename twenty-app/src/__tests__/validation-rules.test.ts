import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { describe, expect, it } from 'vitest';

import { CLOSED_LEAD_VALIDATION_RULES, OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';
import { LEAD_STAGES } from '../lead-record.ts';
import outcomeRule from '../validation-rules/closed-lead-outcome.validation-rule';
import scopingHoursRule from '../validation-rules/closed-lead-scoping-hours.validation-rule';

// Twenty evaluates the expression server-side; this reads the same small grammar the
// rules use (==, !=, and, or, not, isEmpty) with Twenty's isEmpty, so 0 counts as set.
function holds(expression: string, record: Record<string, unknown>): boolean {
  const js = expression
    .replace(/[!=]=/g, (op) => `${op}=`)
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b/g, '!')
    .replace(/\b(?!isEmpty\b)([a-zA-Z]+)\b(?=(?:[^"]*"[^"]*")*[^"]*$)/g, 'r.$1');
  const isEmpty = (v: unknown) => v === null || v === undefined || v === '';
  return new Function('r', 'isEmpty', `return ${js};`)(record, isEmpty) as boolean;
}

const RULES = [
  { rule: outcomeRule, field: 'outcome', label: 'Outcome', set: 'WON' },
  { rule: scopingHoursRule, field: 'scopingHours', label: 'Scoping hours', set: 2.5 },
] as const;

describe.each(RULES)('the Closed-lead rule for $label', ({ rule, field, label, set }) => {
  const { expression } = rule.config;
  const closed = (value: unknown) => ({ stage: LEAD_STAGES.CLOSED, outcome: 'WON', scopingHours: 1, [field]: value });

  it('is a valid definition on Opportunity, its error pinned to the field and its message naming it', () => {
    expect(rule.success).toBe(true);
    expect(rule.errors).toEqual([]);
    expect(rule.config).toMatchObject({
      universalIdentifier: CLOSED_LEAD_VALIDATION_RULES[field],
      objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
      errorFieldUniversalIdentifier: OPPORTUNITY_FIELDS[field],
    });
    expect(rule.config.message).toBe(`A Closed lead needs ${label}. Set ${label} before moving it to Closed.`);
  });

  it('refuses a Closed lead without the field', () => {
    expect(holds(expression, closed(null))).toBe(false);
    expect(holds(expression, closed(undefined))).toBe(false);
  });

  it('lets a Closed lead with the field through', () => {
    expect(holds(expression, closed(set))).toBe(true);
  });

  it('lets an open lead through without the field', () => {
    expect(holds(expression, { stage: LEAD_STAGES.ENGAGED, outcome: null, scopingHours: null })).toBe(true);
  });

  it('is found by `twenty app build`, which reads a literal `export default defineValidationRule(`', () => {
    const file = field === 'outcome' ? 'closed-lead-outcome' : 'closed-lead-scoping-hours';
    const src = readFileSync(join(__dirname, '..', 'validation-rules', `${file}.validation-rule.ts`), 'utf8');
    expect(src).toMatch(/^export default defineValidationRule\(/m);
  });
});

it('counts zero scoping hours as logged', () => {
  expect(holds(scopingHoursRule.config.expression, { stage: LEAD_STAGES.CLOSED, outcome: 'WON', scopingHours: 0 })).toBe(true);
});
