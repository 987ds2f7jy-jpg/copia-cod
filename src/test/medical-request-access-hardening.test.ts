import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { getSolicitacaoExameAtendimento } from '../../supabase/functions/get-solicitacao-exame-atendimento/service';
import type { GetSolicitacaoExameAtendimentoRepository } from '../../supabase/functions/get-solicitacao-exame-atendimento/types';

function read(relativePath: string) {
  return readFileSync(relativePath, 'utf8');
}

describe('medical request read authorization', () => {
  it('limits professional listings to approved eligible and available requests', () => {
    const readModels = read('supabase/functions/read-models/index.ts');

    expect(readModels).toContain(".eq('status', 'approved')");
    expect(readModels).toContain(".includes('clinico_geral')");
    expect(readModels).toContain(".eq('status', 'pending')");
    expect(readModels).toContain(".eq('payment_status', 'paid')");
    expect(readModels).toContain(".is('medico_id', null)");
    expect(readModels).toContain('SOLICITACAO_PROFESSIONAL_AVAILABLE_SELECT');
  });

  it('does not expose medical attachments in the pre-acceptance DTO', () => {
    const readModels = read('supabase/functions/read-models/index.ts');
    const minimalDto = readModels.split('const SOLICITACAO_PROFESSIONAL_AVAILABLE_SELECT')[1]
      .split('`;')[0];

    expect(minimalDto).not.toContain('arquivo_receita_url');
    expect(minimalDto).not.toContain('arquivos_urls');
    expect(minimalDto).not.toContain('dados_saude');
    expect(minimalDto).not.toContain('paciente_email');
  });

  it('allows patients to read only their own request selector', () => {
    const readModels = read('supabase/functions/read-models/index.ts');

    expect(readModels).toContain('normalizeString(filters.paciente_id) === authenticatedUser.id');
    expect(readModels).toContain("return 'solicitacao_patient'");
  });

  it('signs files only after the responsible professional is authorized', () => {
    const service = read('supabase/functions/get-solicitacao-exame-atendimento/service.ts');
    const repository = read('supabase/functions/get-solicitacao-exame-atendimento/repository.ts');

    expect(service.indexOf('assertAccessibleSolicitacao')).toBeLessThan(
      service.indexOf('signAuthorizedMedicalFiles'),
    );
    expect(repository).toContain(".eq('status', 'approved')");
    expect(repository).toContain('.createSignedUrl(path, 5 * 60)');
    expect(read('supabase/functions/read-models/index.ts')).toContain('5 * 60, false');
    expect(service).toContain('professionalProfileIds.includes(medicoId)');
  });

  it('does not sign or return a request accepted by another professional', async () => {
    const signAuthorizedMedicalFiles = vi.fn();
    const repository = {
      findProfessionalIdentityByAuthUserId: vi.fn().mockResolvedValue({
        appUserId: '10000000-0000-4000-8000-000000000001',
        profileIds: ['20000000-0000-4000-8000-000000000001'],
        primaryProfileId: '20000000-0000-4000-8000-000000000001',
      }),
      findSolicitacaoExameById: vi.fn().mockResolvedValue({
        id: '30000000-0000-4000-8000-000000000001',
        medico_id: '20000000-0000-4000-8000-000000000002',
        status: 'in_progress',
        payment_status: 'paid',
        tipo: 'checkup',
        fluxo_destino: 'dashboard',
        paciente_id: '40000000-0000-4000-8000-000000000001',
      }),
      signAuthorizedMedicalFiles,
      findPatientById: vi.fn(),
    } as unknown as GetSolicitacaoExameAtendimentoRepository;

    await expect(getSolicitacaoExameAtendimento({
      requestId: 'request-1',
      input: { solicitacaoId: '30000000-0000-4000-8000-000000000001' },
      authenticatedUser: { authUserId: 'auth-professional', email: null },
      repository,
    })).rejects.toMatchObject({ status: 404, code: 'SOLICITACAO_EXAME_NOT_FOUND' });
    expect(signAuthorizedMedicalFiles).not.toHaveBeenCalled();
  });

  it('does not allow generic workflow updates to self-assign a medical request', () => {
    const updateService = read('supabase/functions/update-solicitacao-exame/service.ts');

    expect(updateService).toContain('SOLICITACAO_EXAME_WORKFLOW_ENDPOINT_REQUIRED');
    expect(updateService).toContain('dedicated accept or finish endpoint');
    expect(updateService).not.toContain("const isProfessionalOperator = appUser.role === 'professional'");
  });
});
