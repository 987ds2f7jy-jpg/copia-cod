# Analytics Dashboard

Status: implemented

Code reviewed: 2026-09-15

## Objective

Show a small administrative summary of accumulated platform activity without exposing complete record lists.

Route: `/admin/backoffice/analytics`.

Main frontend files:

- `src/backoffice/pages/AnalyticsPage.tsx`
- `src/backoffice/api/analytics.ts`
- `src/backoffice/types.ts`

React Query key: `['backoffice', 'analytics-summary']`.

## Edge Function and flow

Edge Function: `backoffice-analytics-summary`.

```text
POST {}
  → active admin JWT validation
  → three exact head/count queries in parallel
  → aggregate-only response
```

Success data:

```json
{
  "totalProfessionals": 0,
  "totalUsers": 0,
  "totalCompletedConsultations": 0
}
```

The Function must require the dedicated admin token and use `service_role` only server-side. It returns counts only; do not return full users, profiles, consultations, or personal/clinical fields for this dashboard.

## Indicators and sources

| Indicator | Source and current definition |
|---|---|
| Registered doctors/professionals | Exact count of all rows in `professional_profiles`. Despite the UI label “Médicos cadastrados”, the query is not filtered by profession or approval status. |
| Registered users | Exact count of all rows in `app_users`. It is not filtered by role or active status. |
| Completed consultations | Exact count of `consultas` rows where `status = 'finalizada'`. |

`consultas.status = 'finalizada'` is confirmed by both the schema constraint and the repository query. Do not substitute `completed`, which belongs to other lifecycle domains in this project.

The current dashboard has no date range, timezone boundary, trend, chart, pagination, or export. Adding those changes the metric definitions and must be documented as a feature change.

## Errors and security

- `401`/`403`: missing, invalid, expired, or inactive admin identity; the admin session may be cleared.
- `500 BACKOFFICE_ANALYTICS_LOOKUP_FAILED`: one of the count queries failed; response remains generic and includes the shared `requestId` envelope.
- `OPTIONS` must return before JSON parsing and authentication.
- `supabase/config.toml` sets `verify_jwt = false` because the Function validates the custom admin JWT internally.

## Files outside `src/backoffice/`

- `supabase/functions/backoffice-analytics-summary/index.ts` — runtime entrypoint.
- `supabase/functions/backoffice-analytics-summary/handler.ts` — preflight, method, body, and response envelope.
- `supabase/functions/backoffice-analytics-summary/service.ts` — admin authorization.
- `supabase/functions/backoffice-analytics-summary/repository.ts` — aggregate queries.
- `supabase/functions/_shared/backofficeAuth.ts` — active-admin validation.
- `supabase/functions/_shared/backofficeCors.ts` — preflight/CORS behavior.
- `supabase/config.toml` — Function gateway entry.
- `supabase/migrations/20260402234507_2d7911fb-58b4-4d42-a16e-0bab7c08608e.sql` — source table/status schema used to confirm `finalizada`.
- `docs/BACKOFFICE_CONTEXT.md` — earlier detailed context.

## Manual verification checklist

- [ ] `OPTIONS` returns `204` with CORS headers and without authentication.
- [ ] Missing, invalid, expired, and inactive-admin tokens cannot read the metrics.
- [ ] The response contains only the three numeric aggregate properties.
- [ ] Each displayed total matches an independent SQL count using the definitions above.
- [ ] Consultations count only `status = 'finalizada'`.
- [ ] No record list or personal/clinical field appears in the response or logs.
- [ ] A database failure returns a safe error with a correlatable `requestId`.

## Pending verification

- Remote deployment/configuration and the counts shown by live environment data cannot be confirmed from the repository.
- No dedicated analytics automated test was found in the reviewed code; add contract coverage when this feature changes.
