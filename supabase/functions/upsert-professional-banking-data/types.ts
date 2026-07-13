export type UpsertProfessionalBankingDataInput = {
  tipoPessoa: string;
  nomeTitular: string;
  cpfCnpj: string;
  tipoRecebimento: string;
  tipoChavePix?: string;
  chavePix?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  digitoConta?: string;
  tipoConta?: string;
  razaoSocial?: string;
};

export type ProfessionalBankingDataRecord = {
  id: string;
  professional_id: string;
  tipo_pessoa: string | null;
  nome_titular: string | null;
  cpf_cnpj: string | null;
  tipo_recebimento: string | null;
  tipo_chave_pix: string | null;
  chave_pix: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  digito_conta: string | null;
  tipo_conta: string | null;
  razao_social: string | null;
};

export type UpsertProfessionalBankingDataResult = {
  bankingData: ProfessionalBankingDataRecord;
};

export type UpsertProfessionalBankingDataRepository = {
  findProfessionalProfileIdByAppUserId(appUserId: string): Promise<string | null>;
  findExistingBankingData(professionalId: string): Promise<ProfessionalBankingDataRecord | null>;
  insertBankingData(params: {
    professionalId: string;
    record: Record<string, unknown>;
  }): Promise<ProfessionalBankingDataRecord>;
};

export type UpsertProfessionalBankingDataCommand = {
  requestId: string;
  input: UpsertProfessionalBankingDataInput;
  authenticatedUser: { authUserId: string; email: string | null };
};

