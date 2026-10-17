/**
 * seed.js — Populate the employees.records collection with sample data.
 *
 * Usage:
 *   node seed.js
 *
 * Requires config.env in the same directory with ATLAS_URI set.
 */

import { MongoClient, ServerApiVersion } from "mongodb";
import * as fs from "node:fs";

// Load config.env manually (same pattern as the app)
if (fs.existsSync(new URL("./config.env", import.meta.url))) {
  const env = fs.readFileSync(new URL("./config.env", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
}

const URI = process.env.ATLAS_URI;
if (!URI) {
  console.error("ATLAS_URI is not set. Create mern/server/config.env first.");
  process.exit(1);
}

const client = new MongoClient(URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  appName: "devrel-github-javascript-mern",
});

const records = [
  { name: "Alice Johnson",  position: "Software Engineer",       seniority: "Senior" },
  { name: "Bob Martinez",   position: "Product Manager",         seniority: "Intern" },
  { name: "Carol Lee",      position: "UX Designer",             seniority: "Junior" },
  { name: "David Kim",      position: "DevOps Engineer",         seniority: "Intern" },
  { name: "Eva Nguyen",     position: "Data Scientist",          seniority: "Senior" },
  { name: "Frank Chen",     position: "Frontend Developer",      seniority: "Junior" },
  { name: "Grace Patel",    position: "Backend Developer",       seniority: "Intern" },
  { name: "Henry Okafor",   position: "QA Engineer",             seniority: "Junior" },
  { name: "Iris Müller",    position: "Engineering Manager",     seniority: "Senior" },
  { name: "James Tanaka",   position: "Security Engineer",       seniority: "Intern" },
];

try {
  await client.connect();
  const collection = client.db("employees").collection("records");

  // Remove existing records to avoid duplicates on re-runs
  await collection.deleteMany({});
  const result = await collection.insertMany(records);
  console.log(`Inserted ${result.insertedCount} records into employees.records`);
} finally {
  await client.close();
}
