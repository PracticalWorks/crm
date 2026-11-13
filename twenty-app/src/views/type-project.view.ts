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

// Type PROJECT, by stage.
export default defineView({
  universalIdentifier: VIEWS.typeProject,
  name: 'Projects by stage',
  objectUniversalIdentifier: OPPORTUNITY.universalIdentifier,
  type: ViewType.KANBAN,
  icon: 'IconBriefcase',
  position: 2,
  mainGroupByFieldMetadataUniversalIdentifier: OPPORTUNITY.fields.stage.universalIdentifier,
  kanbanAggregateOperation: AggregateOperations.COUNT,
  fields: [
    { universalIdentifier: '112db41c-acbe-4b9e-832a-c4515ba8b95d', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.name.universalIdentifier, position: 0, isVisible: true },
    { universalIdentifier: 'f004ef4a-8691-4e48-a7fd-572beea2f936', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.company.universalIdentifier, position: 1, isVisible: true },
    { universalIdentifier: '368676e1-653b-495d-a948-20315cbcf631', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.owner.universalIdentifier, position: 2, isVisible: true },
    { universalIdentifier: '4a221c7c-47e4-4e79-aedf-86447ca887fb', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.brand, position: 3, isVisible: true },
    { universalIdentifier: 'dcc76b3d-cb5c-40b1-a52a-6459236149b8', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.source, position: 4, isVisible: true },
    { universalIdentifier: 'fd60041a-aae8-4638-ba3b-eee671acbe85', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.amount.universalIdentifier, position: 5, isVisible: true },
  ],
  groups: STAGE_GROUPS.typeProject,
  filters: [
    {
      universalIdentifier: 'f19f0eb4-639c-4755-b98b-89b88b89f0b2',
      fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.leadType,
      operand: ViewFilterOperand.IS,
      value: ['PROJECT'],
    },
  ],
});
