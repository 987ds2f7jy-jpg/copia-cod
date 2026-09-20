# Pending Professional Registrations

Status: implemented

Code reviewed: 2026-09-15

## Objective

Allow an authenticated backoffice administrator to list private professional profiles awaiting review and approve or reject each registration atomically.

Route: `/admin/backoffice/pending-registrations`.

Main frontend files:

- `src/backoffice/pages/PendingProfessionalsPage.tsx`
- `src/backoffice/api/pendingProfessionals.ts`
- `src/backoffice/types.ts`

The page uses React Query key `['backoffice', 'pending-professionals']`, asks for up to 100 rows, confirms the action in a dialog, and invalidates the pending and public-professional caches after success.

## Read flow

Edge Function: `backoffice-pending-professionals`.

```text
POST { limit: 100 }
  → active admin validation
  → professional_profiles
  → status = 'pending'
  → created_date ASC
  → minimal administrative row list
```

`limit` defaults to 100 and the current validator accepts integers from 1 to 200. Returned fields are:

```text
id, full_name, profession, specialty, register_number,
register_state, phone, cpf, created_date, status
```

CPF and phone are personal data. Do not add them to URLs, browser analytics, toasts, or logs, and do not widen the select without an explicit administrative need.

## Review flow and contract

Edge Function: `backoffice-review-professional`.

Request:

```json
{
  "professionalProfileId": "uuid",
  "action": "approve | reject",
  "reason": "optional, at most 500 characters"
}
```

The UI currently sends the ID and action; it has no reason input. The ID must be `professional_profiles.id`. Do **not** send `app_users.id` or `professional_public_profiles.id`.

The Function validates the active admin and calls:

```text
public.review_backoffice_professional(
  p_professional_profile_id,
  p_admin_user_id,
  p_action,
  p_reason
)
```

The RPC locks the private row with `FOR UPDATE`, requires its current status to be `pending`, and applies:

| Action | `professional_profiles.status` | `professional_profiles.is_verified` |
|---|---|---|
| `approve` | `approved` | `true` |
| `reject` | `rejected` | `false` |

Both actions set `is_on_duty = false`.

## Public profile synchronization

The public projection is `professional_public_profiles`. It is joined by:

```text
professional_public_profiles.professional_profile_id
  = professional_profiles.id::text
```

The RPC updates the public projection only while its status is `pending_review`, setting it to `approved` or `rejected` and keeping it off duty. A projection already in another state is not overwritten. The relationship is not based on `app_users.id`, public-profile ID, email, or name.

## Transaction and audit

Tables involved:

- `professional_profiles` — source of the pending row and authoritative private review state;
- `professional_public_profiles` — synchronized public projection;
- `backoffice_audit_events` — successful administrative audit event.

The state changes and audit insertion occur inside the same RPC transaction. The event is written only if the whole operation applies and commits. It records the admin, action (`professional.approved` or `professional.rejected`), entity type/ID, and minimal transition metadata. The optional reason is capped at 500 characters and must not be included in technical logs.

Two concurrent reviews are serialized by the row lock. The first valid transition wins; a later review sees a non-pending profile and returns `409 PROFESSIONAL_PROFILE_NOT_PENDING`.

## Errors and diagnosis

| Code | Status | Meaning |
|---|---:|---|
| `PROFESSIONAL_PROFILE_NOT_FOUND` | 404 | No private profile exists for the supplied ID. |
| `PROFESSIONAL_PROFILE_NOT_PENDING` | 409 | The profile was already reviewed or is otherwise not pending. |
| `PROFESSIONAL_PROFILE_REVIEW_FAILED` | 500 | The RPC failed unexpectedly or returned no row. |

For `PROFESSIONAL_PROFILE_REVIEW_FAILED`, check server logs by `requestId`. Known/likely causes to verify are:

- the RPC migration was not applied, or the PostgREST schema cache was not reloaded;
- the request used the wrong ID or payload property;
- Function parameters and RPC parameters/signature diverged;
- `professional_public_profiles` rejected the target status;
- audit insertion or its foreign key/constraints rolled back the transaction;
- logs are from an old deployment or lack the correlated `requestId` details.

The original RPC had ambiguous unqualified output/column names. `20260903090000_fix_backoffice_professional_review_rpc.sql` fixes this with qualified aliases and sends `NOTIFY pgrst, 'reload schema'`. Both the creation and corrective migrations must be present in order.

## Files outside `src/backoffice/`

- `supabase/functions/backoffice-pending-professionals/*` — authenticated pending list.
- `supabase/functions/backoffice-review-professional/*` — validation, authorization, RPC invocation, and safe observability.
- `supabase/functions/_shared/backofficeAuth.ts` — active-admin validation.
- `supabase/functions/_shared/backofficeCors.ts` — preflight behavior.
- `supabase/migrations/20260902090000_create_backoffice_admin_users.sql` — audit table and initial RPC.
- `supabase/migrations/20260903090000_fix_backoffice_professional_review_rpc.sql` — qualified/working RPC definition.
- `supabase/config.toml` — both Function entries with manual JWT validation.
- `src/test/backoffice-professional-review.test.ts` — payload, auth, error mapping, ID, RPC, synchronization, audit, and atomicity contract checks.
- `docs/BACKOFFICE_CONTEXT.md` — earlier detailed context.

## Manual verification checklist

- [ ] `OPTIONS` for both Functions returns `204` without requiring a token.
- [ ] Missing/invalid admin token is rejected before list access or RPC execution.
- [ ] Only `professional_profiles.status = 'pending'` rows appear, oldest first.
- [ ] The request sends `professional_profiles.id`, never the app-user or public-profile ID.
- [ ] Approve produces private `approved / is_verified=true` and public `approved` when previously `pending_review`.
- [ ] Reject produces private `rejected / is_verified=false` and public `rejected` when previously `pending_review`.
- [ ] Both paths keep `is_on_duty=false` and create exactly one matching audit event.
- [ ] Re-review returns `409`, writes no second successful audit event, and does not clear the admin session.
- [ ] Unknown ID returns `404`; unexpected RPC failure returns a safe error with `requestId`.
- [ ] No password, token, hash, CPF, phone, or free-text reason appears in technical logs.

Relevant automated command:

```bash
npm test -- src/test/backoffice-professional-review.test.ts
```

## Pending verification

- Migration/deploy state and live PostgREST schema-cache state must be checked in each remote Supabase environment.
- End-to-end review against real data was not performed as part of this documentation-only task.
