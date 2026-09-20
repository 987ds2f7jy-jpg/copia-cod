# Backoffice Architecture

Status: current architecture rules

Code reviewed: 2026-09-15

## Purpose and boundaries

The backoffice is an isolated administrative area for internal system operations. New administrative frontend code must live in `src/backoffice/`; do not mix it with public, patient, or professional screens, sessions, API clients, or business flows.

Changes outside `src/backoffice/` must be minimal and justified. Acceptable external touchpoints are:

- route registration, currently the lazy `/admin/*` mount in `src/App.tsx`;
- dedicated administrative Supabase Edge Functions and shared backoffice helpers;
- migrations for required tables, RPCs, constraints, RLS, and audit records;
- `supabase/config.toml` entries and required server-side secrets;
- tests and documentation.

Do not use `app_users.role = 'admin'` for this module. Administrative identity belongs to `admin_users` and must remain separate from the normal patient/professional identity.

## Expected architecture

```text
React backoffice (`src/backoffice/`)
  → dedicated backoffice API client
  → administrative Supabase Edge Function
  → `requireActiveBackofficeAdmin` in `_shared/backofficeAuth.ts`
  → service_role / transactional RPC / PostgreSQL
```

`ProtectedBackofficeRoute` is a user-experience guard. The security boundary is the Edge Function, which must authenticate and authorize every request before reading sensitive data or applying an action.

## Frontend and session rules

- Keep pages, layout, hooks, types, and API wrappers under `src/backoffice/`.
- Use `src/backoffice/api/client.ts`; do not reuse the normal Supabase session client for administrative calls.
- Store the administrative session only in `rd.backoffice.session.v1`.
- Never mix the admin token with the normal application session or send it to non-backoffice Functions.
- Admin logout removes only `rd.backoffice.session.v1`; it must not sign out or mutate the patient/professional session.
- Protected routes redirect an absent or expired admin session to `/admin/login`.
- A `401` or `403` from an authenticated admin operation may clear the admin session and redirect to login.
- Business errors such as `409` must preserve the session and be handled as operation conflicts.

The admin JWT is a dedicated HS256 token signed with `ADMIN_JWT_SECRET`. Its lifetime is controlled by `ADMIN_SESSION_TTL_SECONDS` (current helper default: eight hours; accepted range: 300 to 86,400 seconds). Every authenticated administrative Function must validate the token and then verify that the referenced `admin_users` row still exists, has the same normalized email, and has `is_active = true`.

## Edge Function rules

Every sensitive administrative read or write must go through a dedicated Edge Function. The browser must not directly update administrative tables or privileged business data.

Each Function must:

1. handle `OPTIONS` before method validation, body parsing, authentication, or database access;
2. validate the HTTP method explicitly;
3. validate and normalize its payload;
4. authenticate with the central helper `requireActiveBackofficeAdmin` (or its future central replacement);
5. create `service_role` clients only in server-side Function code;
6. expose a minimal response contract;
7. return safe public errors and keep technical details in server logs.

Never expose a stack trace, secret, raw database error, token, password, or `password_hash` to the frontend. Technical logs may contain a `requestId`, operation/stage, non-sensitive identifiers, and the raw error needed for diagnosis. They must never contain passwords, tokens, `password_hash`, or unbounded free text that may contain personal or clinical data.

## Database, transactions, and RLS

- Administrative tables must enable RLS and use `FORCE ROW LEVEL SECURITY` when applicable.
- Revoke browser roles (`anon` and `authenticated`) when a table is service-only.
- Never select or return `admin_users.password_hash` outside the login verification path.
- Critical multi-table operations must be atomic. Use an RPC when row locking, state validation, related updates, and audit insertion must commit or roll back together.
- Do not replace a transactional review RPC with independent browser or Function updates.
- Define ownership, allowed state transitions, concurrency behavior, and least-privilege grants in the migration.

## Audit rules

Relevant administrative actions must append an event to `backoffice_audit_events`. Insert the event in the same transaction as the action whenever atomicity matters.

Audit only after the action is valid and as part of the operation that is actually applied. Record:

- the acting `admin_user_id`;
- action name;
- entity type and entity ID;
- minimal, non-sensitive metadata needed to understand the transition.

Do not audit rejected/no-op attempts as successful actions, and do not store passwords, tokens, hashes, clinical content, or unnecessary personal data in metadata.

## CORS and Supabase configuration

Every backoffice Function must have a matching entry in `supabase/config.toml`. This project manually validates its dedicated admin JWT, so the current five Functions use `verify_jwt = false`; the Supabase gateway cannot validate that custom token. Disabling gateway validation never replaces `requireActiveBackofficeAdmin` inside authenticated Functions.

Use `BACKOFFICE_CORS` and call `handleBackofficePreflight(req)` first. Expected preflight behavior is:

```text
OPTIONS /functions/v1/backoffice-*
→ 204
→ no authentication or body read
→ Access-Control-Allow-* headers present
```

An `OPTIONS 403` normally points to CORS/gateway configuration, an old deployment, an incorrect Function URL/project, or preflight code running after JWT/method validation. Diagnose those layers before changing business authorization.

## HTTP and error contract

Use the shared success/error envelopes and include `requestId` in internal failures and useful server logs. The expected status convention for new or revised contracts is:

- `400`: invalid JSON or payload;
- `401` / `403`: missing, invalid, expired, inactive, or unauthorized administrative identity;
- `404`: resource does not exist;
- `409`: invalid current state or business conflict;
- `500`: unexpected/internal failure.

Current backoffice validators also use `422` for some field-level validation errors. Preserve documented clients deliberately if changing an existing contract; new work should follow the convention above unless an explicit API decision documents an exception.

## Documentation Update Rule

Every new feature or relevant backoffice change must:

1. update `docs/context/backoffice/FEATURES.md` with a short summary;
2. create or update `docs/context/backoffice/features/<feature-name>.md`;
3. document routes, Edge Functions, tables, RPCs, permissions, payloads, and end-to-end flows;
4. list every file touched outside `src/backoffice/` and justify the touchpoint;
5. document manual tests and commands executed, including failures or checks not run;
6. keep the documentation concise and optimized for quick context recovery.

When code and documentation disagree, verify the deployed/runtime state before changing behavior. Mark anything that cannot be established from the repository as `Pending verification`.
