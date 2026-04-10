import { AppError } from '../_shared/errors.ts';
import type { UpsertProfessionalBankingDataInput } from './types.ts';

function t(value: unknown) {
  return String(value ?? '').trim();
}

export function parseUpsertProfessionalBankingDataInput(body: unknown): UpsertProfessionalBankingDataInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const r = body as Record<string, unknown>;
  const tipoPessoa = t(r.tipoPessoa) || 'PF';
  const nomeTitular = t(r.nomeTitular);
  const cpfCnpj = t(r.cpfCnpj);
  const tipoRecebimento = t(r.tipoRecebimento) || 'PIX';

  if (!nomeTitular || !cpfCnpj) {
    throw new AppError({
      status: 422,
      code: 'BANKING_REQUIRED_FIELDS',
      message: 'Nome do titular e CPF/CNPJ são obrigatórios.',
    });
  }

  if (tipoRecebimento === 'PIX') {
    const chavePix = t(r.chavePix);
    if (!chavePix) {
      throw new AppError({
        status: 422,
        code: 'PIX_KEY_REQUIRED',
        message: 'Chave PIX é obrigatória.',
      });
    }
  } else if (tipoRecebimento === 'TRANSFERENCIA') {
    const banco = t(r.banco);
    const agencia = t(r.agencia);
    const conta = t(r.conta);
    if (!banco || !agencia || !conta) {
      throw new AppError({
        status: 422,
        code: 'BANK_TRANSFER_REQUIRED',
        message: 'Banco, agência e conta são obrigatórios para transferência.',
      });
    }
  }

  return {
    tipoPessoa,
    nomeTitular,
    cpfCnpj,
    tipoRecebimento,
    tipoChavePix: t(r.tipoChavePix) || undefined,
    chavePix: t(r.chavePix) || undefined,
    banco: t(r.banco) || undefined,
    agencia: t(r.agencia) || undefined,
    conta: t(r.conta) || undefined,
    digitoConta: t(r.digitoConta) || undefined,
    tipoConta: t(r.tipoConta) || undefined,
    razaoSocial: t(r.razaoSocial) || undefined,
  };
}

