const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY')?.trim();

    if (!deepgramApiKey) {
      console.error('[deepgram-token] Missing DEEPGRAM_API_KEY');
      return jsonResponse({ error: 'Deepgram not configured.' }, 500);
    }

    // Validate the key works by hitting a lightweight endpoint
    const validateResponse = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { 'Authorization': `Token ${deepgramApiKey}` },
    });

    if (!validateResponse.ok) {
      console.error('[deepgram-token] Invalid Deepgram API key:', validateResponse.status);
      return jsonResponse({ error: 'Invalid Deepgram API key.' }, 502);
    }

    console.info('[deepgram-token] Key validated successfully');

    return jsonResponse({ key: deepgramApiKey });
  } catch (error) {
    console.error('[deepgram-token]', error);
    return jsonResponse({ error: 'Internal error.' }, 500);
  }
});
