// Contract tests for /record after renaming the `level` field to `seniority`.
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import {
  createRecord,
  deleteRecord,
  getRecord,
  insertStoredDocument,
  listRecords,
  updateRecord,
} from "./support/records.js";

const created = [];

async function create(body) {
  const res = await createRecord(body);
  assert.equal(res.status, 200);
  assert.ok(res.body.insertedId, "POST /record returns insertedId");
  created.push(res.body.insertedId);
  return res.body.insertedId;
}

async function storeLegacy(doc) {
  const id = await insertStoredDocument(doc);
  created.push(id);
  return id;
}

after(async () => {
  for (const id of created) await deleteRecord(id);
});

describe("POST /record", () => {
  test("R1a: stores and returns seniority with name and position", async () => {
    const id = await create({ name: "T-R1a", position: "Eng", seniority: "Senior" });
    const { status, body } = await getRecord(id);
    assert.equal(status, 200);
    assert.equal(body.seniority, "Senior");
    assert.equal(body.name, "T-R1a");
    assert.equal(body.position, "Eng");
  });

  test("R1b: created record has no level field", async () => {
    const id = await create({ name: "T-R1b", position: "P", seniority: "Junior" });
    const { body } = await getRecord(id);
    assert.ok(!("level" in body), `unexpected level key: ${JSON.stringify(body)}`);
  });

  test("R1c: legacy level field is not persisted under any name", async () => {
    const id = await create({ name: "T-R1c", position: "P", level: "Senior" });
    const { body } = await getRecord(id);
    assert.ok(!("level" in body), `unexpected level key: ${JSON.stringify(body)}`);
    assert.ok(body.seniority == null, `seniority should be absent or null, got ${body.seniority}`);
  });

  for (const v of ["Intern", "Junior", "Senior"]) {
    test(`R1d: seniority ${v} round-trips`, async () => {
      const id = await create({ name: `T-${v}`, position: "P", seniority: v });
      const { body } = await getRecord(id);
      assert.equal(body.seniority, v);
    });
  }
});

describe("GET /record", () => {
  test("R1e: created record is listed with seniority and no level", async () => {
    const id = await create({ name: "T-R1e", position: "P", seniority: "Intern" });
    const { status, body } = await listRecords();
    assert.equal(status, 200);
    const item = body.find((r) => r._id === id);
    assert.ok(item, "created record is in the list");
    assert.equal(item.seniority, "Intern");
    assert.ok(!("level" in item));
  });
});

describe("PATCH /record/:id", () => {
  test("R2a/R6a: updates seniority, name and position", async () => {
    const id = await create({ name: "A", position: "P", seniority: "Intern" });
    const res = await updateRecord(id, { name: "B2", position: "P2", seniority: "Senior" });
    assert.equal(res.status, 200);
    assert.equal(res.body.modifiedCount, 1);
    const { body } = await getRecord(id);
    assert.equal(body.seniority, "Senior");
    assert.equal(body.name, "B2");
    assert.equal(body.position, "P2");
  });

  test("R2b: second PATCH wins and no level appears", async () => {
    const id = await create({ name: "T-R2b", position: "P", seniority: "Intern" });
    await updateRecord(id, { name: "T-R2b", position: "P", seniority: "Junior" });
    await updateRecord(id, { name: "T-R2b", position: "P", seniority: "Senior" });
    const { body } = await getRecord(id);
    assert.equal(body.seniority, "Senior");
    assert.ok(!("level" in body));
  });

  test("R2c: legacy level field is not written", async () => {
    const id = await create({ name: "T-R2c", position: "P", seniority: "Junior" });
    await updateRecord(id, { name: "T-R2c", position: "P", level: "Senior" });
    const { body } = await getRecord(id);
    assert.ok(!("level" in body), `unexpected level key: ${JSON.stringify(body)}`);
  });

  test("R2d/legacy-record-patch-drops-level: PATCHing a pre-rename record leaves no level behind", async () => {
    const id = await storeLegacy({ name: "Legacy", position: "P", level: "Senior" });
    await updateRecord(id, { name: "Legacy", position: "P", seniority: "Junior" });
    const { body } = await getRecord(id);
    assert.equal(body.seniority, "Junior");
    assert.ok(!("level" in body), `stale level key remains: ${JSON.stringify(body)}`);
  });
});

describe("records stored before the rename", () => {
  test("R3a/legacy-record-get-exposes-seniority: GET /record/:id serves the value as seniority", async () => {
    const id = await storeLegacy({ name: "Legacy2", position: "P", level: "Senior" });
    const { body } = await getRecord(id);
    assert.equal(body.seniority, "Senior", `got ${JSON.stringify(body)}`);
    assert.ok(!("level" in body), `unexpected level key: ${JSON.stringify(body)}`);
  });

  test("R3b/legacy-record-in-list: GET /record exposes seniority for old and new records", async () => {
    const legacyId = await storeLegacy({ name: "Legacy3", position: "P", level: "Intern" });
    const newId = await create({ name: "T-R3b", position: "P", seniority: "Senior" });
    const { body } = await listRecords();
    const legacy = body.find((r) => r._id === legacyId);
    const fresh = body.find((r) => r._id === newId);
    assert.equal(fresh.seniority, "Senior");
    assert.ok(!("level" in fresh));
    assert.equal(legacy.seniority, "Intern", `got ${JSON.stringify(legacy)}`);
    assert.ok(!("level" in legacy), `unexpected level key: ${JSON.stringify(legacy)}`);
  });
});

describe("DELETE /record/:id", () => {
  test("R6b: deletes a record created with seniority", async () => {
    const res = await createRecord({ name: "T-R6b", position: "P", seniority: "Junior" });
    const id = res.body.insertedId;
    const del = await deleteRecord(id);
    assert.equal(del.status, 200);
    assert.equal(del.body.deletedCount, 1);
    const { body } = await listRecords();
    assert.ok(!body.some((r) => r._id === id));
  });
});
