// Stable identifiers for everything this app declares. Generated once; never edit
// one, or Twenty treats the entity as deleted and re-created (and drops its data).
export const APPLICATION_UNIVERSAL_IDENTIFIER = '8808f5db-2322-4cf7-a4c4-68c010fba5f7';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = '8e408c4a-2110-433a-997c-1f1a20f94e7c';

export const BRAND_OBJECT_UNIVERSAL_IDENTIFIER = '15267724-6ae3-4cfc-afd4-00f5269476dc';
export const BRAND_FIELDS = {
  key: '4975ca43-7c3c-4c31-a8af-fa8f0e7e063f',
  shortTag: '43a888e1-fd96-4f58-b527-5018724737bd',
  owner: 'b2eddafd-7cac-473d-8463-1a15ba54959c',
  vaultNote: 'b8f185bb-eaac-479d-8b39-1009d2c5f314',
  goal: '0c59077d-ba2f-40d9-97b5-034da0c06833',
  opportunities: 'acf6d818-86a9-4daa-9887-0f657c554719',
} as const;
export const BRAND_KEY_UNIQUE_INDEX_UNIVERSAL_IDENTIFIER = '68c60602-948b-4c63-8dac-3ff2ff62e1e6';
export const BRAND_KEY_UNIQUE_INDEX_FIELD_UNIVERSAL_IDENTIFIER = 'c3508786-25d0-4827-a3c0-99b4cf3a7586';

/** The reverse side of Brand.owner, on the standard WorkspaceMember object. */
export const WORKSPACE_MEMBER_BRANDS_FIELD_UNIVERSAL_IDENTIFIER = '98e8b426-85a8-4350-87bf-24d071541e0f';

/** Fields this app adds to the standard Opportunity object. */
export const OPPORTUNITY_FIELDS = {
  brand: 'dd8bef91-ab6c-42aa-99b6-f7bd6f1d6187',
  source: '61a34fe6-1f19-472d-aa4f-cb9fb434210c',
  sourceDetail: 'f8454a51-ae8b-47e0-a905-47e221e31e3e',
  market: 'e5c0df84-beb5-4e4b-840d-ac350211048c',
  leadType: '4b1ec894-2f52-4d3d-9cb4-370fda0426f4',
  step: '259daaca-6856-48f4-b1fc-b01f68de588c',
  triageVerdict: '66f505db-b476-4e28-b600-1f8cafdeba25',
  passReason: '1d2374f6-238b-468f-b34b-93d18edc502a',
  scopingHours: '0043eb98-e2b6-46b7-960f-c14ee464d1c5',
  outcome: '182a9eda-8de4-4931-a1b0-ef685ce43ee8',
  leadLinks: 'b5c9d170-9851-4494-8705-d476cfc75980',
} as const;

/** Fields this app adds to the standard Person object: frontdesk's outreach status. */
export const PERSON_OUTREACH_FIELDS = {
  outreachSequence: '25f41e3b-39b2-436c-80d5-e20a7711620e',
  outreachStep: 'b28d657f-2ab0-4bd9-9e23-2629d312b01b',
  outreachLastSentAt: 'c1de83e4-d957-452e-ba11-06a57d8f85d6',
  outreachState: '4bba7ecb-388f-4471-80d2-63ef6a7e5b8a',
} as const;

/** The opportunity hooks: logic functions and the settings they read. */
export const LOGIC_FUNCTIONS = {
  opportunityOpened: '340790fe-9b1f-4b18-a98b-3f79f5d42928',
  opportunityChanged: '684adc1c-03ac-4e09-8149-fbfec7daaa93',
  logLead: '88ac2997-3b64-49df-a1c3-fad890a29184',
} as const;

/** The command-menu form that logs a lead by hand. */
export const LOG_LEAD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER = 'b7331292-dd42-48a0-9844-dcc4ff0a8056';
export const LOG_LEAD_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER = '859c4640-8ef5-40ec-83c7-1603d2f7f5d2';
export const APPLICATION_VARIABLES = {
  inngestEventUrl: 'b8365c01-6ef2-44b4-bbba-8292ace01578',
  inngestEventKey: 'e101178b-87b4-4191-92ed-3f0a294330bc',
} as const;

export const VIEWS = {
  pipeline: 'ad0c843f-3f50-4814-bd70-cb4074d99531',
  byBrand: '7e6ee6f4-1851-4fd3-b7d4-bb69a13977d7',
  typeProject: '3a2f1566-e4ad-4c4e-8b83-38b707827df2',
  typeContractSeat: '1deab596-eb2d-4f03-ace0-7c634b786484',
  typeJobApplication: 'c34f974e-880a-4e01-b204-4eb10bc1e5a1',
  typeProductSignup: '3fb9cc7d-3828-4bfd-93d5-717f8778b8e0',
  typePartner: '6c890cb4-098c-4cf9-953f-e97c22887e04',
  outreach: '36470b11-0ef5-4078-8a3d-87846a8fa3db',
} as const;

// ─── The triage panel ───
// Kept in one block so the next card in these files merges cleanly.

/** Brand fields: one floor rate per lead Type, keyed by the Type's value. */
export const BRAND_FLOOR_RATE_FIELDS = {
  PROJECT: 'f71ba65e-6e78-4f9f-9eb9-4d1413ad1d8c',
  CONTRACT_SEAT: 'bd1ea7f8-1096-449b-8eeb-4f4507980dbf',
  JOB_APPLICATION: 'edaa44a8-d955-4f02-aa9b-5cd590dc417c',
  PRODUCT_SIGNUP: '3c340f8f-9b0c-4f6b-8696-7b35814e012e',
  PARTNER: '63d5e5fc-6ab2-4f8e-9b19-7a8b671669a1',
} as const;
/** Opportunity fields the triage panel writes. */
export const TRIAGE_OPPORTUNITY_FIELDS = {
  triageChecks: '93b5a8aa-bee2-498e-a28a-e14b17f9f33c',
  fullScope: 'b9620d60-f3d3-4e88-8c7b-2308a18a18d4',
} as const;
export const TRIAGE_LOGIC_FUNCTIONS = {
  triageLead: '6e75bc08-5d19-4288-8123-8d38a9b8baa1',
  startScope: '168dc567-52cd-4bbc-8c18-5db1a5dc4a3e',
} as const;
export const TRIAGE_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER = '5f5746a5-e809-4257-ae1e-75d46ef3f976';
export const TRIAGE_PANEL_WIDGET_UNIVERSAL_IDENTIFIER = '400e54eb-c20d-49a3-87e0-31306655e865';
