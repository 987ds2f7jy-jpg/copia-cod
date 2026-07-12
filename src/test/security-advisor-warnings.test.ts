import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = 'supabase/migrations/20260712170000_fix_security_advisor_search_paths.sql';

function read(relativePath: string) {
  return readFileSync(relativePath, 'utf8');
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return entry === 'test' ? [] : listSourceFiles(path);
    }
    return /\.[jt]sx?$/.test(entry) ? [path] : [];
  });
}

describe('Security Advisor warning hardening', () => {
  it('sets fixed search paths using all nine exact function signatures', () => {
    const migration = read(MIGRATION_PATH);
    const signatures = [
      'public.enforce_queue_payment_guard()',
      'public.enforce_solicitacao_exame_payment_guard()',
      'public.accept_appointment_transaction(UUID, TEXT, UUID)',
      'public.accept_queue_entry_transaction(UUID, TEXT, UUID)',
      'public.normalize_plantao_specialty(p_value TEXT)',
      'public.sync_consulta_profissional_user_id()',
      'public.current_app_user_id()',
      'public.current_app_user_role()',
      'public.enforce_appointment_payment_guard()',
    ];

    for (const signature of signatures) {
      expect(migration).toContain(signature);
    }

    expect(migration.match(/SET search_path/g)).toHaveLength(9);
  });

  it('preserves trigger and RPC implementations and does not change grants', () => {
    const migration = read(MIGRATION_PATH);
    const paymentGuards = read('supabase/migrations/20260418100000_add_payment_operation_guards.sql');
    const appointmentAccept = read('supabase/migrations/20260602120000_block_expired_specialty_appointment_acceptance.sql');
    const queueAccept = read('supabase/migrations/20260418093000_propagate_pricing_snapshots_on_accept.sql');
    const consultationSync = read('supabase/migrations/20260409000200_backfill_consistency.sql');

    expect(paymentGuards).toContain('CREATE TRIGGER enforce_appointment_payment_guard');
    expect(paymentGuards).toContain('CREATE TRIGGER enforce_queue_payment_guard');
    expect(paymentGuards).toContain('CREATE TRIGGER enforce_solicitacao_exame_payment_guard');
    expect(consultationSync).toContain('CREATE TRIGGER set_consulta_profissional_user_id');
    expect(appointmentAccept).toContain('CREATE OR REPLACE FUNCTION public.accept_appointment_transaction');
    expect(queueAccept).toContain('CREATE OR REPLACE FUNCTION public.accept_queue_entry_transaction');
    expect(migration).not.toMatch(/\b(?:GRANT|REVOKE)\b/i);
    expect(migration).not.toMatch(/DROP\s+TRIGGER/i);
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.accept_appointment_transaction');
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.accept_queue_entry_transaction');
  });

  it('moves only relocatable unaccent and keeps normalization qualified and immutable', () => {
    const migration = read(MIGRATION_PATH);

    expect(migration).toContain('available.relocatable');
    expect(migration).toContain('UNACCENT_EXTENSION_NOT_RELOCATABLE');
    expect(migration).toContain('ALTER EXTENSION unaccent SET SCHEMA extensions');
    expect(migration).toContain('extensions.unaccent(');
    expect(migration).toContain('IMMUTABLE');
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain("WHEN v_normalized = 'psicologia_clinica' THEN 'psicologia'");
  });

  it('does not add public RLS policies or direct frontend database calls', () => {
    const migration = read(MIGRATION_PATH);
    const frontendSource = listSourceFiles('src')
      .map((path) => read(path))
      .join('\n');

    expect(migration).not.toMatch(/CREATE\s+POLICY/i);
    expect(frontendSource).not.toMatch(/supabase\.(?:from|rpc)\s*\(/);
  });

  it('documents all 26 intentional no-policy tables and their Edge access', () => {
    const documentation = read('supabase/RLS_NO_POLICY.md');
    const hardenedMigration = read('supabase/migrations/20260712150000_harden_rls_storage_and_rpc.sql');
    const tables = [...hardenedMigration.matchAll(/^\s+'([a-z0-9_]+)'[,]?$/gm)]
      .map((match) => match[1]);

    expect(tables).toHaveLength(26);
    for (const table of tables) {
      expect(documentation).toContain(`\`${table}\``);
    }
    expect(documentation).toContain('Nenhuma policy publica nova foi necessaria');
  });
});
