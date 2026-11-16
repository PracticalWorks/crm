import { describe, expect, it } from 'vitest';

import { planStageOptions, type StageOption } from '../stage/plan-stage-options';

// The live options, as the workspace reports them (ids made up here).
const LIVE: StageOption[] = [
  { id: 'id-new', value: 'NEW', label: 'New', position: 0, color: 'red' },
  { id: 'id-screening', value: 'SCREENING', label: 'Screening', position: 1, color: 'purple' },
  { id: 'id-meeting', value: 'MEETING', label: 'Meeting', position: 2, color: 'sky' },
  { id: 'id-proposal', value: 'PROPOSAL', label: 'Proposal', position: 3, color: 'turquoise' },
  { id: 'id-customer', value: 'CUSTOMER', label: 'Customer', position: 4, color: 'yellow' },
];

describe('planStageOptions', () => {
  it('relabels to the six stages, adds Light reply sent, keeps every id, value and colour', () => {
    const { options } = planStageOptions(LIVE);
    expect(options.map((o) => [o.position, o.value, o.label, o.id])).toEqual([
      [0, 'NEW', 'New', 'id-new'],
      [1, 'SCREENING', 'Triaged', 'id-screening'],
      [2, 'LIGHT_REPLY_SENT', 'Light reply sent', undefined],
      [3, 'MEETING', 'Engaged', 'id-meeting'],
      [4, 'PROPOSAL', 'Proposal out', 'id-proposal'],
      [5, 'CUSTOMER', 'Closed', 'id-customer'],
    ]);
    for (const live of LIVE) expect(options.find((o) => o.id === live.id)?.color).toBe(live.color);
  });

  it('drops no option and renames no value, so every live writer keeps working', () => {
    const { options } = planStageOptions(LIVE);
    for (const live of LIVE) expect(options.some((o) => o.id === live.id && o.value === live.value)).toBe(true);
  });

  it('is idempotent: planning on its own output changes nothing', () => {
    const once = planStageOptions(LIVE).options.map((o, i) => ({ ...o, id: o.id ?? `new-${i}` }));
    expect(planStageOptions(once).changes).toEqual([]);
  });

  it('keeps options someone added by hand, after the six', () => {
    const { options } = planStageOptions([...LIVE, { id: 'id-x', value: 'ON_HOLD', label: 'On hold', position: 5 }]);
    expect(options.at(-1)).toMatchObject({ id: 'id-x', value: 'ON_HOLD', position: 6 });
  });

  it('refuses to plan when a live stage value is gone', () => {
    expect(() => planStageOptions(LIVE.filter((o) => o.value !== 'MEETING'))).toThrow('MEETING is missing');
  });
});
