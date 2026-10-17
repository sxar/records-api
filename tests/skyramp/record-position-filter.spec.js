import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

// GET /record?position=<text> — sxar/records-api#1.
// Requests go through the running API; the collection is reset with seed.js first.

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const ENGINEER_NAMES = [
  "Alice Johnson",
  "David Kim",
  "Henry Okafor",
  "Iris Müller",
  "James Tanaka",
];
const SEEDED_NAMES = [
  ...ENGINEER_NAMES,
  "Bob Martinez",
  "Carol Lee",
  "Eva Nguyen",
  "Frank Chen",
  "Grace Patel",
];

async function getList(request, path = "/record") {
  const res = await request.get(path);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  return body;
}

const ids = (records) => records.map((r) => r._id).sort();

function containing(records, text) {
  return records.filter((r) =>
    String(r.position ?? "").toLowerCase().includes(text.toLowerCase()),
  );
}

async function createRecord(request, data) {
  const res = await request.post("/record", { data });
  expect(res.ok()).toBe(true);
  return (await res.json()).insertedId;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  execFileSync("node", ["seed.js"], {
    cwd: repoRoot,
    env: { ATLAS_URI: "mongodb://localhost:27017/", ...process.env },
  });
});

test.describe("GET /record?position= filters by position", () => {
  test("R1a substring match returns exactly the records containing 'Engineer'", async ({ request }) => {
    const all = await getList(request);
    const filtered = await getList(request, "/record?position=Engineer");
    for (const r of filtered) expect(r.position.toLowerCase()).toContain("engineer");
    expect(ids(filtered)).toEqual(ids(containing(all, "engineer")));
    expect(filtered.map((r) => r.name).sort()).toEqual([...ENGINEER_NAMES].sort());
  });

  test("R1b lower, upper and mixed case return the same set", async ({ request }) => {
    const reference = ids(await getList(request, "/record?position=Engineer"));
    for (const q of ["engineer", "ENGINEER", "eNgInEeR"]) {
      expect(ids(await getList(request, `/record?position=${q}`)), q).toEqual(reference);
    }
  });

  test("R1c matches anywhere in the position", async ({ request }) => {
    const all = await getList(request);
    const dev = await getList(request, "/record?position=dev");
    expect(ids(dev)).toEqual(ids(containing(all, "dev")));
    expect(dev.map((r) => r.position).sort()).toEqual(
      ["Backend Developer", "DevOps Engineer", "Frontend Developer"],
    );
    const ager = await getList(request, "/record?position=ager");
    expect(ids(ager)).toEqual(ids(containing(all, "ager")));
    expect(ager.map((r) => r.position).sort()).toEqual(
      ["Engineering Manager", "Product Manager"],
    );
  });

  test("R1d no match returns an empty list", async ({ request }) => {
    expect(await getList(request, "/record?position=zzzznomatch")).toEqual([]);
  });

  test("R1e '.' and '.*' are matched literally", async ({ request }) => {
    expect(await getList(request, "/record?position=.")).toEqual([]);
    expect(await getList(request, "/record?position=.*")).toEqual([]);
  });

  test("R1e unbalanced regex metacharacters do not error", async ({ request }) => {
    const all = await getList(request);
    for (const q of ["(", "[", "\\", "+"]) {
      const res = await request.get(`/record?position=${encodeURIComponent(q)}`);
      expect(res.status(), q).toBe(200);
      expect(ids(await res.json()), q).toEqual(ids(containing(all, q)));
    }
  });

  test("R1e a position with metacharacters is found by its literal text", async ({ request }) => {
    const id = await createRecord(request, { name: "Meta", position: "C++ Dev (L2)", level: "Junior" });
    try {
      for (const q of ["c%2B%2B", "(L2)", "(l2)"]) {
        const found = await getList(request, `/record?position=${q}`);
        expect(found.map((r) => r._id), q).toContain(id);
      }
    } finally {
      await request.delete(`/record/${id}`);
    }
  });

  test("R1f multi-word text with a space", async ({ request }) => {
    const found = await getList(request, "/record?position=software%20engineer");
    expect(found.map((r) => r.name)).toEqual(["Alice Johnson"]);
  });

  test("R1h non-ASCII text is matched case-insensitively", async ({ request }) => {
    const id = await createRecord(request, { name: "U", position: "Ärztin", level: "Junior" });
    try {
      for (const q of ["%C3%A4rztin", encodeURIComponent("ÄRZTIN")]) {
        const found = await getList(request, `/record?position=${q}`);
        expect(found.map((r) => r._id), q).toContain(id);
      }
    } finally {
      await request.delete(`/record/${id}`);
    }
  });
});

test.describe("GET /record without a usable position returns all records", () => {
  test("R2a no query returns every record", async ({ request }) => {
    const all = await getList(request);
    expect(all).toHaveLength(SEEDED_NAMES.length);
    expect(all.map((r) => r.name).sort()).toEqual([...SEEDED_NAMES].sort());
  });

  for (const [caseId, query] of [
    ["R2b empty value", "?position="],
    ["R2c whitespace-only value", "?position=%20%20"],
    ["R2d unrelated parameter", "?foo=bar"],
  ]) {
    test(`${caseId} returns the full list`, async ({ request }) => {
      const all = await getList(request);
      expect(ids(await getList(request, `/record${query}`))).toEqual(ids(all));
    });
  }
});

test.describe("odd position values", () => {
  test("R3a operator-shaped values are not treated as Mongo operators", async ({ request }) => {
    const all = await getList(request);
    for (const query of ["position%5B%24ne%5D=x", "position[$regex]=.*"]) {
      const res = await request.get(`/record?${query}`);
      expect(res.status(), query).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body), query).toBe(true);
      // Either the parameter is ignored (full list) or matched as literal text (nothing in seed).
      const got = ids(body);
      expect([ids(all), []], query).toContainEqual(got);
    }
  });

  test("R3b repeated parameter does not error", async ({ request }) => {
    const res = await request.get("/record?position=Engineer&position=Manager");
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("R3c a 5000-character value does not 5xx", async ({ request }) => {
    const res = await request.get(`/record?position=${"a".repeat(5000)}`);
    expect(res.status()).toBeLessThan(500);
    if (res.status() === 200) expect(await res.json()).toEqual([]);
  });
});

test("R4a GET /record/:id still returns one record", async ({ request }) => {
  const [qa] = await getList(request, "/record?position=QA");
  const res = await request.get(`/record/${qa._id}`);
  expect(res.status()).toBe(200);
  const record = await res.json();
  expect(record._id).toBe(qa._id);
  expect(record.name).toBe("Henry Okafor");
});

test.describe("filter after writes", () => {
  test("R1g a created record is filtered, and an updated position is reflected", async ({ request }) => {
    const id = await createRecord(request, { name: "Zed", position: "Zebra Keeper", level: "Junior" });
    try {
      expect((await getList(request, "/record?position=zebra")).map((r) => r._id)).toContain(id);

      const patch = await request.patch(`/record/${id}`, {
        data: { name: "Zed", position: "Lion Tamer", level: "Junior" },
      });
      expect(patch.ok()).toBe(true);
      expect((await getList(request, "/record?position=zebra")).map((r) => r._id)).not.toContain(id);
      expect((await getList(request, "/record?position=lion")).map((r) => r._id)).toContain(id);
    } finally {
      await request.delete(`/record/${id}`);
    }
    expect((await getList(request, "/record?position=lion")).map((r) => r._id)).not.toContain(id);
  });

  test("R2e a record without a position is listed unfiltered and excluded when filtering", async ({ request }) => {
    const id = await createRecord(request, { name: "NoPos", level: "Junior" });
    try {
      expect((await getList(request)).map((r) => r._id)).toContain(id);
      expect((await getList(request, "/record?position=engineer")).map((r) => r._id)).not.toContain(id);
    } finally {
      await request.delete(`/record/${id}`);
    }
  });
});
