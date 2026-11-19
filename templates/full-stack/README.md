# {{projectName}}

Generated with the StellarForge `full-stack` template.

## Structure

```text
frontend/   Browser-facing application boundary and tests
backend/    Node.js API/runtime boundary and tests
contracts/  Soroban contract workspace boundary
```

The starter keeps these layers separate so application UI, server-side Stellar integration, and smart-contract code can evolve independently.

## Requirements

- Node.js 22.13 or newer

## Validate the starter

```bash
npm run check
npm test
```

These checks are dependency-free and do not require network access.

## Scripts

| Script                  | Purpose                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run check`         | Syntax-checks the frontend and backend entry points.                   |
| `npm test`              | Runs the frontend and backend test files with the Node.js test runner. |
| `npm run start:backend` | Starts the backend server.                                             |

The starter has no build step and no runtime dependencies; `frontend/src/app.js` is plain ES module code that a host page or bundler can import.

## Run the backend

```bash
npm run start:backend
```

The backend exposes `GET /health` on `127.0.0.1:3000` by default. Set `BACKEND_PORT` to override the port. This starter targets Stellar Testnet only; it does not configure or claim Mainnet or hosted deployment support.

## API Boundaries and Request Handling

The generated backend enforces deterministic, minimal HTTP boundaries without external framework overhead:

- **Method boundaries:** Routes enforce explicit allowed methods (`GET, HEAD` on `/health`, `POST` on `/api/echo`). Unsupported methods return a deterministic `405 Method Not Allowed` with an `Allow` header and `{ "error": "method_not_allowed" }`.
- **Unknown routes:** Requests to unmapped paths return a safe `404 Not Found` response (`{ "error": "not_found" }`) with no internal stack or environment reflection.
- **Request size bounds:** Incoming request bodies are constrained by `MAX_REQUEST_BODY_BYTES` (64 KiB default). Payloads exceeding this bound (either via `Content-Length` or chunked transfer streaming) are rejected immediately with `413 Payload Too Large` before unbounded memory buffering.
- **Content type & JSON validation:** JSON endpoints require `application/json` (returning `415 Unsupported Media Type` otherwise) and explicitly handle malformed JSON syntax with `400 Bad Request` (`{ "error": "malformed_json" }`).
- **Security headers:** Responses include baseline `X-Content-Type-Options: nosniff`.

## Environment

Copy `.env.example` into your preferred local environment-management flow. The example contains public Stellar Testnet endpoints only and no credentials.

Never commit wallet seeds, secret keys, signing credentials, production tokens, or private infrastructure credentials.

## Contracts

`contracts/` is intentionally a boundary rather than a fake production contract. Add reviewed Soroban code when the application domain is defined, or generate a dedicated StellarForge `smart-contract` starter for contract-focused work.
