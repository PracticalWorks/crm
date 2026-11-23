import {
  definePageLayoutWidget,
  PageLayoutTabLayoutMode,
  PageLayoutWidgetVerticalListHeightBehavior,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  TRIAGE_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  TRIAGE_PANEL_WIDGET_UNIVERSAL_IDENTIFIER,
} from '../constants/universal-identifiers';

// The triage panel on every Opportunity's Home tab, after the built-in widgets.
export default definePageLayoutWidget({
  universalIdentifier: TRIAGE_PANEL_WIDGET_UNIVERSAL_IDENTIFIER,
  pageLayoutTabUniversalIdentifier: STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.opportunityRecordPage.tabs.home.universalIdentifier,
  title: 'Triage',
  type: 'FRONT_COMPONENT',
  position: {
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    index: 1000,
    heightBehavior: PageLayoutWidgetVerticalListHeightBehavior.FIT_CONTENT,
  },
  configuration: {
    configurationType: 'FRONT_COMPONENT',
    frontComponentUniversalIdentifier: TRIAGE_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  },
});
