import { WAITING_ON_CHANNELS } from '../lead-record.ts';
import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS } from '../constants/universal-identifiers';
import { selectOptions } from '../select-options';

export default defineField({
  universalIdentifier: OPPORTUNITY_FIELDS.waitingOnChannel,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.SELECT,
  name: 'waitingOnChannel',
  label: 'Waiting-on channel',
  description: 'Where the waiting draft is approved. Approval stays in that channel.',
  icon: 'IconMessages',
  options: selectOptions(WAITING_ON_CHANNELS),
});
