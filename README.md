# mern-records-backend

Express + MongoDB REST API, adapted from MongoDB's official
[mern-stack-example](https://github.com/mongodb-developer/mern-stack-example)
(Apache-2.0). Part of a two-repo test rig (`mern-records-backend` /
`mern-records-frontend`) used to validate that a REST-API-over-MongoDB
Node.js service runs correctly on an arm64 (Apple Silicon / VMware Fusion)
self-hosted GitHub Actions runner. Not a product — a validation harness.

This repo has no CI workflow and no self-hosted runner of its own — by
design, not oversight. arm64 validation for this repo was done via a
one-off manual check (SSH onto the runner VM, not repeatable CI); only
`mern-records-frontend` has a runner/workflow.

## Endpoints

- `GET /record` — list all records
- `GET /record/:id` — get one record
- `POST /record` — create a record (`{ name, position, level }`)
- `PATCH /record/:id` — update a record
- `DELETE /record/:id` — delete a record

## Local run

```bash
docker compose up -d       # starts MongoDB on localhost:27017
cp config.env.example config.env
npm ci
npm start                  # listens on localhost:5050
```

## License

Apache-2.0, inherited from the source project. See [LICENSE](LICENSE).
