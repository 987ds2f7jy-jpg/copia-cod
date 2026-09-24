# Internal Plans module

## Baseline

The authoritative behavioral source for Phase 1 is the remote repository
`987ds2f7jy-jpg/plans-service`, branch `main`, commit
`4d833e35765a9849acf792ee24b4cc36c9d159ba`.

An earlier analysis used a stale local checkout. It is not authoritative and must not be used for implementation decisions.
The consumer reference is remote `987ds2f7jy-jpg/copia-cod`, branch `main`, commit
`d7a173a280814af659b58d168c30e401eaaa9295`.

Phase 1 created the internal implementation. Phase 2A makes it authoritative for all active Plans behavior. The old
external client remains present only for review/rollback cleanup and is not part of the active runtime path.

## Purpose and bounded context

Plans owns entitlements: plan definitions, subscriptions, consumable subscription scores, family membership,
score refresh/expiration, and plan-derived external access. It does not own checkout, commercial prices,
payment provider identities, webhooks, refunds, chargebacks, or payment reconciliation.

The integration/saga boundary converts a confirmed `payment_charge` into a Plans activation.

Existing orchestration remains distinct:

- `plan_subscription_orders`: purchase/payment/provisioning orchestration.
- `plan_credit_usages`: reservation, audit, and owner-specific consumption lifecycle.
- `plan_subscriptions`: the actual internal entitlement.
- `plan_subscription_scores`: the actual consumable credits.

No legacy `payments`, `PaymentService`, or `payment_webhook_events` copy was introduced.

## Architecture

The module consists of:

- provider-neutral contracts under `supabase/functions/_shared/plans/contracts`;
- pure status, catalog, specialization, and allocation rules under `domain`;
- `InternalPlansProvider` and explicit services under `internal`;
- Postgres RPCs for transaction and locking boundaries;
- `internal_plans_jobs` plus `internal-plans-worker` for durable background execution;
- the central `PlansFacade`, which always selects `InternalPlansProvider` in Phase 2A;
- migrated activation, coverage, reservation, consumption, listing, and reconciliation callers.

Critical issuance is explicit in `activate_internal_plan_subscription`; it does not depend on a hidden observer.

## Entities and relationships

| Table | Responsibility |
|---|---|
| `plan_catalog` | Internal plan entitlement definitions and legacy IDs |
| `plan_specialization_compatibility` | Legacy specialization to local-code compatibility, not a second professional catalog |
| `plan_scores` | Score definition for a compatible specialization |
| `plan_subscriptions` | Active/pending/inactive/cancelled entitlement linked to order and charge |
| `plan_subscription_scores` | Consumable credits with grant period, source, and allocation sequence |
| `plan_subscription_members` | Family members; holder remains on the subscription |
| `plan_external_access_services` | Known external capabilities |
| `plan_user_external_accesses` | Idempotent service/user access state |
| `plan_activations` | One activation identity per `payment_charge.id` |
| `internal_plans_jobs` | Durable claims, retries, results, and terminal failures |

`plan_subscription_orders` gains `plans_backend` and `internal_plans_subscription_id`.
`plan_credit_usages` gains `plans_backend` and `internal_subscription_score_id`.
Existing rows default to `external`. New Phase 2A activation and reservations explicitly persist `internal`; runtime
selection does not branch on affinity in this phase.

## Status enums

- Plan: `1 active`, `2 inactive`.
- Subscription: `1 active`, `2 inactive`, `3 cancelled`, `4 pending`.
- SubscriptionScore: `1 enable`, `2 used`, `3 disable`.
- UserExternalAccess: `1 active`, `2 blocked`.

Provider responses add normalized labels while retaining `rawStatus`.

## Plan rules

### Psychology

`Plano de psicologia`, legacy plan ID `1`. Activation grants four scores for legacy specialization `22`,
`Psicologia`, `concil_type=psicologo`. If the specialization/score definition is unavailable, activation succeeds
without scores.

### Weight loss

`Plano de emagrecimento`, legacy plan ID `2`. Activation grants each available score from:

- `2` — `Clinica Medica` / `medico`;
- `23` — `Nutricao` / `nutricionista`;
- `24` — `Educacao Fisica` / `educador_fisico`.

Missing individual definitions are omitted. The subscription state synchronizes only `app_nutricao`:
active means access status `1`; any non-active state means blocked status `2`. No behavior is added for
`app_educacao_fisica`.

### Family

`Plano familiar`, legacy plan ID `3`. It grants one shared `Clinica Medica` score. A family contains the holder
and at most three additional members. The holder cannot be added, duplicate membership in one subscription is
rejected, and membership requires an active family subscription. Members and holder consume the same score pool.

## Activation and idempotency

`activate_internal_plan_subscription`:

1. takes an advisory transaction lock keyed by `payment_charge.id`;
2. locks and validates the local order and paid charge;
3. resolves an active plan by the order's plan code;
4. claims the unique activation identity;
5. returns the existing subscription on replay;
6. creates a pending subscription and transitions it to active;
7. sets `payment_verified_at`;
8. issues initial scores explicitly;
9. synchronizes nutrition access where applicable;
10. links activation, subscription, order, and charge;
11. commits as one database transaction.

The remote service creates its activation record before the main transaction and can leave an incomplete row.
The internal implementation instead relies on the durable job row for failure state and rolls the domain transaction
back entirely. This is safer while preserving successful replay behavior.

Unlike the source, conflicting identity data for the same payment charge is rejected as
`PLAN_ACTIVATION_IDEMPOTENCY_CONFLICT`. Normal valid outcomes are unchanged.

Score uniqueness is strengthened with `(subscription_id, score_id, grant_period, allocation_sequence)`, allowing four
psychology credits while preventing duplicate activation/scheduler grants.

## SubscriptionScore lifecycle

Lookup requires an active direct subscription or active family membership, an enabled score, and an exact supported
legacy specialization. `subscription_score.id`, not `score.id`, is the consumable identity.

`use_internal_subscription_score` locks the score row. Enabled becomes used; a repeated call returns normalized
`already_used`; disabled scores are rejected.

The product reservation lifecycle remains unchanged: lookup, appointment/queue creation, `pending_use`, professional
acceptance, consumption, local usage finalization. All of these operations now use the internal provider.

`consume_internal_plan_credit` is now wired for appointment and queue acceptance. It atomically locks and consumes the
internal score, finalizes `plan_credit_usages`, and updates appointment/queue coverage state in one transaction.

## Monthly refresh and expiration

`refresh_internal_plan_subscription_scores` processes active subscriptions only. It preserves the source rule that any
existing grant for the period suppresses generation for that subscription. Quantities remain 4/up-to-3/1. Advisory
locking and grant uniqueness make duplicate scheduler executions safe.

`disable_expired_internal_plan_subscription_scores` changes enabled scores created on or before the one-month cutoff to
disabled. Recent enabled and used scores remain unchanged.

## Background processing

`internal_plans_jobs` supports:

| Job | Trigger | Deterministic key | Terminal state |
|---|---|---|---|
| activation | payment-confirmed saga | `plan-activation:{paymentChargeId}` | `dead_letter` |
| activation retry | operator/future retry flow | `plan-activation-retry:{paymentChargeId}` | `dead_letter` |
| monthly refresh | scheduled HTTP | `plan-score-refresh:{YYYY-MM-01}` | `dead_letter` |
| expiration | daily scheduled HTTP | `plan-score-expiration:{YYYY-MM-DD}` | `dead_letter` |
| credit reconciliation | future reconciliation | `plan-credit-reconcile:{usageId}` | `dead_letter` |
| external access sync | subscription status change | `plan-external-access:{subscriptionId}:{statusVersion}` | `dead_letter` |

Claims use `FOR UPDATE SKIP LOCKED`, five-minute leases, stale-lock recovery, bounded exponential retry, max attempts,
result snapshots, error code/message, worker identity, and timestamps. The worker is invoked through a protected Edge
Function using the service-role bearer token. No Redis or Laravel Queue is introduced.

The initial and operator-retry jobs use distinct queue keys so a dead-lettered initial job cannot suppress an explicit
retry. Both still converge on the same database activation identity, `payment_charge.id`, so domain data cannot duplicate.

Payment-confirmed flows now mark the order `activating_plan` and enqueue activation. The financial request waits only for
durable persistence, not subscription provisioning. The worker sets `active`; exhausted retries set `activation_failed`.

## Security and ownership

All new tables have RLS enabled and forced. Public, `anon`, and `authenticated` receive no table or RPC mutation access.
The service role owns backend reads/writes and RPC execution. `internal-plans-worker` requires the service-role bearer.
The browser cannot directly mutate entitlement state.

## Observability

Jobs persist attempts, locks, result, error code/message, last error, and completion time. The worker emits structured
technical events with operation, job ID, state, retry count, and provider `internal`.

## Provider-neutral contract and affinity

`PlansProvider` normalizes IDs to strings and supports activation, lookup, consumption, listing, and family membership.
It preserves backend, plan code, legacy IDs, raw and normalized statuses, identity, timestamps, and optional raw audit data.
Business logic does not depend on raw payloads.

Provider affinity remains persisted on orders, usages, and internal subscriptions for audit and possible future rollback
design. Phase 2A deliberately has no runtime provider router: every active caller uses the internal provider. Dual-write
is forbidden.

## Source quirks and safeguards

Documented remote quirks:

- replay does not reject a conflicting payload; internal rejects conflicts;
- source grants lack database uniqueness; internal has period/sequence uniqueness;
- legacy family lookup can choose the wrong membership; internal searches all active eligible memberships;
- missing score definitions do not fail activation; preserved;
- legacy payment updates bypass the Observer; not copied;
- external `/subscription-score/find` and `/use` are unprotected; internal RPCs are service-role only.

## Consumer mismatches not changed in Phase 2A

Some external/UI fallback mappings advertise Psychiatry for psychology and multiple specialties for family. Actual Plans
entitlements do not. The internal module follows actual remote behavior. Existing frontend fallback and callers remain
unchanged. Internal lookup follows only the actual entitlement grants.

## Tests and deployment

The Vitest suite covers pure allocation/mapping rules, provider normalization, SQL idempotency and lock boundaries,
family rules, lookup/consumption, monthly refresh, expiration, RLS, queue keys, processing, and retry behavior.
`supabase/tests/internal_plans_phase1_test.sql` adds 41 transactional pgTAP assertions against the real schema for
activation/replay, plan allocations, family rules, lookup, consumption, refresh, expiration, and durable jobs.

Deployment requires the Phase 1 migrations plus `20260924100000_activate_internal_plans_runtime.sql`, redeployment of
the migrated Edge Functions and `internal-plans-worker`, and protected worker scheduling. Drain jobs every minute and
invoke the worker daily with `enqueueMaintenance=true` to enqueue monthly refresh and daily expiration. Scheduling is an
environment operation and is not created automatically by repository deployment.

Historical external orders/usages are preserved. Rows lacking internal subscription/score identities cannot be safely
backfilled from local data alone; they remain visible through catalog fallback but are not eligible for new internal
coverage or consumption without a separately validated authoritative backfill.

