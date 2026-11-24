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

export const taskWithBodyListResponse = {
  data: {
    tasks: [
      {
        id: "task_b0d7",
        title: "Confirm the late checkout",
        dueAt: null,
        status: "TODO",
        assigneeId: "member_jo",
        bodyV2: {
          blocknote: '[{"type":"paragraph","content":[{"type":"text","text":"From the guest thread"}]}]',
          markdown: "From the guest thread",
        },
      },
    ],
  },
} as const;

export const workspaceMemberListResponse = {
  data: {
    workspaceMembers: [
      {
        id: "member_jo",
        name: { firstName: "Jo", lastName: "Rivera" },
        userEmail: "jo@harbor.example",
        userId: "user_jo",
        colorScheme: "System",
        locale: "en",
        avatarUrl: "",
        jobTitle: "",
      },
    ],
  },
  pageInfo: { hasNextPage: false, startCursor: "cur-0", endCursor: "cur-1" },
  totalCount: 1,
} as const;

export const noteTargetListResponse = {
  data: {
    noteTargets: [
      {
        id: "notetarget_51a0",
        noteId: "note_51a0",
        targetPersonId: "person_sam",
        targetCompanyId: null,
        targetOpportunityId: null,
        createdAt: "2026-11-02T15:04:05.000Z",
        note: {
          id: "note_51a0",
          title: "Closed after 3 follow-ups",
          bodyV2: {
            blocknote: '[{"type":"paragraph","content":[{"type":"text","text":"No reply to the third follow-up"}]}]',
            markdown: "No reply to the third follow-up",
          },
          position: 0,
          createdAt: "2026-11-02T15:04:04.000Z",
          updatedAt: "2026-11-02T15:04:04.000Z",
        },
      },
    ],
  },
  pageInfo: { hasNextPage: false, startCursor: "cur-0", endCursor: "cur-1" },
  totalCount: 1,
} as const;
