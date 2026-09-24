BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(41);

INSERT INTO public.plan_subscription_orders (id, plan_code, amount, currency, external_key)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'psychology', 100, 'BRL', 'psy@example.com'),
  ('00000000-0000-0000-0000-000000000102', 'weight_loss', 200, 'BRL', 'weight@example.com'),
  ('00000000-0000-0000-0000-000000000103', 'family', 300, 'BRL', 'holder@example.com');

INSERT INTO public.payment_charges (id, owner_type, owner_id, attempt_number, status, amount, currency)
VALUES
  ('00000000-0000-0000-0000-000000000201', 'plan_subscription', '00000000-0000-0000-0000-000000000101', 1, 'paid', 100, 'BRL'),
  ('00000000-0000-0000-0000-000000000202', 'plan_subscription', '00000000-0000-0000-0000-000000000102', 1, 'paid', 200, 'BRL'),
  ('00000000-0000-0000-0000-000000000203', 'plan_subscription', '00000000-0000-0000-0000-000000000103', 1, 'paid', 300, 'BRL');

SELECT lives_ok(
  $$SELECT public.activate_internal_plan_subscription(
    '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201',
    'psy@example.com', now(), '{}'::jsonb, '{}'::jsonb
  )$$,
  'psychology activation succeeds'
);
SELECT is((SELECT count(*) FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000201'), 1::bigint, 'activation creates one subscription');
SELECT is((SELECT count(*) FROM public.plan_subscription_scores s JOIN public.plan_subscriptions sub ON sub.id = s.subscription_id WHERE sub.payment_charge_id = '00000000-0000-0000-0000-000000000201'), 4::bigint, 'psychology activation creates four scores');
SELECT ok((SELECT payment_verified_at IS NOT NULL FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000201'), 'activation records payment verification');
SELECT ok((SELECT plan_subscription_order_id = '00000000-0000-0000-0000-000000000101' AND payment_charge_id = '00000000-0000-0000-0000-000000000201' FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000201'), 'subscription links order and charge');
SELECT lives_ok(
  $$SELECT public.activate_internal_plan_subscription(
    '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201',
    'psy@example.com', now(), '{}'::jsonb, '{}'::jsonb
  )$$,
  'same payment charge replays safely'
);
SELECT is((SELECT count(*) FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000201'), 1::bigint, 'replay does not duplicate subscriptions');
SELECT is((SELECT count(*) FROM public.plan_subscription_scores s JOIN public.plan_subscriptions sub ON sub.id = s.subscription_id WHERE sub.payment_charge_id = '00000000-0000-0000-0000-000000000201'), 4::bigint, 'replay does not duplicate scores');

SELECT lives_ok(
  $$SELECT public.activate_internal_plan_subscription(
    '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000202',
    'weight@example.com', now(), '{}'::jsonb, '{}'::jsonb
  )$$,
  'weight-loss activation succeeds'
);
SELECT is((SELECT count(*) FROM public.plan_subscription_scores s JOIN public.plan_subscriptions sub ON sub.id = s.subscription_id WHERE sub.payment_charge_id = '00000000-0000-0000-0000-000000000202'), 3::bigint, 'weight-loss activation creates three score types');
SELECT is((SELECT status FROM public.plan_user_external_accesses WHERE external_access_service_id = 'app_nutricao' AND external_key = 'weight@example.com'), 1::smallint, 'weight-loss activation enables nutrition access');
SELECT is((SELECT count(*) FROM public.plan_user_external_accesses WHERE external_access_service_id = 'app_educacao_fisica'), 0::bigint, 'weight-loss activation does not invent physical-education access');

SELECT lives_ok(
  $$SELECT public.activate_internal_plan_subscription(
    '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000203',
    'holder@example.com', now(), '{}'::jsonb, '{}'::jsonb
  )$$,
  'family activation succeeds'
);
SELECT is((SELECT count(*) FROM public.plan_subscription_scores s JOIN public.plan_subscriptions sub ON sub.id = s.subscription_id WHERE sub.payment_charge_id = '00000000-0000-0000-0000-000000000203'), 1::bigint, 'family activation creates one shared score');
SELECT lives_ok(
  $$SELECT public.add_internal_family_plan_member(
    (SELECT id FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000203'),
    'holder@example.com', 'member1@example.com'
  )$$,
  'family holder can add a member'
);
SELECT ok((SELECT public.find_available_internal_subscription_score('member1@example.com', 3, 2) IS NOT NULL), 'family member resolves the shared score');
SELECT throws_ok(
  $$SELECT public.add_internal_family_plan_member(
    (SELECT id FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000203'),
    'holder@example.com', 'holder@example.com'
  )$$,
  'P0001', 'PLAN_FAMILY_HOLDER_ALREADY_INCLUDED', 'holder cannot be added as a member'
);
SELECT throws_ok(
  $$SELECT public.add_internal_family_plan_member(
    (SELECT id FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000203'),
    'holder@example.com', 'member1@example.com'
  )$$,
  'P0001', 'PLAN_FAMILY_MEMBER_DUPLICATE', 'duplicate family member is rejected'
);
SELECT lives_ok($$SELECT public.add_internal_family_plan_member((SELECT id FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000203'), 'holder@example.com', 'member2@example.com')$$, 'second family member is accepted');
SELECT lives_ok($$SELECT public.add_internal_family_plan_member((SELECT id FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000203'), 'holder@example.com', 'member3@example.com')$$, 'third family member is accepted');
SELECT throws_ok(
  $$SELECT public.add_internal_family_plan_member(
    (SELECT id FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000203'),
    'holder@example.com', 'member4@example.com'
  )$$,
  'P0001', 'PLAN_FAMILY_LIMIT_REACHED', 'family is limited to holder plus three members'
);

SELECT ok((SELECT public.find_available_internal_subscription_score('psy@example.com', 1, 22) IS NOT NULL), 'direct active subscription lookup succeeds');
UPDATE public.plan_subscriptions SET status = 2 WHERE payment_charge_id = '00000000-0000-0000-0000-000000000203';
SELECT ok((SELECT public.find_available_internal_subscription_score('member1@example.com', 3, 2) IS NULL), 'inactive family subscription is ignored');

CREATE TEMP TABLE consumed_score AS
SELECT s.id FROM public.plan_subscription_scores s
JOIN public.plan_subscriptions sub ON sub.id = s.subscription_id
WHERE sub.payment_charge_id = '00000000-0000-0000-0000-000000000201'
ORDER BY s.id LIMIT 1;
SELECT is((SELECT public.use_internal_subscription_score(id)->>'outcome' FROM consumed_score), 'used_now', 'enabled score is consumed');
SELECT is((SELECT public.use_internal_subscription_score(id)->>'outcome' FROM consumed_score), 'already_used', 'repeated consumption is idempotent');
SELECT is((SELECT status FROM public.plan_subscription_scores WHERE id = (SELECT id FROM consumed_score)), 2::smallint, 'consumed score remains used');

SELECT is((public.refresh_internal_plan_subscription_scores('2099-01-01')->>'scores_created')::integer, 7, 'monthly refresh allocates 4 plus 3 for active subscriptions');
SELECT is((public.refresh_internal_plan_subscription_scores('2099-01-01')->>'scores_created')::integer, 0, 'monthly refresh does not duplicate a grant period');
SELECT is((SELECT count(*) FROM public.plan_subscription_scores WHERE grant_period = '2099-01-01' AND subscription_id = (SELECT id FROM public.plan_subscriptions WHERE payment_charge_id = '00000000-0000-0000-0000-000000000203')), 0::bigint, 'monthly refresh ignores inactive subscriptions');

UPDATE public.plan_subscription_scores
SET created_at = now() - interval '2 months'
WHERE id = (SELECT id FROM public.plan_subscription_scores WHERE status = 1 ORDER BY id LIMIT 1);
SELECT ok((public.disable_expired_internal_plan_subscription_scores(now() - interval '1 month')->>'scores_disabled')::integer >= 1, 'expiration disables old enabled scores');
SELECT is((SELECT status FROM public.plan_subscription_scores WHERE id = (SELECT id FROM consumed_score)), 2::smallint, 'expiration leaves used scores unchanged');
SELECT ok(EXISTS (SELECT 1 FROM public.plan_subscription_scores WHERE status = 1 AND created_at > now() - interval '1 month'), 'expiration leaves recent enabled scores unchanged');

SELECT lives_ok($$SELECT public.enqueue_internal_plans_job('sync_external_access', 'test-sync:1', '{"subscriptionId":"sub-1"}'::jsonb)$$, 'job enqueue succeeds');
SELECT lives_ok($$SELECT public.enqueue_internal_plans_job('sync_external_access', 'test-sync:1', '{"subscriptionId":"sub-1"}'::jsonb)$$, 'duplicate job enqueue is safe');
SELECT is((SELECT count(*) FROM public.internal_plans_jobs WHERE idempotency_key = 'test-sync:1'), 1::bigint, 'job idempotency key prevents duplicates');
SELECT is((SELECT count(*) FROM public.claim_internal_plans_jobs('test-worker', 1, 30)), 1::bigint, 'worker claims one persisted job');
SELECT is((SELECT public.fail_internal_plans_job(id, 'test-worker', 'TEST_FAILURE', 'retry me') FROM public.internal_plans_jobs WHERE idempotency_key = 'test-sync:1'), 'pending', 'failed job is scheduled for retry');
SELECT ok((SELECT error_code = 'TEST_FAILURE' AND last_error_at IS NOT NULL FROM public.internal_plans_jobs WHERE idempotency_key = 'test-sync:1'), 'retry failure remains observable');
SELECT lives_ok($$SELECT public.enqueue_internal_plans_job('sync_external_access', 'test-dead:1', '{}'::jsonb, now(), 1)$$, 'terminal-failure job enqueue succeeds');
SELECT is((SELECT count(*) FROM public.claim_internal_plans_jobs('dead-worker', 10, 30)), 1::bigint, 'terminal-failure job is claimed');
SELECT is((SELECT public.fail_internal_plans_job(id, 'dead-worker', 'TEST_DEAD', 'stop') FROM public.internal_plans_jobs WHERE idempotency_key = 'test-dead:1'), 'dead_letter', 'max-attempt failure reaches dead letter');

SELECT * FROM finish();
ROLLBACK;
