import {
  AggregateOperations,
  defineView,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
  ViewFilterOperand,
  ViewType,
} from 'twenty-sdk/define';

import { OPPORTUNITY_FIELDS, VIEWS } from '../constants/universal-identifiers';
import { STAGE_GROUPS } from './stage-groups';

const OPPORTUNITY = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity;

// Every lead, by stage: the one board all brands and types share.
export default defineView({
  universalIdentifier: VIEWS.pipeline,
  name: 'Lead pipeline',
  objectUniversalIdentifier: OPPORTUNITY.universalIdentifier,
  type: ViewType.KANBAN,
  icon: 'IconLayoutKanban',
  position: 0,
  mainGroupByFieldMetadataUniversalIdentifier: OPPORTUNITY.fields.stage.universalIdentifier,
  kanbanAggregateOperation: AggregateOperations.COUNT,
  fields: [
    { universalIdentifier: 'f44e1151-59dc-402d-a350-230c6a5db3c7', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.name.universalIdentifier, position: 0, isVisible: true },
    { universalIdentifier: 'd6ab5565-cfb4-40e0-b0bf-62eb60a579f5', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.company.universalIdentifier, position: 1, isVisible: true },
    { universalIdentifier: 'fc0fd6c5-70c7-48df-b316-cbf554e81b8e', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.owner.universalIdentifier, position: 2, isVisible: true },
    { universalIdentifier: '74a9e034-c479-45f1-b619-f65f4a5377e3', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.brand, position: 3, isVisible: true },
    { universalIdentifier: '28892ce9-0dfc-44be-b894-78ad36fe6f93', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.leadType, position: 4, isVisible: true },
    { universalIdentifier: '834d18f7-8c9f-4be8-9495-f6c9d0c7709f', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.amount.universalIdentifier, position: 5, isVisible: true },
  ],
  groups: STAGE_GROUPS.pipeline,
});
