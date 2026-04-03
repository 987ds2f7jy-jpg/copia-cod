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
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY')?.trim();

    if (!deepgramApiKey) {
      console.error('[deepgram-token] Missing DEEPGRAM_API_KEY');
      return jsonResponse({ error: 'Deepgram not configured.' }, 500);
    }

    // Create a temporary API key via Deepgram REST API
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { 'Authorization': `Token ${deepgramApiKey}` },
    });

    if (!response.ok) {
      console.error('[deepgram-token] Failed to list projects:', response.status);
      return jsonResponse({ error: 'Failed to authenticate with Deepgram.' }, 502);
    }

    const projectsData = await response.json();
    const projectId = projectsData?.projects?.[0]?.project_id;

    if (!projectId) {
      console.error('[deepgram-token] No Deepgram project found');
      return jsonResponse({ error: 'No Deepgram project found.' }, 500);
    }

    // Create a temporary key that expires in 60 seconds
    const keyResponse = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: 'Temporary transcription key',
        scopes: ['usage:write'],
        time_to_live_in_seconds: 60,
      }),
    });

    if (!keyResponse.ok) {
      const errText = await keyResponse.text();
      console.error('[deepgram-token] Failed to create temp key:', keyResponse.status, errText);
      return jsonResponse({ error: 'Failed to create temporary Deepgram key.' }, 502);
    }

    const keyData = await keyResponse.json();

    console.info('[deepgram-token] Temporary key created successfully');

    return jsonResponse({
      key: keyData.key,
      expiresIn: 60,
    });
  } catch (error) {
    console.error('[deepgram-token]', error);
    return jsonResponse({ error: 'Internal error generating Deepgram token.' }, 500);
  }
});
