import { AppError } from '../_shared/errors.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type {
  CreateSolicitacaoExameCommand,
  CreateSolicitacaoExameRepository,
  CreateSolicitacaoExameResult,
  JsonObject,
} from './types.ts';

const CLINICO_GERAL = 'clinico_geral';

function ensurePatientAppUser(appUser: {
  id: string;
  role: string;
  isActive: boolean;
} | null): AppUserRecord {
  if (!appUser?.id) {
    throw new AppError({
      status: 403,
      code: 'APP_USER_NOT_FOUND',
      message: 'Authenticated user is not linked to app_users.',
    });
  }

  if (appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }

  if (appUser.role === 'professional') {
    throw new AppError({
      status: 403,
      code: 'PATIENT_ROLE_REQUIRED',
      message: 'Professional accounts cannot create patient exam requests.',
    });
  }

  return appUser as AppUserRecord;
}

function readObjectString(record: JsonObject, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

export async function createSolicitacaoExame({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: CreateSolicitacaoExameRepository;
} & CreateSolicitacaoExameCommand): Promise<CreateSolicitacaoExameResult> {
  const appUser = ensurePatientAppUser(
    await repository.findAppUserByAuthUserId(authenticatedUser.authUserId),
  );

  let exameSolicitado = input.exameSolicitado;
  let motivo = input.motivo;
  let sintomas = input.sintomas;
  let assintomaticoConfirmado = input.assintomaticoConfirmado;
  let fluxoDestino: 'dashboard' | 'plantao' = 'dashboard';
  let especialidadeDestino = input.especialidadeDestino || CLINICO_GERAL;
  let nomeMedicamento = input.nomeMedicamento;
  let dosagem = input.dosagem;
  let frequencia = input.frequencia;
  let arquivoReceitaUrl = input.arquivoReceitaUrl;
  let dadosIdentificacao = input.dadosIdentificacao;
  let informacoesSaude = input.informacoesSaude;
  let especificacaoLaudo = input.especificacaoLaudo;
  let arquivos = input.arquivos;
  let queueId = input.queueId;

  switch (input.tipo) {
    case 'checkup':
      if (!assintomaticoConfirmado) {
        throw new AppError({
          status: 422,
          code: 'CHECKUP_REQUIRES_ASSINTOMATICO_CONFIRMATION',
          message: 'Check-up requests require asymptomatic confirmation.',
        });
      }

      exameSolicitado = exameSolicitado || 'Check-Up Completo';
      motivo = motivo || 'Exames de rotina / check-up preventivo';
      sintomas = '';
      fluxoDestino = 'dashboard';
      especialidadeDestino = CLINICO_GERAL;
      break;
    case 'especificos':
      if (!exameSolicitado) {
        throw new AppError({
          status: 422,
          code: 'EXAME_SOLICITADO_REQUIRED',
          message: 'Specific exam requests require "exameSolicitado".',
        });
      }

      assintomaticoConfirmado = false;
      fluxoDestino = 'plantao';
      especialidadeDestino = CLINICO_GERAL;
      break;
    case 'renovacao_receitas':
      if (!nomeMedicamento || !dosagem || !frequencia || !arquivoReceitaUrl) {
        throw new AppError({
          status: 422,
          code: 'RENOVACAO_RECEITA_FIELDS_REQUIRED',
          message: 'Prescription renewal requires medication, dosage, frequency and prior prescription file.',
        });
      }

      exameSolicitado = '';
      motivo = '';
      sintomas = '';
      assintomaticoConfirmado = false;
      fluxoDestino = 'dashboard';
      especialidadeDestino = CLINICO_GERAL;
      break;
    case 'laudo_medico':
      if (arquivos.length === 0) {
        throw new AppError({
          status: 422,
          code: 'LAUDO_ARQUIVOS_REQUIRED',
          message: 'Medical certificate requests require at least one attachment URL.',
        });
      }

      motivo = motivo || readObjectString(especificacaoLaudo, 'finalidade');
      sintomas = sintomas || readObjectString(informacoesSaude, 'diagnostico');
      assintomaticoConfirmado = false;
      fluxoDestino = 'plantao';
      especialidadeDestino = CLINICO_GERAL;
      break;
    default:
      throw new AppError({
        status: 400,
        code: 'TIPO_INVALID',
        message: 'Unsupported exam request type.',
      });
  }

  const dadosSaude = informacoesSaude;
  const arquivosUrls = arquivos;

  console.info('[create-solicitacao-exame] request:start', {
    requestId,
    patientId: appUser.id,
    tipo: input.tipo,
    fluxoDestino,
    especialidadeDestino,
  });

  const solicitacaoExame = await repository.createSolicitacaoExame({
    patient: appUser,
    tipo: input.tipo,
    exameSolicitado,
    motivo,
    sintomas,
    status: 'pending',
    assintomaticoConfirmado,
    medicoId: '',
    fluxoDestino,
    especialidadeDestino,
    nomeMedicamento,
    dosagem,
    frequencia,
    arquivoReceitaUrl,
    dadosIdentificacao,
    informacoesSaude,
    dadosSaude,
    especificacaoLaudo,
    arquivos,
    arquivosUrls,
    queueId,
  });

  console.info('[create-solicitacao-exame] request:success', {
    requestId,
    solicitacaoExameId: solicitacaoExame.id,
    patientId: solicitacaoExame.paciente_id,
    tipo: solicitacaoExame.tipo,
  });

  return {
    solicitacaoExame,
  };
}
