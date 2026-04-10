import { AppError } from '../_shared/errors.ts';
import type {
  RequestWithdrawalCommand,
  RequestWithdrawalRepository,
  RequestWithdrawalResult,
} from './types.ts';

const PLATFORM_FEE = 0.15;

function formatMonthBounds(now = new Date()) {
  const month = now.getMonth();
  const year = now.getFullYear();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const toYmd = (d: Date) => d.toISOString().slice(0, 10);
  return { monthStart: toYmd(start), monthEnd: toYmd(end) };
}

function buildWithdrawalSummary(bankingData: Record<string, unknown> | null, pixKey: string | null) {
  if (pixKey) {
    return { metodo: 'PIX', observacao: `PIX (INFORMADA): ${pixKey}`.trim() };
  }

  const tipoRecebimento = String(bankingData?.tipo_recebimento || 'PIX');
  if (tipoRecebimento === 'PIX') {
    const tipo = String(bankingData?.tipo_chave_pix || 'CHAVE');
    const chave = String(bankingData?.chave_pix || '').trim();
    return { metodo: 'PIX', observacao: `PIX (${tipo}): ${chave}`.trim() };
  }

  const banco = String(bankingData?.banco || '').trim();
  const agencia = String(bankingData?.agencia || '').trim();
  const conta = String(bankingData?.conta || '').trim();
  const digito = String(bankingData?.digito_conta || '').trim();
  const tipoConta = String(bankingData?.tipo_conta || 'CORRENTE');
  const contaLabel = tipoConta === 'POUPANCA' ? 'Poupanca' : 'Corrente';
  return {
    metodo: 'TRANSFERENCIA',
    observacao: `${contaLabel} ${banco} Ag. ${agencia} Conta ${conta}-${digito}`.trim(),
  };
}

export async function requestWithdrawal({
  requestId,
  input,
  authenticatedUser,
  appUserId,
  repository,
}: {
  appUserId: string;
  repository: RequestWithdrawalRepository;
} & RequestWithdrawalCommand): Promise<RequestWithdrawalResult> {
  const { monthStart, monthEnd } = formatMonthBounds();

  console.info('[request-withdrawal] request:start', {
    requestId,
    authUserId: authenticatedUser.authUserId,
    appUserId,
    value: input.value,
    monthStart,
    monthEnd,
  });

  const professional = await repository.findProfessionalByAppUserId(appUserId);
  if (!professional?.id) {
    throw new AppError({
      status: 404,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'Professional profile not found.',
    });
  }

  const professionalId = professional.id;
  const [appointments, paidSaques, bankingData] = await Promise.all([
    repository.listCompletedAppointmentsForMonth({ professionalId, monthStart, monthEnd }),
    repository.listPaidSaques(professionalId),
    repository.getBankingData(professionalId),
  ]);

  const grossMonth = appointments.reduce((sum, a) => sum + Number(a.price ?? a.preco ?? 0), 0);
  const netMonth = grossMonth * (1 - PLATFORM_FEE);
  const saquesPagos = paidSaques.reduce((sum, s) => sum + Number(s.valor ?? 0), 0);
  const saldoDisponivel = Math.max(0, netMonth - saquesPagos);

  if (input.value > saldoDisponivel) {
    throw new AppError({
      status: 409,
      code: 'INSUFFICIENT_BALANCE',
      message: 'Saldo insuficiente para solicitar este saque.',
      details: { saldoDisponivel },
    });
  }

  if (!bankingData && !input.pixKey) {
    throw new AppError({
      status: 422,
      code: 'BANKING_REQUIRED',
      message: 'Cadastre seus dados bancários ou informe uma chave PIX.',
    });
  }

  const payout = buildWithdrawalSummary(bankingData, input.pixKey || null);
  const saque = await repository.createSaque({
    professionalId,
    valor: input.value,
    metodo: payout.metodo,
    observacao: payout.observacao,
  });

  console.info('[request-withdrawal] request:success', {
    requestId,
    professionalId,
    saqueId: String(saque?.id || ''),
    saldoDisponivel,
  });

  return { saque, saldoDisponivel };
}

