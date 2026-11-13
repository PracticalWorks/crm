import type { LeadLink, LeadMarket, LeadOutcome, LeadSource, LeadStep, LeadType, TriageVerdict } from "./lead-record.js";
import type { CrmBrandRef, CrmCompanyRef, CrmNoteRef, CrmOpportunityRef, CrmPersonRef, CrmTaskRef } from "./schemas.js";

/**
 * The lead record fields an opportunity carries (see `lead-record.ts` for the
 * values). An absent field is never sent; `null` clears it.
 */
export interface LeadFields {
  /** A Brand record id (see `listBrands` / `upsertBrand`). */
  brandId?: string | null;
  /** Who answers for the lead: a WorkspaceMember id. */
  ownerId?: string | null;
  source?: LeadSource | null;
  /** The posting, card or lead the opportunity came from. */
  sourceDetail?: LeadLink | null;
  market?: LeadMarket | null;
  type?: LeadType | null;
  step?: LeadStep | null;
  triageVerdict?: TriageVerdict | null;
  passReason?: string | null;
  /** Hours spent scoping, logged at close. */
  scopingHours?: number | null;
  outcome?: LeadOutcome | null;
  /** ISO timestamp. */
  closeDate?: string | null;
  /** Live pages in the app that owns the lead: posting, app page, documents. */
  links?: LeadLink[] | null;
}

/**
 * The relationship side of a client: the CRM (Twenty) holds who a client is and
 * the log of what happened with them. Implemented by `CrmClient`; any runtime that
 * needs client relations depends on this port instead of standing up its own
 * Twenty integration. Money owed never lives here.
 */
export interface CrmPort {
  /** Companies whose name matches, each with its deep-link. Fresh read, never a stored mapping. */
  searchCompanies(query: string): Promise<CrmCompanyRef[]>;
  /** One company by id, with its people, or null if it does not exist. */
  getCompany(companyId: string): Promise<CrmCompanyRef | null>;
  /** Create a client's company record. One company per client — search first. */
  createCompany(input: { name: string; domainName?: string }): Promise<CrmCompanyRef>;
  /** Add a contact (person) to a company. */
  createPerson(input: {
    companyId: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }): Promise<CrmPersonRef>;
  /** Append a relationship note to a company (what happened / what was agreed). */
  addNote(companyId: string, note: { title?: string; body: string }): Promise<CrmNoteRef>;
  /** The deep-link a teammate opens to see a company's record. */
  companyUrl(companyId: string): string;

  /**
   * Record a commitment as a task. `companyId` is optional: internal work is still
   * a commitment, it just has no relationship to hang off. `assigneeId` is a
   * Twenty WorkspaceMember id, not a Person id; callers obtain it from the
   * workspace members list before creating an assigned task.
   */
  createTask(input: { title: string; dueAt?: string; companyId?: string; assigneeId?: string }): Promise<CrmTaskRef>;
  /**
   * Read commitments back. Omit `companyId` for everything; pass one for a single
   * client's. The two are different queries, not a filter: a task holds no company
   * of its own, the link lives on a taskTarget join row, so only the per-company
   * path can report which client a task belongs to.
   */
  listTasks(input?: { companyId?: string; limit?: number }): Promise<CrmTaskRef[]>;
  /** Reschedule a commitment. */
  updateTaskDueAt(taskId: string, dueAt: string): Promise<CrmTaskRef>;
  /**
   * Move a commitment between columns (commonly TODO / IN_PROGRESS / DONE). The
   * status is the workspace's own value, passed through as an open string like
   * `CrmTaskRef.status`. Without this a task can be written and never closed.
   */
  updateTaskStatus(taskId: string, status: string): Promise<CrmTaskRef>;
  /**
   * Patch a task's status, due date or assignee (a WorkspaceMember id). An absent field is
   * never sent; `null` clears assignee or due date. Status is always a value.
   */
  updateTask(taskId: string, patch: { status?: string; dueAt?: string | null; assigneeId?: string | null }): Promise<CrmTaskRef>;
  /** Drop a commitment that is not happening. */
  deleteTask(taskId: string): Promise<void>;
  /** The deep-link a teammate opens to see a task. */
  taskUrl(taskId: string): string;
  /** Create an opportunity directly against a company. */
  createOpportunity(input: { name: string; stage?: string; companyId: string } & LeadFields): Promise<CrmOpportunityRef>;
  /** Read opportunities, optionally limited to a company. */
  listOpportunities(input?: { companyId?: string; limit?: number }): Promise<CrmOpportunityRef[]>;
  /** Move an opportunity between stages. */
  updateOpportunityStage(opportunityId: string, stage: string): Promise<CrmOpportunityRef>;
  /** Patch an opportunity's stage, name, owner (a WorkspaceMember id) or any lead field; `null` clears a field. */
  updateOpportunity(
    opportunityId: string,
    patch: { stage?: string; ownerId?: string | null; name?: string } & LeadFields,
  ): Promise<CrmOpportunityRef>;
  /** Remove an opportunity that is not a lead (blank, duplicate). */
  deleteOpportunity(opportunityId: string): Promise<void>;
  /** Patch a company's relationship type or account owner; `null` clears either. */
  updateCompany(
    companyId: string,
    patch: { relationshipType?: string | null; accountOwnerId?: string | null },
  ): Promise<CrmCompanyRef>;
  /** The deep-link a teammate opens to see an opportunity. */
  opportunityUrl(opportunityId: string): string;
}

/**
 * The lead record beyond plain opportunities: steps, closing and brands. Kept apart
 * from `CrmPort` so the existing implementers of that port keep compiling; the
 * client implements both.
 */
export interface LeadRecordPort {
  /** Record the finer step inside the stage. */
  setStep(opportunityId: string, step: LeadStep | null): Promise<CrmOpportunityRef>;
  /** Stage Closed, with the outcome, the scoping hours and the close date (now unless given). */
  close(opportunityId: string, input: { outcome: LeadOutcome; scopingHours?: number; closeDate?: string }): Promise<CrmOpportunityRef>;
  /** Every brand record. */
  listBrands(): Promise<CrmBrandRef[]>;
  /** Create the brand with this key, or update the given fields of the one that has it. */
  upsertBrand(input: {
    key: string;
    name: string;
    shortTag?: string | null;
    ownerId?: string | null;
    vaultNote?: string | null;
    goal?: string | null;
  }): Promise<CrmBrandRef>;
}
