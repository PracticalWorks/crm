import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { WARDEN_TASK_FIELDS } from '../constants/universal-identifiers';
import { selectOptions } from '../select-options';
import { WARDEN_RULES } from '../warden/warden';

// Which warden rule opened the Task; empty on every other Task. The warden finds its
// open Task for a lead by this, so it never opens a second.
export default defineField({
  universalIdentifier: WARDEN_TASK_FIELDS.wardenRule,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.SELECT,
  name: 'wardenRule',
  label: 'Warden rule',
  description: 'The lead warden rule that opened this task. Set by the warden; read only.',
  icon: 'IconShieldCheck',
  options: selectOptions(WARDEN_RULES),
});
