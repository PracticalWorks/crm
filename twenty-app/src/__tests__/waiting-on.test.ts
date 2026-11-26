import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { describe, expect, it } from 'vitest';

import { WAITING_ON_CHANNELS } from '../lead-record.ts';
import {
  OPPORTUNITY_FIELDS,
  VIEWS,
  WORKSPACE_MEMBER_WAITING_ON_FIELD_UNIVERSAL_IDENTIFIER,
} from '../constants/universal-identifiers';
import waitingOn from '../fields/opportunity-waiting-on.field';
import waitingOnDraft from '../fields/opportunity-waiting-on-draft.field';
import waitingOnChannel from '../fields/opportunity-waiting-on-channel.field';
import leadsWaitingOn from '../fields/workspace-member-leads-waiting-on.field';
import waitingOnUs from '../views/waiting-on-us.view';

// defineField / defineView return their manifest as `config` (or as-is on older SDKs).
const manifest = (d: unknown): any => (d as any)?.config ?? d;
const OPPORTUNITY = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier;
const WORKSPACE_MEMBER = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier;

describe('the Waiting-on fields on Opportunity', () => {
  it('name the teammate the lead waits on, or nobody, and clear when that teammate is removed', () => {
    const f = manifest(waitingOn);
    expect(f).toMatchObject({
      universalIdentifier: OPPORTUNITY_FIELDS.waitingOn,
      objectUniversalIdentifier: OPPORTUNITY,
      type: 'RELATION',
      name: 'waitingOn',
      relationTargetObjectMetadataUniversalIdentifier: WORKSPACE_MEMBER,
      relationTargetFieldMetadataUniversalIdentifier: WORKSPACE_MEMBER_WAITING_ON_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: { relationType: 'MANY_TO_ONE', onDelete: 'SET_NULL', joinColumnName: 'waitingOnId' },
    });
  });

  it('declare the reverse side on WorkspaceMember, pointing back at Waiting-on', () => {
    const f = manifest(leadsWaitingOn);
    expect(f).toMatchObject({
      universalIdentifier: WORKSPACE_MEMBER_WAITING_ON_FIELD_UNIVERSAL_IDENTIFIER,
      objectUniversalIdentifier: WORKSPACE_MEMBER,
      type: 'RELATION',
      relationTargetObjectMetadataUniversalIdentifier: OPPORTUNITY,
      relationTargetFieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.waitingOn,
      universalSettings: { relationType: 'ONE_TO_MANY' },
    });
  });

  it('carry the draft as a link on Opportunity', () => {
    expect(manifest(waitingOnDraft)).toMatchObject({
      universalIdentifier: OPPORTUNITY_FIELDS.waitingOnDraft,
      objectUniversalIdentifier: OPPORTUNITY,
      type: 'LINKS',
      name: 'waitingOnDraft',
    });
  });

  it('name the draft channel from the one shared list: #leads, #social-leads or str-manager', () => {
    const f = manifest(waitingOnChannel);
    expect(f).toMatchObject({
      universalIdentifier: OPPORTUNITY_FIELDS.waitingOnChannel,
      objectUniversalIdentifier: OPPORTUNITY,
      type: 'SELECT',
      name: 'waitingOnChannel',
    });
    expect(f.options.map((o: { value: string }) => o.value)).toEqual(WAITING_ON_CHANNELS.map((o) => o.value));
    expect(WAITING_ON_CHANNELS.map((o) => o.label)).toEqual(['#leads', '#social-leads', 'str-manager']);
  });
});

describe('the "Waiting on us" view', () => {
  const v = manifest(waitingOnUs);

  it('is a table of Opportunities', () => {
    expect(v).toMatchObject({ universalIdentifier: VIEWS.waitingOnUs, name: 'Waiting on us', objectUniversalIdentifier: OPPORTUNITY, type: 'TABLE' });
  });

  it('lists only leads whose Waiting-on names a teammate', () => {
    expect(v.filters).toEqual([
      expect.objectContaining({ fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.waitingOn, operand: 'IS_NOT_EMPTY' }),
    ]);
  });

  it('shows who, the draft link and its channel on every row', () => {
    const shown = v.fields.filter((f: { isVisible: boolean }) => f.isVisible).map((f: { fieldMetadataUniversalIdentifier: string }) => f.fieldMetadataUniversalIdentifier);
    for (const id of [OPPORTUNITY_FIELDS.waitingOn, OPPORTUNITY_FIELDS.waitingOnDraft, OPPORTUNITY_FIELDS.waitingOnChannel]) {
      expect(shown).toContain(id);
    }
  });
});
