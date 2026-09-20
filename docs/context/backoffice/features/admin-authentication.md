# Admin Authentication

Status: implemented

Code reviewed: 2026-09-15

## Objective

Authenticate internal administrators independently of the public application. This feature does **not** use `app_users.role = 'admin'`, a Supabase Auth user session, or the patient/professional session.

## Routes and frontend

| Route | Behavior |
|---|---|
| `/admin/login` | Shows the dedicated login form; an existing session redirects to pending registrations. |
| `/admin/backoffice` | Protected shell; redirects to `pending-registrations`. |
| `/admin/backoffice/*` | Protected child routes; an absent/expired session redirects to `/admin/login`. |

Main frontend files:

- `src/backoffice/pages/BackofficeLoginPage.tsx`
- `src/backoffice/hooks/useBackofficeAuth.tsx`
- `src/backoffice/components/ProtectedBackofficeRoute.tsx`
- `src/backoffice/components/BackofficeLayout.tsx`
- `src/backoffice/api/auth.ts`
- `src/backoffice/api/client.ts`
- `src/backoffice/api/session.ts`
- `src/backoffice/BackofficeRoutes.tsx`

`src/App.tsx` is the only public router touchpoint: it lazy-loads the module at `/admin/*`. The backoffice renders its own layout.

## End-to-end flow

```text
email + password
  → POST backoffice-login
  → service_role reads admin_users
  → PBKDF2 password verification
  → custom HS256 admin JWT
  → localStorage rd.backoffice.session.v1
  → POST backoffice-me on reload
  → JWT verification + admin_users.is_active check
```

Logout only removes `rd.backoffice.session.v1`. There is no administrative refresh token; expiry requires a new login.

## Edge Functions and contracts

### `backoffice-login`

- Auth: none.
- Method: `POST`.
- Request: `{ "email": "admin@example.com", "password": "..." }`.
- Success data: `{ admin: { id, email }, session: { accessToken, expiresAt } }`.
- Invalid, inactive, or unknown accounts all return `401 ADMIN_LOGIN_INVALID` to avoid account enumeration.

### `backoffice-me`

- Auth: `Authorization: Bearer <admin-token>`.
- Method: `POST` with `{}`.
- Success data: `{ admin: { id, email } }`.
- Calls `requireActiveBackofficeAdmin`, which validates signature, issuer, expiry, ID, normalized email, and `is_active = true`.

Both Functions process `OPTIONS` first through `_shared/backofficeCors.ts`. Both use a server-only `service_role` client.

## Identity, table, session, and secrets

Table: `public.admin_users`.

Relevant columns are `id`, normalized unique `email`, `password_hash`, `is_active`, `created_at`, and `updated_at`. The table has RLS and Force RLS, browser-role access is revoked, and `password_hash` must never be returned to the browser or written to logs.

Session key: `rd.backoffice.session.v1`.

Stored fields are `accessToken`, `expiresAt`, and minimal admin data (`id`, `email`). The token is a custom HS256 JWT with issuer `rapido-doutor-backoffice`, signed with `ADMIN_JWT_SECRET`. `ADMIN_SESSION_TTL_SECONDS` configures the TTL; the current helper accepts 300–86,400 seconds and defaults to 28,800 seconds.

## Creating the first administrator

1. Apply `supabase/migrations/20260902090000_create_backoffice_admin_users.sql`.
2. Set `ADMIN_JWT_SECRET` and, optionally, `ADMIN_SESSION_TTL_SECONDS` as Supabase Function secrets. Never use `VITE_*` for them.
3. Run the masked interactive generator:

   ```bash
   node scripts/generate-backoffice-password-hash.mjs
   ```

4. Insert the normalized email and generated hash through a privileged SQL channel:

   ```sql
   insert into public.admin_users (email, password_hash, is_active)
   values (
     lower(trim('admin@example.com')),
     'PBKDF2$SHA-256$310000$<salt>$<hash>',
     true
   );
   ```

Never place the password or real hash in migrations, source control, `.env`, tickets, logs, or browser code.

## Security and failure handling

- Never accept a normal application access token as an admin token.
- Every authenticated administrative Function must re-check `admin_users.is_active`.
- A `401`/`403` may clear only the admin session. A business error such as `409` must not log the user out.
- The current provider clears the admin session if startup validation via `backoffice-me` fails; feature pages must deliberately handle authorization failures.
- Do not expose raw database errors, stack traces, passwords, tokens, secrets, or hashes.
- `supabase/config.toml` uses `verify_jwt = false` for these custom-JWT Functions; internal validation remains mandatory.

### `OPTIONS 403`, CORS, and `verify_jwt`

Expected preflight is `204` before method, body, auth, or database work. If the browser receives `OPTIONS 403`, check that the current Function version was deployed to the intended project, the URL is correct, the gateway is not trying to validate the custom token, and preflight is the first handler action. Do not authenticate the preflight request.

## Files outside `src/backoffice/`

- `src/App.tsx` — mounts the isolated route tree.
- `supabase/functions/_shared/backofficeAuth.ts` — JWT and password verification plus active-admin guard.
- `supabase/functions/_shared/backofficeCors.ts` — dedicated preflight/CORS behavior.
- `supabase/functions/backoffice-login/*` — login boundary.
- `supabase/functions/backoffice-me/index.ts` — session validation boundary.
- `supabase/migrations/20260902090000_create_backoffice_admin_users.sql` — admin identity, RLS, audit table, and initial review RPC.
- `supabase/config.toml` — Function gateway configuration.
- `scripts/generate-backoffice-password-hash.mjs` — masked PBKDF2 hash generator.
- `docs/BACKOFFICE_SETUP.md` and `docs/BACKOFFICE_CONTEXT.md` — earlier operational/context documentation.

## Manual verification checklist

- [ ] `OPTIONS` for both Functions returns `204` with the expected CORS headers.
- [ ] Unknown email, inactive admin, and wrong password return the same generic `401` response.
- [ ] Successful login stores only `rd.backoffice.session.v1` and opens the protected shell.
- [ ] Reload calls `backoffice-me` and retains a valid session.
- [ ] Expired, malformed, or deactivated-admin tokens redirect to `/admin/login`.
- [ ] Logout removes only the admin session and leaves the normal app session unchanged.
- [ ] Responses and logs contain no password, token, secret, or `password_hash`.

## Pending verification

- Whether both migrations and the current Function versions are applied in each remote environment cannot be proven from this repository.
- Secret presence/value, deployed gateway settings, and a real first-admin login require environment-level verification.
