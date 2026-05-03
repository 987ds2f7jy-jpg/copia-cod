ALTER TABLE public.solicitacoes_exames
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consulta_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exames_completed_at
  ON public.solicitacoes_exames (completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exames_consulta_id
  ON public.solicitacoes_exames (consulta_id)
  WHERE consulta_id <> '';

ALTER TABLE public.prontuarios
  ADD COLUMN IF NOT EXISTS solicitacao_exame_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_prontuarios_solicitacao_exame_id
  ON public.prontuarios (solicitacao_exame_id)
  WHERE solicitacao_exame_id <> '';

CREATE OR REPLACE FUNCTION public.finish_solicitacao_exame_atendimento_transaction(
  p_solicitacao_id UUID,
  p_professional_profile_id TEXT,
  p_professional_app_user_id TEXT,
  p_recomendacoes TEXT
)
RETURNS TABLE (
  result_solicitacao_id UUID,
  result_consulta_id UUID,
  result_prontuario_id UUID,
  result_status TEXT,
  result_completed_at TIMESTAMPTZ,
  result_recomendacoes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitacao public.solicitacoes_exames%ROWTYPE;
  v_professional RECORD;
  v_now TIMESTAMPTZ := now();
  v_consulta_id UUID;
  v_prontuario_id UUID;
  v_service_code TEXT;
  v_service_label TEXT;
  v_motivo_consulta TEXT;
  v_historico_risco TEXT;
BEGIN
  IF btrim(coalesce(p_recomendacoes, '')) = '' THEN
    RAISE EXCEPTION 'RECOMENDACOES_REQUIRED';
  END IF;

  SELECT *
  INTO v_solicitacao
  FROM public.solicitacoes_exames
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOLICITACAO_EXAME_NOT_FOUND';
  END IF;

  SELECT id, user_id, full_name, specialty
  INTO v_professional
  FROM public.professional_profiles
  WHERE id = p_professional_profile_id
    AND user_id = p_professional_app_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFESSIONAL_PROFILE_NOT_FOUND';
  END IF;

  IF coalesce(v_solicitacao.status, '') = 'completed' THEN
    RAISE EXCEPTION 'SOLICITACAO_EXAME_ALREADY_COMPLETED';
  END IF;

  IF coalesce(v_solicitacao.status, '') <> 'in_progress' THEN
    RAISE EXCEPTION 'SOLICITACAO_EXAME_NOT_IN_PROGRESS';
  END IF;

  IF coalesce(v_solicitacao.payment_status, '') <> 'paid' THEN
    RAISE EXCEPTION 'SOLICITACAO_EXAME_PAYMENT_REQUIRED';
  END IF;

  IF coalesce(v_solicitacao.medico_id, '') <> p_professional_profile_id THEN
    RAISE EXCEPTION 'SOLICITACAO_EXAME_NOT_ASSIGNED_TO_PROFESSIONAL';
  END IF;

  IF coalesce(v_solicitacao.fluxo_destino, 'dashboard') <> 'dashboard'
    OR coalesce(v_solicitacao.tipo, '') NOT IN ('checkup', 'renovacao_receitas') THEN
    RAISE EXCEPTION 'SOLICITACAO_EXAME_DIRECT_FLOW_UNSUPPORTED';
  END IF;

  v_service_code := coalesce(
    nullif(v_solicitacao.service_code, ''),
    CASE
      WHEN v_solicitacao.tipo = 'renovacao_receitas' THEN 'extra_renovacao_receitas'
      ELSE 'extra_checkup'
    END
  );

  v_service_label := CASE
    WHEN v_solicitacao.tipo = 'renovacao_receitas' THEN 'Renovacao de receita'
    ELSE 'Check-up'
  END;

  v_motivo_consulta := CASE
    WHEN v_solicitacao.tipo = 'renovacao_receitas' THEN
      concat_ws(E'\n',
        'Servico extra: Renovacao de receita',
        'Medicamento: ' || coalesce(nullif(v_solicitacao.nome_medicamento, ''), 'Nao informado'),
        'Dosagem: ' || coalesce(nullif(v_solicitacao.dosagem, ''), 'Nao informado'),
        'Frequencia: ' || coalesce(nullif(v_solicitacao.frequencia, ''), 'Nao informado'),
        'Receita anexada: ' || coalesce(nullif(v_solicitacao.arquivo_receita_url, ''), 'Nao informado')
      )
    ELSE
      concat_ws(E'\n',
        'Servico extra: Check-up',
        'Motivo: ' || coalesce(nullif(v_solicitacao.motivo, ''), 'Exames de rotina / check-up preventivo'),
        'Sintomas: ' || coalesce(nullif(v_solicitacao.sintomas, ''), 'Nao informado')
      )
  END;

  v_historico_risco := concat_ws(E'\n',
    CASE
      WHEN v_solicitacao.informacoes_saude IS NOT NULL
        AND v_solicitacao.informacoes_saude <> '{}'::jsonb
        THEN 'Informacoes de saude: ' || v_solicitacao.informacoes_saude::text
      ELSE NULL
    END,
    CASE
      WHEN v_solicitacao.dados_saude IS NOT NULL
        AND v_solicitacao.dados_saude <> '{}'::jsonb
        THEN 'Dados de saude: ' || v_solicitacao.dados_saude::text
      ELSE NULL
    END,
    CASE
      WHEN coalesce(array_length(v_solicitacao.arquivos, 1), 0) > 0
        THEN 'Arquivos: ' || array_to_string(v_solicitacao.arquivos, ', ')
      ELSE NULL
    END,
    CASE
      WHEN coalesce(array_length(v_solicitacao.arquivos_urls, 1), 0) > 0
        THEN 'Arquivos URLs: ' || array_to_string(v_solicitacao.arquivos_urls, ', ')
      ELSE NULL
    END
  );

  IF coalesce(v_solicitacao.consulta_id, '') <> '' THEN
    IF v_solicitacao.consulta_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'SOLICITACAO_EXAME_CONSULTA_LINK_INVALID';
    END IF;

    v_consulta_id := v_solicitacao.consulta_id::UUID;
  ELSE
    INSERT INTO public.consultas (
      paciente_id,
      paciente_nome,
      paciente_email,
      profissional_id,
      profissional_user_id,
      profissional_nome,
      especialidade,
      tipo_consulta,
      status,
      datetime,
      descricao_sintomas,
      inicio_at,
      fim_at,
      sala_id,
      token_sala,
      preco,
      service_code
    )
    VALUES (
      v_solicitacao.paciente_id,
      coalesce(v_solicitacao.paciente_nome, ''),
      coalesce(v_solicitacao.paciente_email, ''),
      p_professional_profile_id,
      p_professional_app_user_id,
      coalesce(v_professional.full_name, ''),
      coalesce(v_professional.specialty, 'Clinico Geral'),
      'especialidade',
      'finalizada',
      v_now::TEXT,
      v_motivo_consulta,
      v_now::TEXT,
      v_now::TEXT,
      '',
      '',
      coalesce(v_solicitacao.quoted_gross_price, 0),
      v_service_code
    )
    RETURNING id INTO v_consulta_id;
  END IF;

  SELECT id
  INTO v_prontuario_id
  FROM public.prontuarios
  WHERE solicitacao_exame_id = v_solicitacao.id::TEXT
     OR consulta_id = v_consulta_id::TEXT
  ORDER BY updated_at DESC NULLS LAST, created_date DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.prontuarios
    SET
      consulta_id = v_consulta_id::TEXT,
      solicitacao_exame_id = v_solicitacao.id::TEXT,
      paciente_id = v_solicitacao.paciente_id,
      profissional_id = p_professional_profile_id,
      modo = 'simples',
      motivo_consulta = v_motivo_consulta,
      historico_risco = coalesce(v_historico_risco, ''),
      recomendacoes = btrim(p_recomendacoes),
      updated_at = v_now
    WHERE id = v_prontuario_id;
  ELSE
    INSERT INTO public.prontuarios (
      consulta_id,
      solicitacao_exame_id,
      paciente_id,
      profissional_id,
      modo,
      motivo_consulta,
      historico_risco,
      exames_imagem,
      exame_fisico,
      avaliacao_diagnostico,
      recomendacoes
    )
    VALUES (
      v_consulta_id::TEXT,
      v_solicitacao.id::TEXT,
      v_solicitacao.paciente_id,
      p_professional_profile_id,
      'simples',
      v_motivo_consulta,
      coalesce(v_historico_risco, ''),
      '',
      '',
      v_service_label,
      btrim(p_recomendacoes)
    )
    RETURNING id INTO v_prontuario_id;
  END IF;

  UPDATE public.solicitacoes_exames
  SET
    status = 'completed',
    completed_at = v_now,
    consulta_id = v_consulta_id::TEXT,
    updated_at = v_now
  WHERE id = v_solicitacao.id;

  RETURN QUERY
  SELECT
    v_solicitacao.id,
    v_consulta_id,
    v_prontuario_id,
    'completed'::TEXT,
    v_now,
    btrim(p_recomendacoes);
END;
$$;
