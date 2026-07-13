import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = 'supabase/migrations/20260712190000_harden_plan_coverage_credit_integrity.sql';
const cleanupPath = 'supabase/scripts/staging_cleanup_duplicate_specialty_appointments.sql';
const diagnosticPath = 'supabase/scripts/diagnose_duplicate_specialty_appointments.sql';

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const activeStatuses = new Set([
  'solicitado',
  'requested',
  'pending',
  'accepted',
  'confirmed',
  'in_progress',
  'em_atendimento',
]);

function blocksUniqueSlot(status: string) {
  return activeStatuses.has(status.trim().toLowerCase());
}

type Candidate = {
  id: string;
  hasValidConsulta: boolean;
  acceptedOrInAttendance: boolean;
  hasPaidPayment: boolean;
  hasConsumedCredit: boolean;
  createdAt: string;
};

function chooseCanonical(candidates: Candidate[]) {
  return [...candidates].sort((left, right) => {
    const booleans: Array<keyof Candidate> = [
      'hasValidConsulta',
      'acceptedOrInAttendance',
      'hasPaidPayment',
      'hasConsumedCredit',
    ];

    for (const key of booleans) {
      if (left[key] !== right[key]) return left[key] ? -1 : 1;
    }

    const dateOrder = left.createdAt.localeCompare(right.createdAt);
    return dateOrder || left.id.localeCompare(right.id);
  })[0];
}

describe('specialty appointment duplicate cleanup contract', () => {
  it('uses the same normalized active-status predicate in migration and cleanup', () => {
    const migration = read(migrationPath);
    const cleanup = read(cleanupPath);

    for (const status of activeStatuses) {
      expect(migration).toContain(`'${status}'`);
      expect(cleanup).toContain(`'${status}'`);
    }
    expect(migration).toContain('lower(trim(status)) IN');
    expect(migration).toContain("service_code = 'specialty_request'");
  });

  it('blocks a second active slot but permits reuse after a terminal status', () => {
    expect(blocksUniqueSlot('SOLICITADO')).toBe(true);
    expect(blocksUniqueSlot('confirmed')).toBe(true);
    expect(blocksUniqueSlot('CANCELADO')).toBe(false);
    expect(blocksUniqueSlot('rejected')).toBe(false);
    expect(blocksUniqueSlot('EXPIRADO')).toBe(false);
    expect(blocksUniqueSlot('CONCLUIDO')).toBe(false);
    expect(blocksUniqueSlot('no_show')).toBe(false);
  });

  it('selects the canonical record deterministically using the required priority', () => {
    const canonical = chooseCanonical([
      {
        id: '00000000-0000-4000-8000-000000000001',
        hasValidConsulta: false,
        acceptedOrInAttendance: false,
        hasPaidPayment: true,
        hasConsumedCredit: false,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        hasValidConsulta: true,
        acceptedOrInAttendance: false,
        hasPaidPayment: false,
        hasConsumedCredit: false,
        createdAt: '2026-01-02T00:00:00Z',
      },
    ]);

    expect(canonical.id).toBe('00000000-0000-4000-8000-000000000002');
  });

  it('aborts before writes when a discarded record has protected state', () => {
    const cleanup = read(cleanupPath);
    const guardIndex = cleanup.indexOf('STAGING_DUPLICATE_APPOINTMENTS_REQUIRE_MANUAL_REVIEW');
    const firstUpdateIndex = cleanup.indexOf('UPDATE public.payment_charges');

    expect(guardIndex).toBeGreaterThan(-1);
    expect(firstUpdateIndex).toBeGreaterThan(guardIndex);
    expect(cleanup).toContain('canonical_rank > 1');
    expect(cleanup).toContain('has_paid_payment');
    expect(cleanup).toContain('has_consumed_credit');
    expect(cleanup).toContain('has_valid_consulta');
    expect(cleanup).toContain('has_prontuario');
  });

  it('keeps cleanup separate and verifies no duplicates before commit', () => {
    const migration = read(migrationPath);
    const cleanup = read(cleanupPath);
    const diagnostic = read(diagnosticPath);

    expect(migration).not.toContain('staging_duplicate_specialty_appointment_cleanup');
    expect(cleanup.trimStart()).toContain('STAGING ONLY');
    expect(cleanup).toContain('STAGING_DUPLICATE_APPOINTMENTS_REMAIN');
    expect(cleanup.lastIndexOf('COMMIT;')).toBeGreaterThan(cleanup.indexOf('STAGING_DUPLICATE_APPOINTMENTS_REMAIN'));
    expect(diagnostic).toContain('canonical_rank');
    expect(diagnostic).toContain('payment_charge_ids');
    expect(diagnostic).toContain('plan_credit_usage_ids');
  });
});
