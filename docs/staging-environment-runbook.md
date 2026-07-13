# Ambiente de Staging

## Arquitetura confirmada

- Frontend estatico Vite/React, build em `dist/` com `npm run build`.
- Gerenciador canonico: npm com `package-lock.json`.
- Backend em Supabase Edge Functions, Postgres, Storage e Auth.
- React chama Edge Functions em `${VITE_SUPABASE_URL}/functions/v1`.
- Planos, pagamentos, Zoom, Deepgram e Groq sao server-side.
- Mapbox e publico no frontend, com token exclusivo de staging e restrito por dominio quando o servico permitir.
- Hosting ainda indefinido: `(DEFINIR PROVEDOR DE HOSPEDAGEM)` e `(DEFINIR DOMINIO DE STAGING)`.

Ambientes canonicos: `development`, `staging` e `production`. No staging, `VITE_APP_ENV` e `APP_ENV` devem ser `staging`.

## Arquivos de ambiente

Use arquivos locais ignorados pelo Git:

- `.env.staging`: somente variaveis publicas do frontend.
- `.env.staging.secrets`: somente variaveis server-side/Supabase Secrets.

Exemplos versionados:

- `.env.staging.example`
- `.env.staging.secrets.example`

Validacao recomendada:

```powershell
npm run check:staging -- --frontend .env.staging --secrets .env.staging.secrets --linked
```

`--config <arquivo>` continua aceito para compatibilidade, mas o formato separado evita confundir secrets com variaveis enviadas ao bundle.

## Variaveis publicas do frontend

| Variavel | Finalidade |
| --- | --- |
| `VITE_APP_ENV` | Ambiente explicito do bundle |
| `VITE_SUPABASE_URL` | URL publica do Supabase de staging |
| `VITE_SUPABASE_ANON_KEY` | Chave publica anon/publishable |
| `VITE_SITE_URL` | Origem HTTPS canonica do frontend |
| `VITE_MAPBOX_TOKEN` | Token publico Mapbox de staging, restrito por dominio |
| `VITE_ENABLE_PAYMENT_SIMULATION` | Obrigatoriamente `false` |

`VITE_BACKEND_FUNCTIONS_URL`, `VITE_BACKEND_PUBLISHABLE_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY` sao aliases legados. Nao use no staging.

## Server-side e Supabase Secrets

Configurar manualmente como Supabase Secrets/ambiente server-side:

- Base: `APP_ENV`, `APP_BASE_URL`, `EDGE_ALLOWED_ORIGINS`.
- Pagamentos: `PAYMENT_PROVIDER`, `ENABLE_PAYMENT_SIMULATION`, credencial sandbox e webhook secret do provider escolhido.
- Planos: `PLANS_SERVICE_BASE_URL`, `PLANS_SERVICE_INTERNAL_API_KEY`, `PLANS_SERVICE_TIMEOUT_MS`.
- Zoom: `ZOOM_VIDEO_SDK_KEY`, `ZOOM_VIDEO_SDK_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN`.
- Deepgram: `DEEPGRAM_API_KEY`, `DEEPGRAM_TIMEOUT_MS`.
- Groq: `GROQ_API_KEY`, `GROQ_TIMEOUT_MS`, `GROQ_MAX_TRANSCRIPT_CHARS`.

Fornecidas pelo runtime remoto do Supabase Edge Functions, sem exigir configuracao manual duplicada no staging remoto:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Para execucao local de Edge Functions, essas tres podem precisar ser configuradas localmente em arquivo seguro. Nenhum secret deve usar prefixo `VITE_`.

## Supabase Auth

Use `STAGING_SITE_URL=(DEFINIR)` como parametro operacional.

Checklist no Dashboard do projeto de staging:

1. `Site URL`: `STAGING_SITE_URL`.
2. Redirect de login: rotas reais do staging.
3. Confirmacao de e-mail: origem `STAGING_SITE_URL`.
4. Recuperacao de senha: `${STAGING_SITE_URL}/RecuperarSenha?mode=reset`.
5. Logout/retorno: origem `STAGING_SITE_URL`.
6. Variante com ou sem `www`: configurar somente se ela realmente servir staging; definir uma canonica.
7. Localhost: manter apenas em development, nao no projeto de staging.

O frontend usa `VITE_SITE_URL`; nao deve aceitar origem livre por parametro externo.

## CORS

`EDGE_ALLOWED_ORIGINS` deve conter uma unica origem HTTPS canonica, igual a `VITE_SITE_URL`. Development/teste podem usar localhost por default; staging falha fechado quando a origem nao estiver configurada.

Webhooks assinados nao dependem de CORS de navegador.

## Pagamentos

- `PAYMENT_PROVIDER`: `stripe` ou `mercadopago`.
- `mock` e `internal_simulated` sao proibidos em staging.
- `ENABLE_PAYMENT_SIMULATION=false`.
- `VITE_ENABLE_PAYMENT_SIMULATION=false`.
- Credenciais apenas sandbox/teste.
- Webhooks sandbox apontando para Edge Functions de staging, com secret configurado.
- Retorno visual do gateway nao libera recurso.
- `simulate-payment-paid` nao deve ser publicada em staging.

## Planos

Usar somente server-side:

- `PLANS_SERVICE_BASE_URL`: URL de staging/sandbox do plans-service.
- `PLANS_SERVICE_INTERNAL_API_KEY`: chave interna separada da producao.
- `PLANS_SERVICE_TIMEOUT_MS`: timeout explicito.

Nao existe fallback para mock e nenhuma chave de planos deve aparecer no frontend.

## Zoom, Deepgram e Groq

- Zoom: secret e webhook secret server-side; tokens temporarios; consentimento de telemedicina antes do token do paciente.
- Deepgram: chave permanente server-side; token temporario; timeout; consentimento de transcricao.
- Groq: chave server-side; timeout e limite; depende dos consentimentos; sem prompt/transcricao em logs.

Nao usar credenciais de producao nos testes de staging.

## Mapbox

`VITE_MAPBOX_TOKEN` e publico, mas deve ser token de staging, restrito por dominio e sem permissao administrativa.

## Storage

| Bucket | Visibilidade | Observacao |
| --- | --- | --- |
| `uploads` | Privado | Documentos, anexos e paths autorizados por Edge Functions |
| `home-banners` | Privado | Leitura publica controlada por `read-home-banners` |
| `privacy-exports` | Privado | Exportacoes temporarias com URL assinada curta |

Nao tornar bucket inteiro publico para resolver acesso.

## Hosting

Pendente de decisao:

- `(DEFINIR PROVEDOR DE HOSPEDAGEM)`.
- `(DEFINIR DOMINIO DE STAGING)`.
- `(CONFIGURAR FALLBACK SPA CONFORME O PROVEDOR)`.
- `(CONFIGURAR HEADERS CONFORME O PROVEDOR)`.

Nao adicionar configuracoes de Vercel, Netlify, Cloudflare ou outro provider ate o provider real ser definido.

Headers minimos quando o provider permitir:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- protecao contra embedding indevido
- HSTS apenas apos HTTPS integral
- CSP inicialmente report-only ou documentada para validacao, para nao quebrar Supabase, Zoom, Mapbox ou gateways

## Functions afetadas por esta fase

Use o script focado:

```powershell
pwsh ./scripts/deploy-staging-functions.ps1 -ListOnly
pwsh ./scripts/deploy-staging-functions.ps1
```

O script usa `npx supabase functions deploy`, depende do projeto Supabase ja estar linked e exclui `simulate-payment-paid`.

Motivos de deploy:

- Functions que importam `_shared/http.ts` recebem a nova politica de CORS/ambiente.
- Functions que importam `_shared/cors-policy.ts` transitivamente via `_shared/http.ts`.
- `join-queue`, `create-appointment`, `check-plan-coverage` e `accept-queue-entry` dependem dos helpers de planos alterados.
- `deepgram-token`, `groq-completion` e `zoom-token` foram alteradas diretamente.
- `accept-appointment` e `create-appointment` tiveram repositorios alterados diretamente.

## Supabase CLI

Validar antes de deploy:

```powershell
npm run check:supabase-functions-config
npx supabase db lint --linked
npx supabase db push --linked --dry-run
```

As 67 Functions implantaveis estao representadas em `supabase/config.toml`. Functions autenticadas com `verify_jwt=false` devem manter autenticacao manual no handler; webhooks usam assinatura propria.

## Ordem operacional

1. Definir `(DEFINIR PROVEDOR DE HOSPEDAGEM)` e `(DEFINIR DOMINIO DE STAGING)`.
2. Configurar `.env.staging` e `.env.staging.secrets` locais com valores de staging.
3. Rodar `npm run check:staging -- --frontend .env.staging --secrets .env.staging.secrets --linked`.
4. Rodar build e testes focados.
5. Conferir Supabase Auth, CORS, secrets e providers sandbox.
6. Rodar dry-run de migrations.
7. Aplicar migrations pendentes, se houver.
8. Deploy das Functions afetadas com `scripts/deploy-staging-functions.ps1`.
9. Publicar frontend no provider escolhido.
10. Rodar smoke tests e revisar logs sanitizados.

## Rollback

- Frontend: republicar commit/artefato anterior.
- Edge Functions: redeploy da versao anterior pelo Git.
- Banco: migrations sao forward-only; usar migration reparadora ou restore de backup em incidente grave.
- Secrets: rotacionar no provider e no Supabase, sem registrar valores antigos.

## Bloqueios atuais

- `(DEFINIR PROVEDOR DE HOSPEDAGEM)`.
- `(DEFINIR DOMINIO DE STAGING)`.
- `(CONFIGURAR FALLBACK SPA CONFORME O PROVEDOR)`.
- `(CONFIGURAR HEADERS CONFORME O PROVEDOR)`.
- Preencher `.env.staging` e `.env.staging.secrets`.
- Confirmar que `simulate-payment-paid` nao esta publicada no projeto de staging.
