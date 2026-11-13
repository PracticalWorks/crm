import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  BRAND_FIELDS,
  BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_FIELDS,
  WORKSPACE_MEMBER_BRANDS_FIELD_UNIVERSAL_IDENTIFIER,
} from '../constants/universal-identifiers';

// A brand is a record, not a select: a new brand is a row seeded from the brand
// roster at run time, never a schema change. Kept small on purpose; what a brand
// is and aims for lives in its roster note, which `vaultNote` links to. `name`
// is the default field Twenty adds to every object, so it is not declared here.
export default defineObject({
  universalIdentifier: BRAND_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'brand',
  namePlural: 'brands',
  labelSingular: 'Brand',
  labelPlural: 'Brands',
  description: 'A brand we run leads for. Seeded from the brand roster, never typed in.',
  icon: 'IconBuildingStore',
  fields: [
    {
      universalIdentifier: BRAND_FIELDS.key,
      name: 'key',
      type: FieldType.TEXT,
      label: 'Key',
      description: "The roster's canonical key. Unique; writers find a brand by it.",
      icon: 'IconKey',
    },
    {
      universalIdentifier: BRAND_FIELDS.shortTag,
      name: 'shortTag',
      type: FieldType.TEXT,
      label: 'Short tag',
      description: 'The two- to four-letter tag chat channels and cards use.',
      icon: 'IconTag',
    },
    {
      universalIdentifier: BRAND_FIELDS.owner,
      name: 'owner',
      type: FieldType.RELATION,
      label: 'Owner',
      description: 'Who answers for the brand.',
      icon: 'IconUserCircle',
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: WORKSPACE_MEMBER_BRANDS_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'ownerId',
      },
    },
    {
      universalIdentifier: BRAND_FIELDS.vaultNote,
      name: 'vaultNote',
      type: FieldType.LINKS,
      label: 'Brand note',
      description: "Link to the brand's roster note.",
      icon: 'IconNotebook',
    },
    {
      universalIdentifier: BRAND_FIELDS.goal,
      name: 'goal',
      type: FieldType.TEXT,
      label: 'Goal',
      description: 'One headline goal, e.g. "2 inquiries a month by 2026-12-31".',
      icon: 'IconTarget',
    },
    {
      universalIdentifier: BRAND_FIELDS.opportunities,
      name: 'opportunities',
      type: FieldType.RELATION,
      label: 'Opportunities',
      icon: 'IconTargetArrow',
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: OPPORTUNITY_FIELDS.brand,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
