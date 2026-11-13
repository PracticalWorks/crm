import { LEAD_STAGES } from '../lead-record.ts';

// Kanban columns for the stage-grouped views, in pipeline order. The values come
// from the client's LEAD_STAGES, so a column always matches a stage writers send.
const ORDER = ['NEW', 'TRIAGED', 'LIGHT_REPLY_SENT', 'ENGAGED', 'PROPOSAL_OUT', 'CLOSED'] as const;

function columns(ids: readonly string[]) {
  return ORDER.map((stage, position) => ({
    universalIdentifier: ids[position] as string,
    fieldValue: LEAD_STAGES[stage],
    position,
    isVisible: true,
  }));
}

export const STAGE_GROUPS = {
  pipeline: columns(['c589aefc-7c52-4009-80cb-3a3b49fdf868', 'b1fb4a64-0396-4acd-9dfc-31dbb9a1d366', '0cd80597-0b52-4bc4-b637-6eb8e9128b80', 'c9ed115e-923b-4e47-805a-f2e3177221bb', '1c59fff7-49a0-47f3-94fb-9328d25ad07a', '6e22fa3e-5924-41d6-97d9-4ee24eb96d5b']),
  typeProject: columns(['e70034ff-4eec-44aa-9df9-483c967c3ea6', '86364dc2-4eca-4034-8aa7-a0b16c1c8a11', '21570a01-f97f-4e29-98f3-73cdaad6ee0a', '6bffefa0-eadf-492c-8f14-bec8be0f375c', '94324985-33c3-4868-8d38-ab2e91aed177', 'ea5489dd-ae5d-4706-9677-f89687b93ea8']),
  typeContractSeat: columns(['86643c69-c39a-4a5a-b3bd-1f2605b3ab4c', 'b6d54a1f-69bd-4638-8899-f7e7f6671881', 'f3f64775-93dc-436e-bdfd-8df2fec86453', '0df3b8ed-2e2c-459b-977c-a4cf7f7fa275', '34119adc-cc31-4085-8704-7c1b6596f741', '9d1d64bf-83db-4f7b-8958-0064b78d9bbf']),
  typeJobApplication: columns(['99a5690b-e528-433c-8c42-660c1206926f', '6ebb5ec0-8c6f-49b7-8a99-69d368a3077f', '029cd54e-483f-4da0-848c-767862df8706', 'a086ec39-f0f8-44ff-8b7f-347c509af591', '42efb587-a6ea-4f8e-bd10-a961334080cf', '4b602378-7507-42e9-911c-ecff8081a79f']),
  typeProductSignup: columns(['60ecea39-fabc-4650-a701-42afe25089c4', '03f4ad59-6463-4fd4-a9ea-48cdf9fca06d', '216d5c05-aa12-4b58-922d-2763c4646c75', 'd82a6ee6-ddb9-4dd9-a831-206a9ca786a0', 'c90f7e19-a6e1-450a-ac9d-4c6aac5898b3', 'd152281d-0eff-45dc-bafc-7ee6789cd010']),
  typePartner: columns(['cc48323a-9f8c-4346-bc12-9a94fa7ef1db', '0331f91e-11ac-4c90-8de8-1a9fc006eee2', '2a0586de-3294-4243-8e02-6b497f3d64bf', '1d905601-4e0a-4b5c-ba04-9d6d154ae25a', 'ed4d2af1-c66d-4a2c-8afa-076808c228c1', '4f154efb-582d-4e33-bf7a-da60e74290a4']),
};
