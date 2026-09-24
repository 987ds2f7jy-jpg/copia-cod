# Plans integration map

Phase 2A status: `internal_active`. All active callers use `PlansFacade` / `InternalPlansProvider`; the external HTTP
client remains in the repository only for Phase 2B cleanup and is not imported by an active Plans flow.

| Capability/caller            | Former external operation                | Active internal entry point                                                                         | Persisted identity                                  | Status            | Notes                                                                                                                 |
| ---------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Payment-confirmed activation | `POST /plans/external/activate`          | `PlansFacade.enqueueActivation` → durable worker → `InternalPlansProvider.activatePlanSubscription` | `payment_charge.id`                                 | `internal_active` | Financial request marks `activating_plan` and returns after enqueue                                                   |
| Retry activation             | same HTTP endpoint                       | dedicated internal retry job                                                                        | same `payment_charge.id` activation identity        | `internal_active` | Authorization and `activation_failed` validation remain in `retry-plan-activation`                                    |
| My plans/credits             | `POST /plans/external/scores`            | `PlansFacade.listSubscriptionScores`                                                                | `internal_plans_subscription_id`                    | `internal_active` | Existing frontend response shape and legacy `creditsSource=plans_service` presentation label are retained temporarily |
| Coverage check API           | `POST /subscription-score/find`          | shared `resolvePlanCoverage` → facade lookup                                                        | internal subscription and SubscriptionScore UUID    | `internal_active` | Legacy-shaped response fields carry normalized IDs only at the API boundary                                           |
| Create appointment coverage  | external lookup                          | shared internal coverage + `create_internal_plan_funded_appointment`                                | `plan_credit_usages.internal_subscription_score_id` | `internal_active` | Creates `pending_use`; does not consume                                                                               |
| Join queue coverage          | external lookup                          | shared internal coverage + `create_internal_plan_funded_queue`                                      | `plan_credit_usages.internal_subscription_score_id` | `internal_active` | Creates `pending_use`; does not consume                                                                               |
| Appointment acceptance       | `POST /subscription-score/use`           | `PlansFacade.consumePlanCredit` → atomic RPC                                                        | usage + internal SubscriptionScore UUID             | `internal_active` | Score, usage and appointment coverage commit together                                                                 |
| Queue acceptance             | same HTTP endpoint                       | same shared internal consumption path                                                               | usage + internal SubscriptionScore UUID             | `internal_active` | Score, usage and queue coverage commit together                                                                       |
| Financial reconciliation     | external score listing                   | facade listing + `reconcile_internal_plan_credit_usage`                                             | internal SubscriptionScore UUID                     | `internal_active` | Distributed HTTP ambiguity no longer applies to new internal usages                                                   |
| Family membership            | external family endpoint, unused locally | `PlansFacade.addFamilyPlanMember`                                                                   | internal subscription UUID                          | `internal_ready`  | No new UI was introduced                                                                                              |
| Monthly refresh              | Laravel scheduled command                | maintenance enqueue + refresh job/RPC                                                               | period key                                          | `internal_active` | Invoke worker with `enqueueMaintenance=true` at least daily; monthly key prevents duplicates                          |
| Score expiration             | Laravel scheduled command                | maintenance enqueue + expiration job/RPC                                                            | execution-date key                                  | `internal_active` | Daily cutoff is one month; used scores remain used                                                                    |
| Nutrition access sync        | external observer/service                | explicit internal RPC/job                                                                           | subscription + state version                        | `internal_active` | Only `app_nutricao`; no physical-education access was added                                                           |

## Runtime sequence

```text
payment confirmed → order activating_plan → durable activation job → worker
→ InternalPlansProvider → transactional subscription + grants + nutrition access → order active
```

Appointment and queue creation only reserve an internal score. Professional acceptance invokes the atomic internal
consumption transaction. A rolled-back internal transaction does not create the former “external consumed/local failed”
ambiguity; reconciliation remains for historical rows and genuinely inconsistent local state.

## Scheduling and deployment

Deploy/redeploy every caller changed in Phase 2A plus `internal-plans-worker`. Configure a protected scheduler to invoke:

```http
POST /functions/v1/internal-plans-worker
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Content-Type: application/json

{"enqueueMaintenance":true,"limit":50}
```

Recommended operations:

- queue draining: every minute, `{ "limit": 50 }`;
- maintenance enqueue: daily after 00:05 UTC, `{ "enqueueMaintenance": true, "limit": 50 }`.

Daily maintenance safely enqueues expiration for the execution date and refresh for the current month. Deterministic
keys make repeated invocations harmless. Cron configuration is an environment operation and is not automatically
created by repository deployment.

## Historical data boundary

External identifiers remain untouched. Historical active orders without `internal_plans_subscription_id` and usages
without `internal_subscription_score_id` cannot be reconstructed from local data alone. They are not silently converted;
My Plans falls back to the existing catalog presentation and internal coverage will not spend them. Production rollout
must either accept that boundary or perform a separately validated backfill from an authoritative entitlement export.

## Phase 2B

After production validation, remove the unused external client, dead compatibility blocks, legacy environment variables,
and legacy source-label naming. Phase 2A intentionally performs none of that destructive cleanup.

## Historical subscriptions

Legacy/external subscriptions are intentionally not migrated.

The production cutover establishes the Internal Plans module as the
authoritative source for new subscriptions.

Historical external entitlements are considered expired/discarded and
must not participate in:

- coverage lookup;
- score consumption;
- My Plans entitlement calculation;
- family membership;
- monthly refresh;
- score expiration.

No entitlement backfill is required.
