import { AppError } from '../_shared/errors.ts';
import type {
  UpsertProfessionalBankingDataCommand,
  UpsertProfessionalBankingDataRepository,
  UpsertProfessionalBankingDataResult,
} from './types.ts';

export async function upsertProfessionalBankingData({
  requestId,
  input,
  authenticatedUser,
  appUserId,
  repository,
}: {
  appUserId: string;
  repository: UpsertProfessionalBankingDataRepository;
} & UpsertProfessionalBankingDataCommand): Promise<UpsertProfessionalBankingDataResult> {
  console.info('[upsert-professional-banking-data] request:start', {
    requestId,
    authUserId: authenticatedUser.authUserId,
    appUserId,
  });

  const professionalId = await repository.findProfessionalProfileIdByAppUserId(appUserId);

  if (!professionalId) {
    throw new AppError({
      status: 404,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'Professional profile not found.',
    });
  }

  const record = {
    tipo_pessoa: input.tipoPessoa,
    nome_titular: input.nomeTitular,
    cpf_cnpj: input.cpfCnpj,
    tipo_recebimento: input.tipoRecebimento,
    tipo_chave_pix: input.tipoChavePix || '',
    chave_pix: input.chavePix || '',
    banco: input.banco || '',
    agencia: input.agencia || '',
    conta: input.conta || '',
    digito_conta: input.digitoConta || '',
    tipo_conta: input.tipoConta || 'CORRENTE',
    razao_social: input.razaoSocial || '',
  };

  const existing = await repository.findExistingBankingData(professionalId);
  const bankingData = existing?.id
    ? await repository.updateBankingData({ bankingDataId: existing.id, record })
    : await repository.insertBankingData({ professionalId, record });

  console.info('[upsert-professional-banking-data] request:success', {
    requestId,
    professionalId,
    bankingDataId: bankingData.id,
  });

  return { bankingData };
}

