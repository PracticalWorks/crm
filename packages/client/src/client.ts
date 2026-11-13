import { LEAD_STAGES, type LeadLink, type LeadOutcome, type LeadStep } from "./lead-record.js";
import type { CrmPort, LeadFields, LeadRecordPort } from "./port.js";
import type { CrmBrandRef, CrmCompanyRef, CrmNoteRef, CrmOpportunityRef, CrmPersonRef, CrmTaskRef } from "./schemas.js";

/**
 * CrmClient — one shared Twenty CRM integration. Wraps Twenty's REST API
 * (companies, people, notes+noteTargets, tasks, opportunities) behind the CrmPort
 * seam, so every runtime reaches client relationships here instead of standing
 * up its own Twenty client.
 *
 * REST facts (developer.twenty.com, verified against a self-hosted v1.15):
 * auth `Authorization: Bearer <key>`, base `<root>/rest`, record deep-link
 * `<root>/object/company/<id>`, notes created via POST /notes then linked via
 * POST /noteTargets. Responses wrap the record(s) under `data`; ids are UUIDs.
 * The Twenty logic was lifted from the proven str-manager twenty-source adapter
 * and expanded (search / get / create company + person).
 */

export interface CrmConfig {
  /** Twenty domain root or domain/rest; normalized either way. */
  baseUrl: string;
  /** Secret, passed in by name (TWENTY_API_KEY) — never stored/logged. */
  apiKey: string;
}

type Fetch = typeof globalThis.fetch;

/** Normalize a configured base into { root, api } (accepts trailing slash or /rest). */
function normalizeBase(raw: string): { root: string; api: string } {
  const root = raw.replace(/\/+$/, "").replace(/\/rest$/, "");
  return { root, api: `${root}/rest` };
}

/** Twenty wraps records under `data` and keys them by object name — tolerate the
 * several shapes seen across versions (record at `data`, `data.<singular>`, or a
 * mutation key like `data.create<Object>`). */
function unwrap(res: unknown, ...keys: string[]): any {
  const data = (res as { data?: unknown })?.data ?? res;
  for (const key of keys) {
    const hit = (data as Record<string, unknown> | null)?.[key];
    if (hit !== undefined && hit !== null) return hit;
  }
  return data;
}

/** Twenty's domainName may be a plain string or a links composite. */
function extractDomain(raw: unknown): string | null {
  if (typeof raw === "string") return raw || null;
  const url = (raw as { primaryLinkUrl?: string; url?: string } | null)?.primaryLinkUrl
    ?? (raw as { url?: string } | null)?.url;
  return url ?? null;
}

/** People arrive as an array, a `{ edges: [{ node }] }` connection, or `{ records }`. */
function extractPeopleRaw(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  const edges = (raw as { edges?: Array<{ node?: unknown }> } | null)?.edges;
  if (Array.isArray(edges)) return edges.map((e) => e.node).filter(Boolean);
  const records = (raw as { records?: unknown[] } | null)?.records;
  if (Array.isArray(records)) return records;
  return [];
}

function toPersonRef(raw: any): CrmPersonRef {
  const name = raw?.name ?? {};
  return {
    id: String(raw?.id ?? ""),
    firstName: name.firstName ?? null,
    lastName: name.lastName ?? null,
    email: raw?.emails?.primaryEmail ?? raw?.email ?? null,
    phone: raw?.phones?.primaryPhoneNumber ?? raw?.phone ?? null,
  };
}

/**
 * The relationship lane a Person sits in, independent of any Company. Stored on
 * Twenty's custom `lane` SELECT field (created by `ensurePersonFields`). Twenty
 * requires an option value in UPPER_SNAKE, so `client` is written as `CLIENT`
 * and read back lowercase; the casing never leaves this file.
 */
export const PERSON_LANES = ["client", "partner", "vendor", "prospect", "recruiter", "network", "personal"] as const;
export type PersonLane = (typeof PERSON_LANES)[number];

/** A stored lane value, or null for a Person created before the field existed or holding an unknown option. */
function toLane(raw: unknown): PersonLane | null {
  const value = typeof raw === "string" ? raw.toLowerCase() : "";
  return (PERSON_LANES as readonly string[]).includes(value) ? (value as PersonLane) : null;
}

/** A Person found by contact detail, with the company it is linked to (null when unlinked). */
export interface PersonMatch {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  /** Null for People created before the `lane` field existed. */
  lane: PersonLane | null;
}

function toPersonMatch(raw: any): PersonMatch {
  const ref = toPersonRef(raw);
  return {
    id: ref.id,
    name: [ref.firstName, ref.lastName].filter(Boolean).join(" ").trim(),
    email: ref.email,
    phone: ref.phone,
    companyId: raw?.companyId ?? raw?.company?.id ?? null,
    lane: toLane(raw?.lane),
  };
}

/**
 * The bare host a domain names, so "https://www.Harbor.com/about" and "harbor.com"
 * compare equal: no scheme, no `www.`, no path, query, port or trailing dot.
 */
function normalizeDomain(raw: string | null | undefined): string | null {
  const host = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  return host || null;
}

/** The custom Person fields this client writes, as Twenty's metadata API creates them. */
const PERSON_FIELDS = [
  {
    name: "lane",
    type: "SELECT",
    label: "Lane",
    description: "The relationship lane this person sits in, independent of any company.",
    icon: "IconRoad",
    options: PERSON_LANES.map((lane, position) => ({
      value: lane.toUpperCase(),
      label: lane.charAt(0).toUpperCase() + lane.slice(1),
      position,
      color: ["green", "blue", "orange", "purple", "pink", "turquoise", "gray"][position],
    })),
  },
  {
    name: "source",
    type: "TEXT",
    label: "Source",
    description: "Where this person was first captured, e.g. \"sales inbox\".",
    icon: "IconInbox",
  },
] as const;

/** A custom field as Twenty's metadata API creates it. Select values are UPPER_SNAKE. */
export interface FieldSpec {
  name: string;
  label: string;
  type: string;
  description?: string;
  icon?: string;
  options?: ReadonlyArray<{ value: string; label: string; position?: number; color?: string }>;
}

/** What `ensureFields` / `ensurePersonFields` found and did. `created` is empty on a dry run; `missing` is what a run with apply creates. */
export interface PersonFieldsResult {
  present: string[];
  missing: string[];
  created: string[];
}

/** Object metadata arrives with `fields` as an array or a `{ edges: [{ node }] }` connection. */
function extractFields(raw: unknown): any[] | null {
  if (Array.isArray(raw)) return raw;
  const edges = (raw as { edges?: Array<{ node?: unknown }> } | null)?.edges;
  return Array.isArray(edges) ? edges.map((e) => e.node).filter(Boolean) : null;
}

/** The last 10 digits, so "+1 (360) 303-9131" and "3603039131" compare equal; null if too short. */
function phoneKey(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/**
 * A phone as Twenty's PHONES composite stores it: national digits and the calling code in their own
 * fields. A North American number (10 digits, or 11 with a leading 1) gets +1 and NO country: +1
 * spans the US, Puerto Rico and Canada, and Twenty refuses a stamped "US" on a 787 or 236 number
 * (CONFLICTING_PHONE_COUNTRY_CODE), so it infers the country itself. Anything else is
 * kept as given rather than guessed at.
 */
function twentyPhone(raw: string): Record<string, string> {
  const digits = raw.replace(/\D/g, "");
  const plus = raw.trim().startsWith("+");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.length === 10 && !plus ? digits : null;
  if (national) return { primaryPhoneNumber: national, primaryPhoneCallingCode: "+1" };
  return { primaryPhoneNumber: raw.trim() };
}

/** Every number a raw Person carries: the primary, then each of `additionalPhones`. */
function allPhones(raw: any): string[] {
  const extra = raw?.phones?.additionalPhones;
  const more = Array.isArray(extra) ? extra.map((a: any) => (typeof a === "string" ? a : String(a?.number ?? ""))) : [];
  return [raw?.phones?.primaryPhoneNumber ?? raw?.phone ?? "", ...more].filter(Boolean);
}

export class CrmClient implements CrmPort, LeadRecordPort {
  private readonly root: string;
  private readonly api: string;

  constructor(
    private readonly config: CrmConfig,
    private readonly fetchImpl: Fetch = globalThis.fetch,
  ) {
    const { root, api } = normalizeBase(config.baseUrl);
    this.root = root;
    this.api = api;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await this.fetchImpl(`${this.api}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      // Twenty says why it refused (a field it rejects, a bad value): keep it, or a 400 is a guess.
      const why = await res.text().then((t) => t.replace(/\s+/g, " ").trim().slice(0, 300), () => "");
      throw new Error(`crm ${method} ${path} failed: ${res.status}${why ? ` ${why}` : ""}`);
    }
    return res.json().catch(() => ({}));
  }

  companyUrl(companyId: string): string {
    return `${this.root}/object/company/${companyId}`;
  }

  private toCompanyRef(raw: any): CrmCompanyRef {
    return {
      id: String(raw?.id ?? ""),
      name: raw?.name ?? "",
      domainName: extractDomain(raw?.domainName),
      crmUrl: this.companyUrl(String(raw?.id ?? "")),
      people: extractPeopleRaw(raw?.people).map(toPersonRef),
    };
  }

  /**
   * The company whose domain is exactly `domain`, after normalising scheme,
   * `www.` and case on both sides; null when none is. Twenty narrows with an
   * ilike substring and the exact comparison happens here, so "harbor.com" never
   * returns "notharbor.com". When several companies share a domain, the first wins.
   */
  async findCompanyByDomain(domain: string): Promise<CrmCompanyRef | null> {
    const wanted = normalizeDomain(domain);
    if (!wanted) return null;
    const filter = `domainName.primaryLinkUrl[ilike]:"%${wanted}%"`;
    const res = await this.request("GET", `/companies?filter=${encodeURIComponent(filter)}&limit=60`);
    const list = unwrap(res, "companies");
    const hit = (Array.isArray(list) ? list : []).find(
      (c) => normalizeDomain(extractDomain(c?.domainName)) === wanted,
    );
    return hit ? this.toCompanyRef(hit) : null;
  }

  async searchCompanies(query: string): Promise<CrmCompanyRef[]> {
    // ilike is case-insensitive substring; wrap in % so partial names match.
    const filter = `name[ilike]:${encodeURIComponent(`%${query}%`)}`;
    const res = await this.request("GET", `/companies?filter=${filter}&depth=1&limit=20`);
    const list = unwrap(res, "companies");
    return (Array.isArray(list) ? list : []).map((c) => this.toCompanyRef(c));
  }

  /**
   * People whose primary email, or primary or additional phone, matches; the union,
   * deduped by id, when both are given. Twenty narrows server-side and the exact
   * match is decided here: ilike treats `_` and `%` in an address as wildcards, and a
   * phone is stored as national digits with the calling code in its own field, so a
   * formatted or +1-prefixed number cannot be compared on the server.
   */
  async findPeople(match: { email?: string; phone?: string }): Promise<PersonMatch[]> {
    const found = new Map<string, PersonMatch>();
    const email = match.email?.trim().toLowerCase();
    if (email) {
      for (const raw of await this.listPeople(`emails.primaryEmail[ilike]:"${email}"`)) {
        const person = toPersonMatch(raw);
        if (person.email?.toLowerCase() === email) found.set(person.id, person);
      }
    }
    const phone = phoneKey(match.phone);
    if (phone) {
      // Filter on the last four digits only: no common formatting splits them.
      for (const raw of await this.listPeople(`phones.primaryPhoneNumber[like]:"%${phone.slice(-4)}"`)) {
        const person = toPersonMatch(raw);
        if (phoneKey(person.phone) === phone) found.set(person.id, person);
      }
      // additionalPhones is JSON on Twenty's side: narrowed by the last four digits anywhere in it.
      // A Twenty that refuses the filter costs the second number, never the primary match.
      const extra = await this.listPeople(`phones.additionalPhones[like]:"%${phone.slice(-4)}%"`).catch(() => []);
      for (const raw of extra) {
        if (allPhones(raw).slice(1).some((n) => phoneKey(n) === phone)) {
          const person = toPersonMatch(raw);
          found.set(person.id, person);
        }
      }
    }
    return [...found.values()];
  }

  private async listPeople(filter: string): Promise<any[]> {
    const res = await this.request("GET", `/people?filter=${encodeURIComponent(filter)}&limit=60`);
    const list = unwrap(res, "people");
    return Array.isArray(list) ? list : [];
  }

  async getCompany(companyId: string): Promise<CrmCompanyRef | null> {
    try {
      const res = await this.request("GET", `/companies/${companyId}?depth=1`);
      const raw = unwrap(res, "company");
      if (!raw?.id) return null;
      return this.toCompanyRef(raw);
    } catch {
      return null;
    }
  }

  async createCompany(input: { name: string; domainName?: string }): Promise<CrmCompanyRef> {
    const body: Record<string, unknown> = { name: input.name };
    if (input.domainName) body.domainName = input.domainName;
    const res = await this.request("POST", "/companies", body);
    return this.toCompanyRef(unwrap(res, "createCompany", "company"));
  }

  /**
   * Add a Person, linked to a company when `companyId` is given and standing
   * alone when it is not. `lane` and `source` need the custom fields
   * `ensurePersonFields` creates; Twenty rejects them on a workspace without.
   */
  async createPerson(input: {
    companyId?: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    lane?: PersonLane;
    source?: string;
  }): Promise<CrmPersonRef> {
    const body: Record<string, unknown> = {
      name: { firstName: input.firstName, lastName: input.lastName ?? "" },
    };
    if (input.companyId) body.companyId = input.companyId;
    if (input.email) body.emails = { primaryEmail: input.email };
    if (input.phone) body.phones = twentyPhone(input.phone);
    if (input.lane) body.lane = input.lane.toUpperCase();
    if (input.source) body.source = input.source;
    const res = await this.request("POST", "/people", body);
    return toPersonRef(unwrap(res, "createPerson", "person"));
  }

  /** Set a Person's name, e.g. one first saved under a phone number. Nothing else on the Person changes. */
  async renamePerson(personId: string, name: { firstName: string; lastName?: string }): Promise<CrmPersonRef> {
    const res = await this.request("PATCH", `/people/${personId}`, { name: { firstName: name.firstName, lastName: name.lastName ?? "" } });
    const raw = unwrap(res, "updatePerson", "person");
    return toPersonRef({ ...raw, id: raw?.id ?? personId });
  }

  /**
   * Set fields on a Person, custom ones included (an outreach sequence's state, say):
   * only the fields given are sent, and `null` clears one. The field must exist on
   * the workspace (see `ensureFields`); Twenty refuses an unknown one with a 400.
   */
  async updatePerson(personId: string, patch: Record<string, unknown>): Promise<CrmPersonRef> {
    const body = definedOnly(patch);
    const res = await this.request("PATCH", `/people/${personId}`, body);
    const raw = unwrap(res, "updatePerson", "person");
    return toPersonRef({ ...raw, id: raw?.id ?? personId });
  }

  /**
   * Make sure Person carries the custom `lane` and `source` fields, creating
   * only what is missing, and only when `apply` is true. A wrapper over
   * `ensureFields`, kept so its callers change nothing.
   */
  async ensurePersonFields(opts: { apply: boolean }): Promise<PersonFieldsResult> {
    return this.ensureFields("person", PERSON_FIELDS, opts);
  }

  /**
   * Make sure an object carries these custom fields, creating only what is
   * missing, and only when `apply` is true. Idempotent: a second run finds them
   * present and writes nothing. A field that exists with the wrong type, or a
   * select missing one of the wanted options, is an error, never an overwrite:
   * changing a live field is an owner's call.
   */
  async ensureFields(
    objectNameSingular: string,
    specs: readonly FieldSpec[],
    opts: { apply: boolean },
  ): Promise<PersonFieldsResult> {
    const objects = unwrap(await this.request("GET", "/metadata/objects"), "objects");
    const target = (Array.isArray(objects) ? objects : []).find((o) => o?.nameSingular === objectNameSingular);
    if (!target?.id) throw new Error(`crm metadata: no ${objectNameSingular} object in this workspace`);
    const fields = extractFields(target.fields);
    if (!fields) throw new Error(`crm metadata: the ${objectNameSingular} object came back without its fields; refusing to create blind`);

    const result: PersonFieldsResult = { present: [], missing: [], created: [] };
    for (const wanted of specs) {
      const existing = fields.find((f) => f?.name === wanted.name);
      if (!existing) {
        result.missing.push(wanted.name);
        continue;
      }
      if (existing.type !== wanted.type) {
        throw new Error(`crm metadata: ${objectNameSingular}.${wanted.name} is ${existing.type}, expected ${wanted.type}`);
      }
      if (wanted.options) {
        const have = new Set((existing.options ?? []).map((o: { value?: string }) => o?.value));
        const absent = wanted.options.filter((o) => !have.has(o.value)).map((o) => o.value);
        if (absent.length) throw new Error(`crm metadata: ${objectNameSingular}.${wanted.name} lacks options ${absent.join(", ")}`);
      }
      result.present.push(wanted.name);
    }
    if (!opts.apply) return result;
    for (const name of result.missing) {
      const wanted = specs.find((f) => f.name === name)!;
      await this.request("POST", "/metadata/fields", { ...wanted, objectMetadataId: target.id, isNullable: true });
      result.created.push(name);
    }
    return result;
  }

  async addNote(companyId: string, note: { title?: string; body: string }): Promise<CrmNoteRef> {
    const title = note.title ?? (note.body.length > 60 ? `${note.body.slice(0, 57)}...` : note.body);
    // The note entity has no `body` field: its text is `bodyV2`, a RICH_TEXT_V2
    // composite. `markdown` alone is accepted and the workspace derives the
    // blocknote (verified live 2026-08-27). A plain `body` is a 400, "Object note
    // doesn't have any body field", which every caller had been swallowing.
    const created = await this.request("POST", "/notes", { title, bodyV2: { markdown: note.body } });
    const noteId = unwrap(created, "createNote", "note")?.id;
    if (!noteId) throw new Error("crm note create returned no id");
    await this.request("POST", "/noteTargets", { noteId, companyId });
    return { id: String(noteId), companyId };
  }

  // --- Tasks: the durable half of anything scheduled -----------------------
  //
  // A calendar event is a VIEW. The record that we committed to something, and
  // who it was for, lives here next to the relationship, so it stays answerable
  // long after the event scrolls off a calendar.

  taskUrl(taskId: string): string {
    return `${this.root}/object/task/${taskId}`;
  }

  opportunityUrl(opportunityId: string): string {
    return `${this.root}/object/opportunity/${opportunityId}`;
  }

  /**
   * Create a commitment, then link it to the company through a *Target join row
   * — the same two-step shape as a note.
   *
   * Twenty's task assignee is a WorkspaceMember relation, so callers must pass
   * a WorkspaceMember id, not a Person id. Keep it on the task POST, while the
   * separate taskTarget join below.
   */
  async createTask(input: {
    title: string;
    dueAt?: string;
    companyId?: string;
    assigneeId?: string;
  }): Promise<CrmTaskRef> {
    const body: Record<string, unknown> = { title: input.title };
    if (input.dueAt) body.dueAt = input.dueAt;
    if (input.assigneeId) body.assigneeId = input.assigneeId;
    const created = await this.request("POST", "/tasks", body);
    const raw = unwrap(created, "createTask", "task");
    const taskId = raw?.id;
    if (!taskId) throw new Error("crm task create returned no id");
    if (input.companyId) {
      await this.request("POST", "/taskTargets", { taskId, companyId: input.companyId });
    }
    // What we sent wins over what the create echoed back: Twenty may omit either
    // field from a create response, and the caller's own input is never wrong.
    return {
      ...this.toTaskRef(raw, input.companyId ?? null),
      title: input.title,
      dueAt: input.dueAt ?? null,
    };
  }

  /**
   * Read commitments back. Two different queries, not one filtered one:
   *
   * A task holds no company of its own — the link lives on a `taskTarget` join
   * row, the same shape notes use — so asking "what is open for this client"
   * means reading that client's targets and lifting the task off each one.
   * Rows whose task did not come back expanded are dropped rather than guessed
   * at, so a caller never receives a ref pointing at a task we cannot name.
   */
  async listTasks(input: { companyId?: string; limit?: number } = {}): Promise<CrmTaskRef[]> {
    const limit = input.limit ?? 50;
    if (!input.companyId) {
      const res = await this.request("GET", `/tasks?depth=1&limit=${limit}`);
      const list = unwrap(res, "tasks");
      return (Array.isArray(list) ? list : []).filter((t) => t?.id).map((t) => this.toTaskRef(t, null));
    }
    const filter = `companyId[eq]:${encodeURIComponent(input.companyId)}`;
    const res = await this.request("GET", `/taskTargets?filter=${filter}&depth=1&limit=${limit}`);
    const list = unwrap(res, "taskTargets");
    return (Array.isArray(list) ? list : [])
      .map((row) => row?.task)
      .filter((task) => task?.id)
      .map((task) => this.toTaskRef(task, input.companyId ?? null));
  }

  async updateOpportunityStage(opportunityId: string, stage: string): Promise<CrmOpportunityRef> {
    return this.updateOpportunity(opportunityId, { stage });
  }

  /**
   * Patch an opportunity: only the fields given are sent, and what we sent wins over the echo.
   * `null` clears the owner; `stage` and `name` are always values.
   */
  async updateOpportunity(
    opportunityId: string,
    patch: { stage?: string; ownerId?: string | null; name?: string } & LeadFields,
  ): Promise<CrmOpportunityRef> {
    const body = toOpportunityBody(patch);
    const res = await this.request("PATCH", `/opportunities/${opportunityId}`, body);
    const raw = unwrap(res, "updateOpportunity", "opportunity");
    return this.toOpportunityRef({ ...raw, ...body, id: raw?.id ?? opportunityId });
  }

  /** Record the finer step an app works inside the stage (job applications: Applied, InMail sent, ...). */
  async setStep(opportunityId: string, step: LeadStep | null): Promise<CrmOpportunityRef> {
    return this.updateOpportunity(opportunityId, { step });
  }

  /**
   * Close a lead: stage Closed, its outcome, the hours spent scoping and the close
   * date (now unless given). `scopingHours` may be left out when nobody logged them;
   * the record then shows it missing rather than a made-up zero.
   */
  async close(
    opportunityId: string,
    input: { outcome: LeadOutcome; scopingHours?: number; closeDate?: string },
  ): Promise<CrmOpportunityRef> {
    return this.updateOpportunity(opportunityId, {
      stage: LEAD_STAGES.CLOSED,
      outcome: input.outcome,
      scopingHours: input.scopingHours,
      closeDate: input.closeDate ?? new Date().toISOString(),
    });
  }

  // --- Brands: one record per brand, seeded from the brand roster by key -----

  /** Every brand record, read fresh. */
  async listBrands(): Promise<CrmBrandRef[]> {
    const res = await this.request("GET", "/brands?limit=200");
    const list = unwrap(res, "brands");
    return (Array.isArray(list) ? list : []).filter((b) => b?.id).map(toBrandRef);
  }

  /**
   * Create the brand with this `key`, or update the one that has it. Only the
   * fields given are written on an update, so a seed that knows a brand's name but
   * not its owner never clears the owner set by hand.
   */
  async upsertBrand(input: {
    key: string;
    name: string;
    shortTag?: string | null;
    ownerId?: string | null;
    vaultNote?: string | null;
    goal?: string | null;
  }): Promise<CrmBrandRef> {
    const key = input.key.trim();
    if (!key) throw new Error("crm brand: key is required");
    const filter = `key[eq]:"${key}"`;
    const found = unwrap(await this.request("GET", `/brands?filter=${encodeURIComponent(filter)}&limit=2`), "brands");
    const existing = (Array.isArray(found) ? found : []).find((b) => b?.key === key);
    const body: Record<string, unknown> = definedOnly({
      key,
      name: input.name,
      shortTag: input.shortTag,
      ownerId: input.ownerId,
      goal: input.goal,
    });
    if (input.vaultNote !== undefined) body.vaultNote = toLinks(input.vaultNote === null ? [] : [input.vaultNote]);
    if (existing?.id) {
      const res = await this.request("PATCH", `/brands/${existing.id}`, body);
      const raw = unwrap(res, "updateBrand", "brand");
      return toBrandRef({ ...existing, ...raw, ...body, id: existing.id });
    }
    const res = await this.request("POST", "/brands", body);
    const raw = unwrap(res, "createBrand", "brand");
    if (!raw?.id) throw new Error("crm brand create returned no id");
    return toBrandRef({ ...raw, ...body });
  }

  async deleteOpportunity(opportunityId: string): Promise<void> {
    await this.request("DELETE", `/opportunities/${opportunityId}`);
  }

  /**
   * Patch a company. `relationshipType` is the workspace's own select value, passed through.
   * `null` clears either field.
   */
  async updateCompany(
    companyId: string,
    patch: { relationshipType?: string | null; accountOwnerId?: string | null },
  ): Promise<CrmCompanyRef> {
    const res = await this.request("PATCH", `/companies/${companyId}`, definedOnly(patch));
    const raw = unwrap(res, "updateCompany", "company");
    return this.toCompanyRef({ ...raw, id: raw?.id ?? companyId });
  }

  async createOpportunity(
    input: { name: string; stage?: string; companyId: string } & LeadFields,
  ): Promise<CrmOpportunityRef> {
    const { stage, ...rest } = input;
    const body = toOpportunityBody(rest);
    if (stage) body.stage = stage;
    const res = await this.request("POST", "/opportunities", body);
    const raw = unwrap(res, "createOpportunity", "opportunity");
    if (!raw?.id) throw new Error("crm opportunity create returned no id");
    return this.toOpportunityRef({ ...raw, ...body, stage: stage ?? raw.stage });
  }

  async listOpportunities(input: { companyId?: string; limit?: number } = {}): Promise<CrmOpportunityRef[]> {
    const limit = input.limit ?? 50;
    const query = input.companyId ? `?filter=companyId[eq]:${encodeURIComponent(input.companyId)}&depth=1&limit=${limit}` : `?depth=1&limit=${limit}`;
    const res = await this.request("GET", `/opportunities${query}`);
    const list = unwrap(res, "opportunities");
    return (Array.isArray(list) ? list : []).filter((item) => item?.id).map((item) => this.toOpportunityRef(item));
  }

  private toOpportunityRef(raw: any): CrmOpportunityRef {
    const ref: CrmOpportunityRef = {
      id: String(raw?.id ?? ""),
      name: raw?.name ?? raw?.title ?? "",
      stage: raw?.stage ?? null,
      companyId: raw?.companyId ?? raw?.company?.id ?? null,
      opportunityUrl: this.opportunityUrl(String(raw?.id ?? "")),
    };
    // The lead record fields, only where the record (or what we sent) carries them.
    const lead: Partial<CrmOpportunityRef> = {
      brandId: raw?.brandId ?? raw?.brand?.id,
      ownerId: raw?.ownerId ?? raw?.owner?.id,
      source: raw?.source,
      sourceDetail: raw?.sourceDetail === undefined ? undefined : linkUrls(raw.sourceDetail)[0] ?? null,
      market: raw?.market,
      type: raw?.leadType,
      step: raw?.step,
      triageVerdict: raw?.triageVerdict,
      passReason: raw?.passReason,
      scopingHours: raw?.scopingHours,
      outcome: raw?.outcome,
      closeDate: raw?.closeDate,
      links: raw?.leadLinks === undefined ? undefined : linkUrls(raw.leadLinks),
    };
    return { ...ref, ...definedOnly(lead) };
  }

  async updateTaskDueAt(taskId: string, dueAt: string): Promise<CrmTaskRef> {
    return this.updateTask(taskId, { dueAt });
  }

  /** Move a commitment between columns. */
  async updateTaskStatus(taskId: string, status: string): Promise<CrmTaskRef> {
    return this.updateTask(taskId, { status });
  }

  /**
   * Patch a task: only the fields given are sent, and what we sent wins over the echo.
   * `assigneeId` is a WorkspaceMember id, as on createTask. `null` clears the fields that
   * may be empty (assignee, due date); `status` is always a value.
   */
  async updateTask(
    taskId: string,
    patch: { status?: string; dueAt?: string | null; assigneeId?: string | null },
  ): Promise<CrmTaskRef> {
    const updated = await this.request("PATCH", `/tasks/${taskId}`, definedOnly(patch));
    const raw = unwrap(updated, "updateTask", "task");
    const ref = this.toTaskRef({ ...raw, id: raw?.id ?? taskId }, null);
    return { ...ref, ...(patch.status !== undefined && { status: patch.status }), ...(patch.dueAt !== undefined && { dueAt: patch.dueAt }) };
  }

  /** Shape a raw Twenty task record into the ref callers get. `companyId` is
   * passed in rather than read off the record because the task never carries it. */
  private toTaskRef(raw: any, companyId: string | null): CrmTaskRef {
    const id = String(raw?.id ?? "");
    return {
      id,
      title: raw?.title ?? "",
      dueAt: raw?.dueAt ?? null,
      companyId,
      status: raw?.status ?? null,
      taskUrl: this.taskUrl(id),
    };
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.request("DELETE", `/tasks/${taskId}`);
  }
}

/** A PATCH body with the undefined keys dropped, so an absent field is never cleared. */
function definedOnly<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * The lead fields as Twenty's REST API takes them. Two API names differ from the
 * client's: Twenty reserves `type` and `links` as field names, so the fields are
 * `leadType` and `leadLinks`. Links are LINKS composites; `null` clears one (an empty
 * composite, which Twenty accepts where it refuses a bare null).
 */
function toOpportunityBody(fields: LeadFields & { stage?: string; name?: string; companyId?: string }): Record<string, unknown> {
  const { type, links, sourceDetail, ...rest } = fields;
  const body: Record<string, unknown> = definedOnly(rest as Record<string, unknown>);
  if (type !== undefined) body.leadType = type;
  if (sourceDetail !== undefined) body.sourceDetail = toLinks(sourceDetail === null ? [] : [sourceDetail]);
  if (links !== undefined) body.leadLinks = toLinks(links ?? []);
  return body;
}

/** A Twenty LINKS composite: the first link is the primary, the rest secondary. */
function toLinks(links: readonly LeadLink[]): Record<string, unknown> {
  const [first, ...more] = links.map((l) => (typeof l === "string" ? { url: l, label: "" } : { url: l.url, label: l.label ?? "" }));
  return {
    primaryLinkUrl: first?.url ?? "",
    primaryLinkLabel: first?.label ?? "",
    secondaryLinks: more,
  };
}

/** The URLs a LINKS composite holds, primary first; empty for an empty or absent one. */
function linkUrls(raw: unknown): string[] {
  const links = raw as { primaryLinkUrl?: string; secondaryLinks?: Array<{ url?: string }> | null } | null;
  if (!links) return [];
  return [links.primaryLinkUrl ?? "", ...(links.secondaryLinks ?? []).map((l) => l?.url ?? "")].filter(Boolean);
}

function toBrandRef(raw: any): CrmBrandRef {
  return {
    id: String(raw?.id ?? ""),
    key: raw?.key ?? "",
    name: raw?.name ?? "",
    shortTag: raw?.shortTag ?? null,
    ownerId: raw?.ownerId ?? raw?.owner?.id ?? null,
    vaultNote: linkUrls(raw?.vaultNote)[0] ?? null,
    goal: raw?.goal ?? null,
  };
}
