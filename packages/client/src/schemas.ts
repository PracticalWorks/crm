// The CRM record shapes. Read fresh from the CRM (Twenty) and never persisted by a
// caller: the CRM is the one source of truth for relationship records. Moved here
// unchanged from the factory's contracts so the client and its types ship as one
// package; the factory re-exports them.
import { z } from "zod";

/** A person (contact) at a company. */
export const CrmPersonRef = z.object({
  id: z.string().min(1),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
export type CrmPersonRef = z.infer<typeof CrmPersonRef>;

/**
 * A company, the relationship record. One company per client. `crmUrl` is the
 * deep-link a teammate opens to see the record; `people` is populated on a depth read.
 */
export const CrmCompanyRef = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domainName: z.string().nullable(),
  crmUrl: z.string().min(1),
  people: z.array(CrmPersonRef).default([]),
});
export type CrmCompanyRef = z.infer<typeof CrmCompanyRef>;

/** A relationship note written to a company. */
export const CrmNoteRef = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
});
export type CrmNoteRef = z.infer<typeof CrmNoteRef>;

/**
 * A commitment, held in the CRM as a task. `companyId` is optional on purpose:
 * internal work is still a commitment, it just has nothing to link to.
 */
export const CrmTaskRef = z.object({
  id: z.string().min(1),
  title: z.string(),
  /** ISO timestamp the commitment is due. */
  dueAt: z.string().nullable(),
  /**
   * The client the task is linked to; null when it has none. Absent when the link
   * could not be read (an update whose taskTarget lookup failed), so an unknown is
   * never reported as unlinked.
   */
  companyId: z.string().nullable().optional(),
  /**
   * The task status exactly as the instance reports it (commonly TODO /
   * IN_PROGRESS / DONE). An open string, not an enum: the set is
   * workspace-configurable, so pinning it would turn a renamed column into a parse
   * failure. Null when the record carries no status.
   */
  status: z.string().nullable(),
  /**
   * The task's text as markdown (Twenty's `bodyV2`): where it came from, what it is
   * about. Null when the task has none; absent when the record read carried no body.
   */
  body: z.string().nullable().optional(),
  /** The deep-link a teammate opens to see the task. */
  taskUrl: z.string().min(1),
});
export type CrmTaskRef = z.infer<typeof CrmTaskRef>;

/**
 * A teammate with a login in the workspace (a Twenty WorkspaceMember). `id` is what a
 * task's `assigneeId` and an opportunity's `ownerId` take; `email` is the login email.
 */
export const CrmWorkspaceMemberRef = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().nullable(),
});
export type CrmWorkspaceMemberRef = z.infer<typeof CrmWorkspaceMemberRef>;

/**
 * A lead: one opportunity per lead, bid, job application or inquiry. The lead
 * record fields are optional on the ref: a read of an older record, or a create
 * that set none of them, simply leaves them out. Values are the workspace's own
 * (see `lead-record.ts`), passed through as strings.
 */
export const CrmOpportunityRef = z.object({
  id: z.string().min(1),
  name: z.string(),
  stage: z.string().nullable(),
  companyId: z.string().nullable(),
  opportunityUrl: z.string().min(1),
  brandId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  sourceDetail: z.string().nullable().optional(),
  market: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  step: z.string().nullable().optional(),
  triageVerdict: z.string().nullable().optional(),
  passReason: z.string().nullable().optional(),
  scopingHours: z.number().nullable().optional(),
  outcome: z.string().nullable().optional(),
  closeDate: z.string().nullable().optional(),
  links: z.array(z.string()).optional(),
});
export type CrmOpportunityRef = z.infer<typeof CrmOpportunityRef>;

/** A brand we run leads for, as the CRM holds it. Seeded from the brand roster by `key`. */
export const CrmBrandRef = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  name: z.string(),
  shortTag: z.string().nullable(),
  ownerId: z.string().nullable(),
  vaultNote: z.string().nullable(),
  goal: z.string().nullable(),
});
export type CrmBrandRef = z.infer<typeof CrmBrandRef>;
