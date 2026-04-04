const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-legacy-session-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const groqApiKey = Deno.env.get('GROQ_API_KEY')?.trim();

    if (!groqApiKey) {
      console.error('[groq-completion] Missing GROQ_API_KEY');
      return jsonResponse({ error: 'Groq API key not configured.' }, 500);
    }

    const body = await req.json();
    const transcript = body?.transcript;

    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return jsonResponse({ error: 'Campo "transcript" é obrigatório.' }, 400);
    }

    const prompt = `Você é um médico brasileiro experiente. Organize a transcrição da consulta no formato JSON exatamente com estes campos:

{
  "motivo_da_consulta": "...",
  "historico_e_fatores_de_risco": "...",
  "exames_imagens": "...",
  "exame_fisico": "...",
  "avaliacao_diagnostica": "...",
  "recomendacoes_e_conduta": "..."
}

Transcrição completa da consulta:
"""${transcript.trim()}"""

Responda APENAS com o JSON válido, sem nenhum texto adicional.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[groq-completion] Groq API error:', response.status, errorText);
      return jsonResponse({ error: 'Erro ao chamar a API do Groq.' }, 502);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return jsonResponse({ error: 'A IA não retornou conteúdo válido.' }, 502);
    }

    return jsonResponse({ content });
  } catch (error) {
    console.error('[groq-completion]', error);
    return jsonResponse({ error: 'Erro interno ao processar transcrição.' }, 500);
  }
});
