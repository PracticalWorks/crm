// The lead record: one Opportunity per lead, bid, job application or inquiry, for
// every brand. These lists are the one source of the option values. The Twenty App
// in `twenty-app/` declares its SELECT fields from them and writers import them from
// here, so a value a writer sends always exists on the field it writes.
//
// Values are UPPER_SNAKE, as Twenty requires for select options; labels are what
// the workspace shows.

type Option<V extends string = string> = { readonly value: V; readonly label: string };

function options<const T extends readonly Option[]>(list: T): T {
  return list;
}

/** Where the lead came from. */
export const LEAD_SOURCES = options([
  { value: "UPWORK", label: "Upwork" },
  { value: "LINKEDIN_JOBS", label: "LinkedIn Jobs" },
  { value: "JOB_BOARD", label: "Job board" },
  { value: "RFP", label: "RFP" },
  { value: "OUTREACH", label: "Outreach" },
  { value: "REFERRAL", label: "Referral" },
  { value: "PARTNER_DIRECTORY", label: "Partner directory" },
  { value: "INBOUND_FORM", label: "Inbound form" },
  { value: "AD_FORM", label: "Ad form" },
  { value: "SOCIAL", label: "Social" },
  { value: "AIRBNB", label: "Airbnb" },
  { value: "PHONE", label: "Phone" },
  { value: "TASKRABBIT", label: "TaskRabbit" },
  { value: "OTHER", label: "Other" },
]);
export type LeadSource = (typeof LEAD_SOURCES)[number]["value"];

/** What kind of deal it is. Win-rate rankings filter on it, so a partner pipeline never counts as a project. */
export const LEAD_TYPES = options([
  { value: "PROJECT", label: "Project" },
  { value: "CONTRACT_SEAT", label: "Contract seat" },
  { value: "JOB_APPLICATION", label: "Job application" },
  { value: "PRODUCT_SIGNUP", label: "Product signup" },
  { value: "PARTNER", label: "Partner" },
]);
export type LeadType = (typeof LEAD_TYPES)[number]["value"];

/** Geography or segment. */
export const LEAD_MARKETS = options([
  { value: "US_CODING", label: "US coding" },
  { value: "FDE_EUROPE", label: "FDE Europe" },
  { value: "TAMPA_BAY", label: "Tampa Bay" },
  { value: "SAAS_STARTUP", label: "SaaS startup" },
  { value: "DEV_AGENCY", label: "Dev agency" },
  { value: "SMB_OPS", label: "SMB ops" },
  { value: "OTHER", label: "Other" },
]);
export type LeadMarket = (typeof LEAD_MARKETS)[number]["value"];

/** Finer steps where an app works them (job applications today). Stage stays the shared pipeline. */
export const LEAD_STEPS = options([
  { value: "PREPARING", label: "Preparing" },
  { value: "READY_TO_APPLY", label: "Ready to apply" },
  { value: "APPLIED", label: "Applied" },
  { value: "INMAIL_SENT", label: "InMail sent" },
  { value: "FOLLOWED_UP", label: "Followed up" },
  { value: "RECRUITER_SCREEN", label: "Recruiter screen" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "OFFER", label: "Offer" },
]);
export type LeadStep = (typeof LEAD_STEPS)[number]["value"];

/** The triage call. A pass carries its reason in `passReason`. */
export const TRIAGE_VERDICTS = options([
  { value: "WORK", label: "Work" },
  { value: "PASS", label: "Pass" },
  { value: "DEFER", label: "Defer" },
]);
export type TriageVerdict = (typeof TRIAGE_VERDICTS)[number]["value"];

/** How a closed lead ended. Applications use hired / rejected / no reply / withdrew. */
export const LEAD_OUTCOMES = options([
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "NO_REPLY", label: "No reply" },
  { value: "PASSED", label: "Passed" },
  { value: "HIRED", label: "Hired" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDREW", label: "Withdrew" },
]);
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number]["value"];

/**
 * The six stages every Type shares, keyed by name, mapped to the value the
 * workspace stores TODAY. Write `LEAD_STAGES.ENGAGED`, never the string.
 *
 * Four stages still carry the standard field's original values: renaming a select
 * value rewrites the column's enum, so any writer still sending the old value would
 * be refused from that moment. The labels change now; the values move in a later
 * release, once every writer sends these constants, and only this map changes then.
 */
export const LEAD_STAGES = {
  NEW: "NEW",
  TRIAGED: "SCREENING",
  LIGHT_REPLY_SENT: "LIGHT_REPLY_SENT",
  ENGAGED: "MEETING",
  PROPOSAL_OUT: "PROPOSAL",
  CLOSED: "CUSTOMER",
} as const;
export type LeadStageName = keyof typeof LEAD_STAGES;
export type LeadStage = (typeof LEAD_STAGES)[LeadStageName];

/** The label each stage shows, in pipeline order. */
export const LEAD_STAGE_LABELS: Readonly<Record<LeadStageName, string>> = {
  NEW: "New",
  TRIAGED: "Triaged",
  LIGHT_REPLY_SENT: "Light reply sent",
  ENGAGED: "Engaged",
  PROPOSAL_OUT: "Proposal out",
  CLOSED: "Closed",
};

/** A link as a writer gives it: a bare URL, or a URL with the label to show. */
export type LeadLink = string | { url: string; label?: string };
