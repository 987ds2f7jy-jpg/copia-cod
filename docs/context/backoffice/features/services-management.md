# Services Management

Status: implemented

Code reviewed: 2026-09-15

## Objective

Allow an authenticated backoffice administrator to view existing platform-controlled service prices, edit their gross price, and activate or deactivate a price rule without deleting it or changing patient/professional flows.

Route: `/admin/backoffice/services`.

## Domain context

`platform_service_prices` is the source of gross prices for services whose price source is `platform_fixed`. It does not contain prices chosen by an individual professional (`profile_standard` and `profile_priority` remain in `professional_profiles`).

Plantão already exists; no new service code was created. It is represented by four rows/codes in fee group `duty`:

- `on_duty_clinico_geral`;
- `on_duty_pediatria`;
- `on_duty_psicologia`;
- `on_duty_psiquiatria`.

Other current platform-controlled codes are `specialty_request` (one row per `specialty_code`) and the `extra_*` clinical services. The valid `service_code` and `fee_group` domains are database constraints created by `20260418090000_create_pricing_and_payment_base.sql`.

`platform_fee_rules` is related but outside this feature. The pricing resolver combines the selected gross price with an active fee rule to calculate platform fee and professional net amount. This screen does not edit fee percentages.

## Table fields used

The list returns only existing, non-sensitive fields:

| Field | Use |
|---|---|
| `id` | Identifier sent to the update RPC. |
| `service_code` | Stable service type used by `_shared/pricing`. Read-only. |
| `specialty_code` | Specialty discriminator for `specialty_request`; empty for the other current codes. Read-only. |
| `display_name` | Human-readable name. Read-only. |
| `fee_group` | `duty`, `specialty`, or `services`. Read-only. |
| `gross_price` | Editable gross BRL amount. |
| `currency` | Three-letter uppercase currency; current seeds use `BRL`. Read-only. |
| `active` | Editable logical activation flag. |
| `effective_from`, `effective_to` | Existing validity window shown for operational context. Read-only. |
| `created_at`, `updated_at` | Creation and latest-update timestamps. Read-only. |

Money is stored as `NUMERIC(12,2)` in **reais**, not integer cents. The UI formats it with `Intl.NumberFormat('pt-BR', { style: 'currency' })`, accepts a decimal comma or point with at most two decimal places, and sends a JSON number to the backend.

Database constraints already enforce non-negative price, uppercase three-character currency, valid service/fee-group domains, and a valid effective window. `updated_at` is maintained by the existing table trigger.

## Frontend

Files:

- `src/backoffice/pages/ServicesPage.tsx` — loading, error, empty, table, edit dialog, status switch, success/error feedback, and authorization-error handling;
- `src/backoffice/api/services.ts` — dedicated backoffice Function calls;
- `src/backoffice/types.ts` — response type;
- `src/backoffice/BackofficeRoutes.tsx` — `/admin/backoffice/services` child route;
- `src/backoffice/components/BackofficeSidebar.tsx` — `Serviços` menu item.

React Query key: `['backoffice', 'services']`. A successful update invalidates this query. Concurrent submits are disabled. Only `401`/`403` clear the isolated admin session; `400`, `404`, and `409` remain operation errors in the dialog.

## Edge Functions

Both Functions use `POST` because the dedicated backoffice API client and all current administrative Functions use JSON POST contracts. Both process `OPTIONS` first, use `BACKOFFICE_CORS`, validate the custom admin token with `requireActiveBackofficeAdmin`, and create `service_role` access only on the server.

### `backoffice-services-list`

Request:

```json
{}
```

No request fields are accepted. The Function lists `platform_service_prices` in stable order by `fee_group`, `display_name`, `specialty_code`, and newest `effective_from` first.

Success data:

```json
{
  "services": [
    {
      "id": "uuid",
      "service_code": "on_duty_clinico_geral",
      "specialty_code": "",
      "display_name": "Plantao - Clinico Geral",
      "fee_group": "duty",
      "gross_price": 100,
      "currency": "BRL",
      "active": true,
      "effective_from": "timestamp",
      "effective_to": null,
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

### `backoffice-services-update`

Request allowlist:

```json
{
  "servicePriceId": "uuid",
  "grossPrice": 120.50,
  "active": true
}
```

All three fields are required. Any additional field is rejected; the client cannot change `service_code`, `specialty_code`, `fee_group`, currency, metadata, validity dates, or timestamps.

Success data is `{ "service": <updated row> }` with the same fields as the list response.

## Validation rules

- `servicePriceId` must be a valid UUID and identify an existing row.
- `grossPrice` must be a finite JSON number from `0` through `9999999999.99`, with at most two decimal places.
- `active` must be a JSON boolean.
- An unchanged price/status pair returns `409 SERVICE_PRICE_NO_CHANGES`; no audit event is written.
- An unknown row returns `404 SERVICE_PRICE_NOT_FOUND`.
- Unsupported fields and invalid price/activation values return `400`.
- No row is created or deleted by this feature.

Zero is allowed because the existing column constraint allows it and the requested rule is non-negative. The existing pricing resolver independently requires an effective active gross price greater than zero; therefore an active zero-price row still produces `409 PLATFORM_PRICE_NOT_CONFIGURED` for new quotes.

## Update, activation, and pricing effects

`backoffice-services-update` calls `public.update_backoffice_service_price`. The RPC:

1. validates price/status again in PostgreSQL;
2. locks the row with `FOR UPDATE`;
3. rejects missing or unchanged rows;
4. updates only `gross_price` and `active`;
5. writes one audit event;
6. returns the updated row;
7. commits or rolls back the update and audit together.

The pricing resolver selects rows with `active = true`, `effective_from <= now`, a matching `service_code`/`specialty_code`, and a still-open `effective_to`; among them it uses the newest effective rule. Activating an expired/future or older rule does not override those existing selection rules. Deactivation is logical (`active = false`), never deletion.

New prices affect only later resolutions/quotes and operations created from them. Existing appointments, queues, exam requests, plan-backed operations, charges, and finance views use stored snapshots such as `gross_price`/`quoted_gross_price`, `platform_fee_amount`, `professional_net_amount`, `pricing_rule_id`, and `fee_rule_id`. This feature does not recalculate historical payments or modify snapshot logic.

## Audit

Table: `backoffice_audit_events`.

Entity type: `platform_service_prices`.

Actions:

- `service_price.updated` when only the price changes;
- `service_price.activated` when `active` changes to `true` (including a simultaneous price change);
- `service_price.deactivated` when `active` changes to `false` (including a simultaneous price change).

Metadata contains only the previous and current `gross_price` and `active` values. The admin ID, entity ID, action, and timestamp use the standard audit columns. Because insertion is in the same RPC transaction, a failed audit rolls back the price/status update.

## Security

- The browser never accesses `platform_service_prices` directly.
- A normal patient/professional Supabase token is not an admin token and is rejected.
- Missing, malformed, expired, or inactive-admin sessions are rejected before database access.
- `service_role` and the RPC are server-only; `anon` and `authenticated` have no direct table or RPC grants.
- `platform_service_prices` already has RLS and Force RLS through the project hardening migration.
- Both Function entries use `verify_jwt = false` in `supabase/config.toml` because the custom admin JWT is validated inside the Function.
- CORS preflight returns `204` before method, body, authentication, or database work.

## Files outside `src/backoffice/`

- `supabase/functions/backoffice-services-list/*` — authenticated minimal list endpoint.
- `supabase/functions/backoffice-services-update/*` — strict update validation and transactional RPC invocation.
- `supabase/migrations/20260915120000_create_backoffice_service_price_update_rpc.sql` — atomic allowlisted update plus audit; it does not alter the table schema.
- `supabase/config.toml` — manual-JWT configuration for both Functions.
- `src/test/backoffice-services-management.test.ts` — authorization, validation, activation, preflight, allowlist, and transaction/audit contract tests.
- `docs/context/backoffice/FEATURES.md` — feature index entry.
- `docs/context/backoffice/ARCHITECTURE.md` — corrected documentation paths to the repository's existing `docs/context` location.

No patient/professional component, normal API client, pricing resolver, payment, plan, appointment, queue, clinical-service, teleconsultation, or finance implementation was changed.

## Manual tests

Inspect the catalog before and after:

```sql
select *
from public.platform_service_prices
order by created_at desc;
```

1. Sign in as an active backoffice admin and open `/admin/backoffice/services`.
2. Confirm loading, error, empty, and populated states as applicable.
3. Edit one service price, save, and confirm only `gross_price` and `updated_at` changed.
4. Toggle the service inactive, save, and confirm `active = false` without row deletion.
5. Toggle it active again and confirm new eligible quotes use the configured value.
6. Repeat for each `on_duty_*` row needed to validate plantão pricing.
7. Confirm older appointments/queues/requests and their charges retain stored snapshot amounts.

Inspect audit records:

```sql
select *
from public.backoffice_audit_events
where entity_type = 'platform_service_prices'
order by created_at desc
limit 20;
```

Security/error cases:

- call both Functions without a token;
- call with a patient/professional token;
- call with an expired token and with an inactive admin;
- send an invalid or nonexistent UUID;
- send a negative value, more than two decimal places, and a value above `NUMERIC(12,2)` capacity;
- add an unsupported payload field such as `currency`;
- repeat an unchanged update and confirm `409` with no audit event;
- send `OPTIONS` and confirm `204` with backoffice CORS headers.

## Commands

Relevant commands for this feature:

```bash
npm run check:supabase-functions-config
npm test -- src/test/backoffice-services-management.test.ts
npm run build
npm run lint
git diff --check
```

The project has no `typecheck` script. Record any command that cannot run because dependencies are absent.

Execution status for this implementation:

- `npm run check:supabase-functions-config`: passed; 78 deployable Functions are configured.
- `git diff --check`: passed.
- `npm run build`: attempted, but `vite` is unavailable because `node_modules` is absent.
- `npm run lint`: attempted, but `eslint` is unavailable because `node_modules` is absent.
- `npm test -- src/test/backoffice-services-management.test.ts`: attempted, but `vitest` is unavailable because `node_modules` is absent.
- `npm run typecheck`: not run because no `typecheck` script exists in `package.json`.
- Database/browser manual tests: pending; no remote environment was changed by this implementation.

## Limitations and operational risks

- This UI edits existing rows only; it does not create a missing service or a new effective-dated version.
- Multiple active rows may exist for the same logical service. Runtime precedence remains the existing newest-effective rule; the screen exposes validity dates so the admin can identify the intended row.
- Editing a rule in place changes the current catalog row referenced by `pricing_rule_id`; historical numeric snapshots remain unchanged and continue to drive payments/finance.
- Fee percentages in `platform_fee_rules` are visible only through the resulting calculations elsewhere and are not managed here.
- Migration and Function deployment state must be verified per Supabase environment.
