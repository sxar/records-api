// Integration test for seed.js. Seeding wipes employees.records first.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { listRecords } from "./support/records.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("R4a: seeded records are served with seniority and no level", async () => {
  execFileSync(process.execPath, ["seed.js"], { cwd: repoRoot, stdio: "pipe" });

  const { status, body } = await listRecords();
  assert.equal(status, 200);
  assert.equal(body.length, 10);

  const byName = Object.fromEntries(body.map((r) => [r.name, r]));
  assert.equal(byName["Alice Johnson"].position, "Software Engineer");
  assert.equal(byName["Alice Johnson"].seniority, "Senior");
  assert.equal(byName["Bob Martinez"].seniority, "Intern");
  assert.equal(byName["Carol Lee"].seniority, "Junior");
  for (const r of body) {
    assert.ok(["Intern", "Junior", "Senior"].includes(r.seniority), `${r.name}: ${r.seniority}`);
    assert.ok(!("level" in r), `${r.name} has level`);
  }
});
