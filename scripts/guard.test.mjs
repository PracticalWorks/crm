import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { brandCandidates, loadBrandHashes, scanText } from "./guard.mjs";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
// A fictional brand stands in for the real list, which is hashes only.
const FAKE = new Set([sha256("acme widget works"), sha256("acmewidgets com"), sha256("phone:5550101234")]);

test("a brand name is found in any casing and punctuation", () => {
  assert.equal(scanText("a.md", "Built for ACME Widget-Works, Inc.", FAKE).length, 1);
});

test("a brand domain is found", () => {
  assert.match(scanText("a.ts", 'const url = "https://acmewidgets.com/leads";', FAKE)[0], /brand data/);
});

test("a brand phone is found however it is written", () => {
  for (const p of ["+1 (555) 010-1234", "555.010.1234", "15550101234"]) {
    assert.equal(scanText("a.md", `call ${p}`, FAKE).length, 1, p);
  }
});

test("a finding names a hash prefix, never the brand text", () => {
  const [hit] = scanText("a.md", "acme widget works", FAKE);
  assert.doesNotMatch(hit, /acme/i);
});

test("ordinary text is clean", () => {
  assert.deepEqual(scanText("a.md", "The client reads companies, people and opportunities.", FAKE), []);
});

test("a run longer than the name still matches inside it", () => {
  assert.ok(brandCandidates("we work with acme widget works daily").has("acme widget works"));
});

test("the shipped hash list is well formed and non-empty", () => {
  assert.ok(loadBrandHashes().size > 0);
});
