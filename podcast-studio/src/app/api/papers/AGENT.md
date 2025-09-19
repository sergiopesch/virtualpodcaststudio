# `/api/papers` Route – Agent Guide

## Responsibility
`src/app/api/papers/route.ts` is a Node runtime handler that proxies Research Hub requests to the
FastAPI backend. It mirrors backend validation, forwards the payload, and normalises error
responses so the UI can display clear messaging.

## Request Lifecycle
1. Parse the JSON body from `NextRequest` and ensure `topics` exists, is an array with 1–10 string
   entries, each ≤50 characters and matching `^[a-zA-Z0-9.\-_]+$`.
2. Forward the payload to `${BACKEND_URL}/api/papers` (defaults to
   `http://localhost:8000/api/papers`). No caching headers are set here because the client request
   already uses `cache: "no-store"`.
3. On non-200 responses, attempt to parse `{detail}` from the backend JSON and rethrow it as
   `{ error }` with the original status so the Research Hub can surface validation or rate-limit
   messages.
4. Catch connection failures (e.g., `ECONNREFUSED`) and return HTTP 503 instructing developers to
   start the FastAPI server.
5. Respond to preflight requests via the exported `OPTIONS` handler, honouring `FRONTEND_URL`
   (defaults to `http://localhost:3000`).

## Implementation Notes
- The route implicitly runs on the Node.js runtime—avoid importing client modules or using
  edge-only APIs. If you introduce Node-specific APIs, you can add `export const runtime = "nodejs";`
  explicitly.
- Keep validation in sync with `backend/main.py::PaperRequest` and `sanitize_input`. Update both
  sides when new constraints or fields are introduced.
- Avoid storing module-level state. App Router may reuse the module across requests, so rely on
  per-request variables.

## Testing
- With the backend running: `curl -X POST http://localhost:3000/api/papers -H 'Content-Type: application/json' -d '{"topics":["cs.AI"]}'`.
- Simulate validation failures (e.g., too many topics) and verify the Research Hub displays the
  returned error message.
- Stop the backend to confirm the handler responds with HTTP 503 and helpful guidance.
