#!/usr/bin/env node
/**
 * Give Twenty's Person object the custom `lane` (SELECT) and `source` (TEXT)
 * fields CrmClient writes. DRY RUN BY DEFAULT.
 *
 *   pnpm --filter @practicalworks/crm exec tsx src/ensure-person-fields-cli.ts            # plan only
 *   pnpm --filter @practicalworks/crm exec tsx src/ensure-person-fields-cli.ts --apply    # create what is missing
 *
 * A hand tool, run once by a person: nothing schedules it and CI never calls
 * it. Idempotent, so a second run reports both fields present and writes
 * nothing. `CrmClient.ensurePersonFields` is the logic and what the tests
 * cover; this file is argv and I/O.
 *
 * Reads `TWENTY_API_KEY` and `TWENTY_BASE_URL` from the environment, by name.
 * Nothing prints their values.
 */
import { CrmClient } from "./client.js";

async function main(argv: readonly string[]): Promise<number> {
  const unknown = argv.filter((a) => a !== "--apply" && a !== "--dry-run");
  if (unknown.length) {
    process.stderr.write(`unknown argument(s): ${unknown.join(" ")}\nusage: ensure-person-fields-cli.ts [--apply]\n`);
    return 2;
  }
  // `--dry-run` is accepted and is the default: writing requires `--apply`.
  const apply = argv.includes("--apply");
  const missing = ["TWENTY_API_KEY", "TWENTY_BASE_URL"].filter((name) => !process.env[name]);
  if (missing.length) {
    process.stderr.write(`missing env: ${missing.join(", ")}\n`);
    return 2;
  }
  const crm = new CrmClient({ baseUrl: process.env.TWENTY_BASE_URL!, apiKey: process.env.TWENTY_API_KEY! });
  const result = await crm.ensurePersonFields({ apply });
  process.stdout.write(`present: ${result.present.join(", ") || "none"}\n`);
  process.stdout.write(`missing: ${result.missing.join(", ") || "none"}\n`);
  if (apply) process.stdout.write(`created: ${result.created.join(", ") || "none"}\n`);
  else if (result.missing.length) process.stdout.write("dry run: re-run with --apply to create the missing fields\n");
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${String(error instanceof Error ? error.message : error)}\n`);
    process.exitCode = 1;
  });
