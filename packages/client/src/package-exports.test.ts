import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Loads the BUILT package by its own name (Node's self-reference), so these
// read package.json `exports` the way a consumer does. Run after `pnpm build`.
const pkgDir = fileURLToPath(new URL("..", import.meta.url));

const run = (args: string[]) => execFileSync(process.execPath, args, { cwd: pkgDir, encoding: "utf8" }).trim();

const probe = `typeof m.CrmClient + " " + Object.keys(m.LEAD_STAGES).length`;

describe("package exports", () => {
  it("loads under require() from a CommonJS consumer, without Node's require(esm)", () => {
    // --no-experimental-require-module: what a Node 22 before 22.12 does, so a
    // `default` condition pointing at the ESM build does not pass this.
    const out = run([
      "--no-experimental-require-module",
      "--input-type=commonjs",
      "-e",
      `const m = require("@practicalworks/crm"); console.log(${probe})`,
    ]);
    expect(out).toMatch(/^function [1-9]\d*$/);
  });

  it("still loads under import from an ESM consumer", () => {
    const out = run(["--input-type=module", "-e", `const m = await import("@practicalworks/crm"); console.log(${probe})`]);
    expect(out).toMatch(/^function [1-9]\d*$/);
  });
});
