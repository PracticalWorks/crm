import { describe, expect, it } from "vitest";
import { CrmClient } from "./client.js";
import {
  opportunityCreateResponse,
  opportunityListResponse,
  opportunityUpdateResponse,
  taskCreateResponse,
  taskListResponse,
  taskTargetListResponse,
} from "./fixtures/twenty-contracts.js";

type Call = { url: string; method?: string; body?: unknown };

const config = { baseUrl: "https://twenty.test", apiKey: "key" };

function fixtureFetch(
  calls: Call[],
  responseFor: (url: string, method?: string) => unknown,
): typeof fetch {
  return (async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify(responseFor(String(input), init?.method)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

describe("CrmClient Twenty task response contracts", () => {
  it.each([
    ["data.createTask", taskCreateResponse],
    ["data.task", { data: { task: taskCreateResponse.data.createTask } }],
    ["data record", { data: taskCreateResponse.data.createTask }],
  ])("maps the supported %s wrapper and propagates the assignee on create", async (_name, fixture) => {
    const calls: Call[] = [];
    const client = new CrmClient(config, fixtureFetch(calls, () => fixture));

    const task = await client.createTask({
      title: "Confirm the cleaning fee",
      dueAt: "2026-08-11T14:00:00-04:00",
      companyId: "company_harbor",
      assigneeId: "user_jo",
    });

    expect(calls[0]).toMatchObject({
      url: "https://twenty.test/rest/tasks",
      method: "POST",
      body: {
        title: "Confirm the cleaning fee",
        dueAt: "2026-08-11T14:00:00-04:00",
        assigneeId: "user_jo",
      },
    });
    expect(task).toEqual({
      id: "task_7f3c",
      title: "Confirm the cleaning fee",
      dueAt: "2026-08-11T14:00:00-04:00",
      companyId: "company_harbor",
      status: "TODO",
      taskUrl: "https://twenty.test/object/task/task_7f3c",
    });
    expect(calls[1]).toMatchObject({
      url: "https://twenty.test/rest/taskTargets",
      method: "POST",
      body: { taskId: "task_7f3c", companyId: "company_harbor" },
    });
  });

  it("maps an expanded taskTarget fixture without losing task identity or status", async () => {
    const client = new CrmClient(config, fixtureFetch([], () => taskTargetListResponse));

    await expect(client.listTasks({ companyId: "company_harbor" })).resolves.toEqual([
      {
        id: "task_7f3c",
        title: "Confirm the cleaning fee",
        dueAt: "2026-08-11T14:00:00-04:00",
        companyId: "company_harbor",
        status: "TODO",
        taskUrl: "https://twenty.test/object/task/task_7f3c",
      },
    ]);
  });

  it("maps the direct task collection fixture and preserves the assignee-bearing record", async () => {
    const client = new CrmClient(config, fixtureFetch([], () => taskListResponse));

    await expect(client.listTasks()).resolves.toEqual([
      {
        id: "task_9a21",
        title: "Send proposal",
        dueAt: null,
        companyId: null,
        status: "IN_PROGRESS",
        taskUrl: "https://twenty.test/object/task/task_9a21",
      },
    ]);
  });

  it("rejects a malformed create response instead of linking a phantom task", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(config, fixtureFetch(calls, () => ({ data: { createTask: { title: "no id" } } })));

    await expect(client.createTask({ title: "Confirm the cleaning fee", companyId: "company_harbor" })).rejects.toThrow(
      "crm task create returned no id",
    );
    expect(calls).toHaveLength(1);
  });
});

describe("CrmClient Twenty opportunity response contracts", () => {
  it.each([
    ["data.createOpportunity", opportunityCreateResponse],
    ["data.opportunity", { data: { opportunity: opportunityCreateResponse.data.createOpportunity } }],
    ["data record", { data: opportunityCreateResponse.data.createOpportunity }],
  ])("maps the supported %s wrapper on create", async (_name, fixture) => {
    const client = new CrmClient(config, fixtureFetch([], () => fixture));

    await expect(
      client.createOpportunity({ name: "Website rebuild", stage: "PROPOSAL", companyId: "company_harbor" }),
    ).resolves.toEqual({
      id: "opp_42b1",
      name: "Website rebuild",
      stage: "PROPOSAL",
      companyId: "company_harbor",
      opportunityUrl: "https://twenty.test/object/opportunity/opp_42b1",
    });
  });

  it("parses a listed opportunity when Twenty expands company as an object", async () => {
    const client = new CrmClient(config, fixtureFetch([], () => opportunityListResponse));

    await expect(client.listOpportunities({ companyId: "company_harbor" })).resolves.toEqual([
      {
        id: "opp_42b1",
        name: "Website rebuild",
        stage: "PROPOSAL",
        companyId: "company_harbor",
        opportunityUrl: "https://twenty.test/object/opportunity/opp_42b1",
      },
    ]);
  });

  it("maps the mutation wrapper and exact stage on opportunity update", async () => {
    const calls: Call[] = [];
    const client = new CrmClient(config, fixtureFetch(calls, () => opportunityUpdateResponse));

    await expect(client.updateOpportunityStage("opp_42b1", "WON")).resolves.toEqual({
      id: "opp_42b1",
      name: "Website rebuild",
      stage: "WON",
      companyId: "company_harbor",
      opportunityUrl: "https://twenty.test/object/opportunity/opp_42b1",
    });
    expect(calls[0]).toMatchObject({
      url: "https://twenty.test/rest/opportunities/opp_42b1",
      method: "PATCH",
      body: { stage: "WON" },
    });
  });

  it("rejects a malformed create response instead of returning an empty opportunity ref", async () => {
    const client = new CrmClient(config, fixtureFetch([], () => ({ data: { createOpportunity: { name: "no id" } } })));

    await expect(client.createOpportunity({ name: "Website rebuild", companyId: "company_harbor" })).rejects.toThrow(
      "crm opportunity create returned no id",
    );
  });
});
