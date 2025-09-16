# `/api/papers` Route – Agent Guide

## Responsibility
This App Router API route proxies Research Hub requests to the FastAPI backend. It enforces
input validation identical to the backend, forwards the payload, and normalizes error
responses so the client surfaces meaningful messages.

```
src/app/api/papers/route.ts
```

## Request Lifecycle
1. Parse the JSON body and ensure `topics` exists, is an array of ≤10 strings, and each value
   matches `^[a-zA-Z0-9.\-_]+$` with a ≤50 character limit. Keep this logic in sync with
   `backend/main.py::PaperRequest` + `sanitize_input`.
2. Forward the sanitized payload to `${BACKEND_URL}/api/papers`. `BACKEND_URL` defaults to
   `http://localhost:8000`; override via `.env.local` when the backend lives elsewhere.
3. On non-200 responses, attempt to parse `detail` from the backend error JSON and rethrow it
   with the same status code. This allows the Research Hub to display specific validation or
   rate-limit messages.
4. Catch network failures (`ECONNREFUSED`) and respond with HTTP 503 instructing developers to
   start the FastAPI server.
5. Handle preflight requests via the `OPTIONS` export. CORS defaults to `http://localhost:3000`
   but can be changed with `FRONTEND_URL` in the env.

## Implementation Guidelines
- The route currently runs in the default Node.js runtime. If you introduce Node-only APIs,
  add `export const runtime = "nodejs";` explicitly so Next.js does not attempt to execute it
  on the edge.
- Use `cache: 'no-store'` in the frontend fetch call instead of inside this route (the page
  already sets it). Avoid introducing shared module-level state; App Router may reuse module
  instances between requests.
- If you add new backend query parameters, expose them here explicitly (either in the body or
  query string) and update validation tests.

## Testing
- With the backend running: `curl -X POST http://localhost:3000/api/papers -H 'Content-Type:
  application/json' -d '{"topics":["cs.AI"]}'`.
- Simulate rate limiting or validation failures by sending too many topics; verify the status
  code and error message bubble up to the UI.
