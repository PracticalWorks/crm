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

// One column per Brand record. Brands are rows seeded at run time, so the columns
// follow the roster with no schema change; a filtered view per brand would have to
// name record ids, which are workspace data and never live in this repo.
export default defineView({
  universalIdentifier: VIEWS.byBrand,
  name: 'Leads by brand',
  objectUniversalIdentifier: OPPORTUNITY.universalIdentifier,
  type: ViewType.KANBAN,
  icon: 'IconBuildingStore',
  position: 1,
  mainGroupByFieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.brand,
  kanbanAggregateOperation: AggregateOperations.COUNT,
  fields: [
    { universalIdentifier: '470f829b-ae21-4b98-a9d9-b043808aa46b', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.name.universalIdentifier, position: 0, isVisible: true },
    { universalIdentifier: '40e523a1-7db2-4573-a2d3-576e0c9c0432', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.company.universalIdentifier, position: 1, isVisible: true },
    { universalIdentifier: 'a322814e-9741-46ed-802a-c8b759653e6f', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.owner.universalIdentifier, position: 2, isVisible: true },
    { universalIdentifier: 'b8e67932-98b9-4aff-8794-54dadac1e5e5', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.stage.universalIdentifier, position: 3, isVisible: true },
    { universalIdentifier: '892a49fc-8382-478d-9645-9bd84e9e0a42', fieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.leadType, position: 4, isVisible: true },
    { universalIdentifier: '2aa74aeb-2fd9-4173-9599-0ac67de77e34', fieldMetadataUniversalIdentifier: OPPORTUNITY.fields.amount.universalIdentifier, position: 5, isVisible: true },
  ],
});
