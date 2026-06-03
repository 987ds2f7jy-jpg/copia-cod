import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(relativePath: string) {
  return readFileSync(relativePath, 'utf8');
}

describe('professional dashboard plan-funded solicitations', () => {
  it('allows requested appointments when they are either paid self-pay or valid plan-funded requests', () => {
    const readModels = read('supabase/functions/read-models/index.ts');

    expect(readModels).toContain('function applyAppointmentSolicitationFinancialEligibility');
    expect(readModels).toContain('payment_status.eq.paid');
    expect(readModels).toContain('funding_source.eq.plan');
    expect(readModels).toContain('payment_required.eq.false');
    expect(readModels).toContain('coverage_status.eq.plan_pending_use');
    expect(readModels).toContain('plan_credit_usage_id.not.is.null');
    expect(readModels).not.toContain("payment_status: 'paid',\n    };\n  }\n\n  return filters;");
  });

  it('filters expired specialty appointment requests out of professional solicitations', () => {
    const readModels = read('supabase/functions/read-models/index.ts');

    expect(readModels).toContain('isSpecialtyAppointmentRequestExpired');
    expect(readModels).toContain('function filterExpiredAppointmentSolicitations');
    expect(readModels).toContain('appointmentType: row.appointment_type');
    expect(readModels).toContain('scheduledDatetime: row.scheduled_datetime');
    expect(readModels.indexOf('filterExpiredAppointmentSolicitations(')).toBeLessThan(
      readModels.indexOf('sanitizePublicRecords(input.entity, filters, rows)'),
    );
  });

  it('keeps specialty-based professional authorization for requested appointments', () => {
    const readModels = read('supabase/functions/read-models/index.ts');

    expect(readModels).toContain("requestedStatus === 'SOLICITADO'");
    expect(readModels).toContain('context.specialties.includes(requestedSpecialty)');
    expect(readModels).toContain('READ_FORBIDDEN');
  });

  it('renders plan-funded requests without changing the acceptance endpoint', () => {
    const dashboardCard = read('src/components/dashboard/SolicitacoesAgendamento.jsx');

    expect(dashboardCard).toContain("sol.funding_source === 'plan'");
    expect(dashboardCard).toContain('Coberto por plano');
    expect(dashboardCard).toContain('Crédito pendente de uso no aceite');
    expect(dashboardCard).toContain('acceptAppointmentRequest');
    expect(dashboardCard).not.toContain('/subscription-score/use');
  });
});
