/**
 * Frozen Twenty REST payloads used by the CrmClient seam tests.
 *
 * These are deliberately shaped like the responses observed by this client:
 * REST record wrappers, collection wrappers, and mutation-specific keys. Keep
 * the payloads explicit so a vendor response drift cannot pass as truthy data.
 */

export const taskCreateResponse = {
  data: {
    createTask: {
      id: "task_7f3c",
      title: "Confirm the cleaning fee",
      dueAt: "2026-08-11T14:00:00-04:00",
      status: "TODO",
      assigneeId: "user_jo",
    },
  },
} as const;

export const taskTargetListResponse = {
  data: {
    taskTargets: [
      {
        id: "target_7f3c",
        task: {
          id: "task_7f3c",
          title: "Confirm the cleaning fee",
          dueAt: "2026-08-11T14:00:00-04:00",
          status: "TODO",
          assigneeId: "user_jo",
        },
      },
    ],
  },
} as const;

export const taskListResponse = {
  data: {
    tasks: [
      {
        id: "task_9a21",
        title: "Send proposal",
        dueAt: null,
        status: "IN_PROGRESS",
        assigneeId: "user_sam",
      },
    ],
  },
} as const;

export const opportunityCreateResponse = {
  data: {
    createOpportunity: {
      id: "opp_42b1",
      name: "Website rebuild",
      stage: "PROPOSAL",
      companyId: "company_harbor",
    },
  },
} as const;

export const opportunityListResponse = {
  data: {
    opportunities: [
      {
        id: "opp_42b1",
        name: "Website rebuild",
        stage: "PROPOSAL",
        company: { id: "company_harbor" },
      },
    ],
  },
} as const;

export const opportunityUpdateResponse = {
  data: {
    updateOpportunity: {
      id: "opp_42b1",
      name: "Website rebuild",
      stage: "WON",
      companyId: "company_harbor",
    },
  },
} as const;
