import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  LOG_LEAD_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  LOG_LEAD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from '../constants/universal-identifiers';

// "Log a lead" in the command menu, from any page: opens the form in the side panel.
export default defineCommandMenuItem({
  universalIdentifier: LOG_LEAD_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Log a lead',
  shortLabel: 'Log lead',
  availabilityType: 'GLOBAL',
  frontComponentUniversalIdentifier: LOG_LEAD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
