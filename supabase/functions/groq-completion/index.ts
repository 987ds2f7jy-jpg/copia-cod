import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { AppError } from '../_shared/errors.ts';
import { createSessionAccountServiceClient } from '../_shared/sessionAccount.ts';
import { requireConsultationAccess } from '../_shared/teleconsultaAccess.ts';
import { requireTranscriptionConsent } from '../_shared/consultation-consent.ts';
import { recordAuditEvent } from '../_shared/observability.ts';

const FUNCTION_NAME = 'groq-completion';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

function getGroqApiKey() {
  const groqApiKey = Deno.env.get('GROQ_API_KEY')?.trim();

  if (!groqApiKey) {
    throw new AppError({
      status: 500,
      code: 'GROQ_NOT_CONFIGURED',
      message: 'Groq API key not configured.',
    });
  }

  return groqApiKey;
}

function parseInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const consultationId = String(record.consultationId ?? '').trim();
  const transcript = String(record.transcript ?? '').trim();

  if (!consultationId) {
    throw new AppError({
      status: 400,
      code: 'CONSULTATION_ID_REQUIRED',
      message: '"consultationId" is required.',
    });
  }

  if (!transcript) {
    throw new AppError({
      status: 400,
      code: 'TRANSCRIPT_REQUIRED',
      message: 'Campo "transcript" e obrigatorio.',
    });
  }

  return {
    consultationId,
    transcript,
  };
}

async function handleGroqCompletionRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);

  if (preflightResponse) {
    return preflightResponse;
  }

  const requestId = createRequestId();
  const methodErrorResponse = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });

  if (methodErrorResponse) {
    return methodErrorResponse;
  }

  try {
    const input = parseInput(await readJsonBody<unknown>(req));
    const client = createSessionAccountServiceClient();
    const { appUser, consultation } = await requireConsultationAccess({
      req,
      consultationId: input.consultationId,
      client,
      allowedRoles: ['professional'],
    });
    if (String(consultation.status || '').toLowerCase() !== 'em_atendimento') {
      throw new AppError({
        status: 409,
        code: 'CONSULTATION_NOT_ACTIVE',
        message: 'AI assistance is available only during an active consultation.',
      });
    }
    await requireTranscriptionConsent(client, {
      consultationId: input.consultationId,
      patientUserId: consultation.paciente_id,
      requireAiNotice: true,
    });
    const groqApiKey = getGroqApiKey();

    const prompt = `Organize exclusivamente as informacoes presentes na transcricao em um rascunho de apoio ao profissional, sem inferir fatos ausentes, sem emitir decisao clinica final e sem comunicar diagnostico ao paciente. Retorne JSON exatamente com estes campos:

{
  "motivo_da_consulta": "...",
  "historico_e_fatores_de_risco": "...",
  "exames_imagens": "...",
  "exame_fisico": "...",
  "avaliacao_diagnostica": "...",
  "recomendacoes_e_conduta": "..."
}

Transcricao completa da consulta:
"""${input.transcript}"""

Responda APENAS com o JSON valido, sem nenhum texto adicional.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new AppError({
        status: 502,
        code: 'GROQ_UPSTREAM_ERROR',
        message: 'Erro ao chamar a API do Groq.',
        details: {
          providerStatus: response.status,
        },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new AppError({
        status: 502,
        code: 'GROQ_EMPTY_RESPONSE',
        message: 'A IA nao retornou conteudo valido.',
      });
    }

    console.info('[groq-completion] request:success', {
      requestId,
      appUserId: appUser.id,
      consultationId: input.consultationId,
    });

    await recordAuditEvent(client, {
      actorUserId: appUser.id,
      actorRole: 'professional',
      action: 'ai_assistance_draft_generated',
      resourceType: 'consulta',
      resourceId: input.consultationId,
      outcome: 'succeeded',
      requestId,
      metadata: { provider: 'groq' },
    });

    return successResponse({
      content,
    }, requestId, {
      status: 200,
      cors: CORS,
    });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}

Deno.serve(handleGroqCompletionRequest);
