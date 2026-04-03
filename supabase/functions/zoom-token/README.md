# zoom-token

Edge Function responsavel por emitir a assinatura do Zoom Video SDK para cada consulta.

## Secrets obrigatorios

Configure estes secrets no Supabase, nunca no frontend:

- `ZOOM_VIDEO_SDK_KEY`
- `ZOOM_VIDEO_SDK_SECRET`

Os dados de `API Key` e `API Secret` nao sao necessarios para este fluxo de videochamada.

## Deploy

```bash
supabase secrets set ZOOM_VIDEO_SDK_KEY=...
supabase secrets set ZOOM_VIDEO_SDK_SECRET=...
supabase functions deploy zoom-token
```

## Fluxo

1. O frontend chama `zoom-token` informando a `consultationId`.
2. A funcao valida o usuario por sessao Supabase Auth ou token legado.
3. A funcao confirma se o usuario e o paciente ou o profissional daquela consulta.
4. A assinatura retornada vale apenas para a sessao daquela consulta.
