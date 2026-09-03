# Contexto de continuidade — Backoffice administrativo

Este documento descreve a área administrativa isolada criada para o Rápido Doutor. Leia-o antes de alterar o backoffice, autenticação administrativa, aprovação de profissionais ou suas migrations.

## Objetivo e escopo

O backoffice é uma área administrativa independente do app público. Ele não utiliza `app_users.role = 'admin'` e não compartilha a sessão normal de paciente/profissional.

Rotas atuais:

- `/admin/login`
- `/admin/backoffice`
- `/admin/backoffice/pending-registrations`
- `/admin/backoffice/analytics`

Menus atuais:

1. Cadastros pendentes.
2. Análise de dados.

O módulo foi desenhado para novos menus serem adicionados sem misturar regras administrativas em `src/pages`, `src/client-api` ou `src/services` do aplicativo normal.

## Visão ponta a ponta

```text
Navegador (/admin/login)
  → src/backoffice/api/auth.ts
  → backoffice-login
  → admin_users (service_role)
  → token JWT administrativo
  → localStorage rd.backoffice.session.v1

Navegador (/admin/backoffice/...)
  → ProtectedBackofficeRoute
  → BackofficeAuthProvider / backoffice-me
  → token Bearer administrativo
  → requireActiveBackofficeAdmin
  → Function específica
  → PostgreSQL (service_role / RPC)
```

O token Supabase de um paciente, profissional ou administrador do aplicativo público não é aceito como token administrativo. Reciprocamente, o JWT do backoffice não é um access token Supabase e não deve ser usado nas Functions normais do app.

## Comportamento das rotas

| Rota | Quem entra | Componente | Resultado |
|---|---|---|---|
| `/admin/login` | visitante ou admin sem sessão | `BackofficeLoginPage` | formulário de e-mail/senha; admin já autenticado é redirecionado. |
| `/admin/backoffice` | admin válido | `BackofficeRoutes` | redireciona para pendências. |
| `/admin/backoffice/pending-registrations` | admin válido | `PendingProfessionalsPage` | lista profissionais privados com status `pending`. |
| `/admin/backoffice/analytics` | admin válido | `AnalyticsPage` | mostra os três totais agregados. |

`ProtectedBackofficeRoute` é proteção de experiência de usuário, não barreira de segurança. A barreira definitiva é `requireActiveBackofficeAdmin` no backend.

## Fluxo de login e sessão

1. O usuário envia e-mail e senha em `BackofficeLoginPage`.
2. `api/auth.ts` chama `backoffice-login` pelo cliente isolado.
3. A Function normaliza o e-mail e busca exclusivamente `admin_users` com service-role.
4. Ela compara a senha ao hash PBKDF2 armazenado.
5. Contas inexistentes, inativas ou com senha inválida recebem a mesma resposta `401 ADMIN_LOGIN_INVALID`, evitando enumeração de e-mails.
6. Em sucesso, a Function emite JWT HS256 com `sub=admin_users.id`, e-mail, emissão e expiração.
7. O hook salva `{ accessToken, expiresAt, admin }` em `rd.backoffice.session.v1`.
8. Em refresh da página, o provider chama `backoffice-me`; se o JWT estiver expirado, inválido ou o admin estiver inativo, limpa a sessão.
9. Logout apenas remove a sessão administrativa local; não encerra sessão Supabase nem modifica `app_users`.

Não há refresh token administrativo nesta versão. Ao expirar, o admin deve fazer login novamente.

## Contratos HTTP

Todas as Functions usam `POST` para operações do frontend e devolvem o envelope padrão:

```json
{
  "data": {},
  "meta": { "requestId": "uuid" }
}
```

Erros usam:

```json
{
  "error": {
    "code": "CODIGO",
    "message": "Mensagem pública",
    "details": null,
    "requestId": "uuid"
  }
}
```

| Function | Auth | Request | Response de sucesso |
|---|---|---|---|
| `backoffice-login` | nenhuma | `{ email, password }` | `{ admin: { id, email }, session: { accessToken, expiresAt } }` |
| `backoffice-me` | Bearer admin | `{}` | `{ admin: { id, email } }` |
| `backoffice-pending-professionals` | Bearer admin | `{ limit?: 1..200 }` | `{ professionals: Professional[] }` |
| `backoffice-review-professional` | Bearer admin | `{ professionalProfileId, action, reason? }` | `{ professional: { professional_profile_id, status, is_verified } }` |
| `backoffice-analytics-summary` | Bearer admin | `{}` | `{ totalProfessionals, totalUsers, totalCompletedConsultations }` |

O cliente atual sempre envia `{}` onde a Function não precisa de parâmetros. Se uma Function administrativa nova aceitar corpo opcional, mantenha o parser tolerante a `{}` e não aceite campos que possam mudar autorização, preço ou ownership.

## Dados retornados ao frontend

`backoffice-pending-professionals` retorna estritamente:

```text
id, full_name, profession, specialty, register_number,
register_state, phone, cpf, created_date, status
```

CPF e telefone são deliberadamente retornados por serem necessários ao fluxo administrativo solicitado. São dados pessoais: não adicionar a logs, toast, analytics de browser ou URLs. Não retornar diploma, fotos, endereço, dados bancários ou `password_hash` sem uma necessidade administrativa formal e um novo controle de acesso.

## Autorização no backend

`requireActiveBackofficeAdmin(req, client)` é obrigatório em toda Function administrativa autenticada. Ele executa, nesta ordem:

1. exige `Authorization: Bearer <token>`;
2. valida estrutura JWT de três partes;
3. exige `HS256` e issuer `rapido-doutor-backoffice`;
4. recalcula e compara assinatura HMAC SHA-256 com `ADMIN_JWT_SECRET`;
5. exige `exp` futuro e payload com `sub`/e-mail;
6. busca `admin_users` pelo `sub`;
7. exige e-mail igual ao do token e `is_active=true`;
8. retorna somente `{ id, email }`.

Como as Functions usam `service_role`, RLS não substitui essas verificações. Toda Function nova precisa validar o admin antes de consultar dados sensíveis ou executar RPC.

## Fluxo de cadastros pendentes

### Leitura

`PendingProfessionalsPage` usa React Query para chamar `backoffice-pending-professionals`.

Backend:

1. preflight CORS, se aplicável;
2. método `POST`;
3. corpo com `limit` entre 1 e 200;
4. `requireActiveBackofficeAdmin`;
5. consulta `professional_profiles` com `status='pending'`;
6. ordena `created_date ASC`;
7. devolve até o limite solicitado.

### Aprovação/reprovação

A tela mostra confirmação antes da mutação. Ao confirmar:

1. envia o UUID e `approve` ou `reject`;
2. backend valida UUID, ação e tamanho do motivo;
3. valida token administrativo ativo;
4. chama `review_backoffice_professional` por service-role;
5. a RPC bloqueia o perfil com `FOR UPDATE`;
6. a RPC recusa perfil inexistente ou que não esteja `pending`;
7. atualiza perfil privado e, quando pendente, a projeção pública;
8. cria evento de auditoria;
9. retorna estado atualizado;
10. React Query invalida a lista de pendências e o cache público de profissionais.

A aprovação não cria usuário, não edita credenciais, não ativa plantão e não altera pagamentos, consultas ou planos.

### Concorrência

O lock na RPC resolve duas revisões simultâneas para o mesmo perfil. A primeira muda o status; a segunda, ao obter o lock, recebe `409 PROFESSIONAL_PROFILE_NOT_PENDING`. Não substituir a RPC por duas atualizações comuns no browser ou em uma Edge Function.

## Fluxo de indicadores

`AnalyticsPage` chama `backoffice-analytics-summary` uma vez por ciclo normal do React Query.

O backend autentica o admin e executa três contagens independentes, em paralelo:

| Indicador | Consulta lógica |
|---|---|
| Médicos cadastrados | todos os registros de `professional_profiles` |
| Usuários cadastrados | todos os registros de `app_users` |
| Consultas realizadas | `consultas` com `status='finalizada'` |

Os totais são globais, não filtrados por período, status de profissional ou atividade de usuário. Para evoluir a análise, definir explicitamente período, timezone, semântica de canceladas e índices antes de criar filtros ou gráficos.

## Estrutura frontend

Todo o código específico fica em `src/backoffice/`:

```text
src/backoffice/
├── api/
│   ├── analytics.ts
│   ├── auth.ts
│   ├── client.ts
│   ├── pendingProfessionals.ts
│   └── session.ts
├── components/
│   ├── BackofficeLayout.tsx
│   ├── BackofficeSidebar.tsx
│   └── ProtectedBackofficeRoute.tsx
├── hooks/
│   └── useBackofficeAuth.tsx
├── pages/
│   ├── AnalyticsPage.tsx
│   ├── BackofficeLoginPage.tsx
│   └── PendingProfessionalsPage.tsx
├── BackofficeRoutes.tsx
└── types.ts
```

`src/App.tsx` somente registra `path="/admin/*"` e carrega `BackofficeRoutes` lazy. O backoffice não usa o layout público (`Layout.jsx`) nem `AuthContext`.

### Sessão no browser

- Chave: `rd.backoffice.session.v1`.
- Nunca reutilizar `rd.auth.session.v1`.
- A sessão armazena `accessToken`, `expiresAt` e dados mínimos do admin (`id`, `email`).
- `BackofficeAuthProvider` restaura e consulta `backoffice-me` ao inicializar.
- `ProtectedBackofficeRoute` bloqueia sessão inexistente ou expirada.
- Erro 401 do backend é a garantia final; toda nova API administrativa deve continuar validando no servidor.

### Client API

`src/backoffice/api/client.ts` é propositalmente separado de `src/client-api/edgeFunctions.js`, pois este último conhece a sessão normal Supabase. Ele envia:

```http
apikey: <publishable-key>
Authorization: Bearer <admin-token>
```

Nunca chame uma Function administrativa por `invokeEdgeFunction` com `authMode: 'session'`, porque isso enviaria token de paciente/profissional.

### React Query

- Cadastros pendentes: `['backoffice', 'pending-professionals']`.
- Indicadores: `['backoffice', 'analytics-summary']`.
- Após revisão, invalidar pelo menos a query de pendências. A implementação atual também invalida `['professionals']` para atualizar eventuais projeções públicas já carregadas.

## Banco de dados

Migrations:

- `supabase/migrations/20260902090000_create_backoffice_admin_users.sql`;
- `supabase/migrations/20260903090000_fix_backoffice_professional_review_rpc.sql`.

### `admin_users`

Campos:

- `id UUID PK`;
- `email`, obrigatório, único, minúsculo/normalizado e não vazio;
- `password_hash`, obrigatório e nunca retornado ao frontend;
- `is_active`, obrigatório, default `true`;
- `created_at`, `updated_at`.

Segurança:

- `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`;
- `anon` e `authenticated` não têm acesso;
- somente `service_role` possui grant;
- trigger reutiliza `public.update_updated_at_column()`.

### `backoffice_audit_events`

Registra pelo menos a aprovação/reprovação de profissional:

- `admin_user_id` FK para `admin_users`;
- ação;
- tipo/id da entidade;
- metadados mínimos;
- data de criação.

Também possui RLS forçada e acesso exclusivamente service-role.

## Autenticação administrativa

Shared helper: `supabase/functions/_shared/backofficeAuth.ts`.

### Formato de senha

Não há senha em texto puro no banco. O formato obrigatório é:

```text
PBKDF2$SHA-256$<iterations>$<salt-base64url>$<hash-base64url>
```

O gerador oficial é:

```bash
node scripts/generate-backoffice-password-hash.mjs
```

Ele solicita senha de forma mascarada e imprime apenas o hash. Não colocar senha ou hash real em migration, código, `.env`, issue ou logs.

### Token

- JWT HS256 próprio, emitido somente por `backoffice-login`;
- issuer: `rapido-doutor-backoffice`;
- payload mínimo: `sub`, `email`, `iat`, `exp`;
- segredo: `ADMIN_JWT_SECRET`;
- TTL: `ADMIN_SESSION_TTL_SECONDS`, padrão de 8 horas, intervalo aceito de 5 minutos a 24 horas.

`requireActiveBackofficeAdmin` exige bearer token, verifica assinatura/expiração, busca `admin_users` e exige `is_active=true`. Logo, desativar o administrador no banco invalida a sessão no próximo uso.

## Edge Functions

Todas estão em `supabase/config.toml` com `verify_jwt=false`, como o restante do projeto. Isso não as torna públicas: a validação de JWT administrativo é manual e obrigatória.

| Function | Responsabilidade |
|---|---|
| `backoffice-login` | Valida e-mail/senha PBKDF2 e emite sessão própria. |
| `backoffice-me` | Confirma token, existência e atividade do admin. |
| `backoffice-pending-professionals` | Lista `professional_profiles.status='pending'`. |
| `backoffice-review-professional` | Revisa um perfil pendente via RPC transacional. |
| `backoffice-analytics-summary` | Retorna totais administrativos. |

As Functions com regra relevante seguem o padrão atual:

```text
index.ts → handler.ts → validation.ts → service.ts → repository.ts
```

Ao criar Function nova, reutilizar `_shared/http.ts`, `_shared/errors.ts`, `_shared/supabase.ts` e `requireActiveBackofficeAdmin`.

Não usar `requireAuthenticatedUser`, `requireAppUserByAuthUserId` ou `app_users.role` em backoffice: isso quebraria o isolamento exigido.

### CORS e preflight

Helper: `supabase/functions/_shared/backofficeCors.ts`.

O CORS administrativo é deliberadamente separado do helper CORS padrão do projeto. O helper padrão aplica allowlist de origens e pode devolver `403` em um preflight quando a origem administrativa não estiver configurada. Para o backoffice, a especificação atual exige resposta permissiva:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

As cinco Functions chamam `handleBackofficePreflight(req)` como a primeira instrução do handler. Quando o método é `OPTIONS`, a resposta é `204 No Content`, sem executar validação de método, body, token, banco ou regra de negócio.

Ao criar uma nova Function do backoffice, seguir exatamente este início:

```ts
const preflight = handleBackofficePreflight(req);
if (preflight) return preflight;
```

Depois disso, usar `BACKOFFICE_CORS` em `ensureMethod`, `successResponse` e `errorResponse`, para que as respostas normais também tenham os mesmos headers.

## Aprovação de profissionais

Fonte da tela: `professional_profiles`, filtrada por `status='pending'`.

O review recebe:

```json
{
  "professionalProfileId": "uuid",
  "action": "approve | reject",
  "reason": "opcional, até 500 caracteres"
}
```

A Function chama a RPC `public.review_backoffice_professional(...)`, criada na migration. A RPC:

1. bloqueia o perfil privado com `FOR UPDATE`;
2. exige `professional_profiles.status = 'pending'`;
3. aprova (`approved`, `is_verified=true`) ou reprova (`rejected`, `is_verified=false`);
4. mantém `is_on_duty=false`;
5. sincroniza a projeção pública somente se ela estiver `pending_review`;
6. registra `backoffice_audit_events`;
7. retorna o perfil atualizado.

### Correção de ambiguidade da RPC

A primeira versão da RPC retornava colunas chamadas `professional_profile_id` e `status`, mas também usava esses mesmos nomes sem prefixo no `UPDATE professional_public_profiles`. Em PL/pgSQL, os nomes de saída tornam-se variáveis e colidem com colunas não qualificadas; a aprovação falhava com referência ambígua antes de gravar a auditoria.

A migration `20260903090000_fix_backoffice_professional_review_rpc.sql` recria a mesma assinatura da RPC, mas qualifica as colunas com aliases (`public_profile.status`, `public_profile.professional_profile_id`). Ela também envia `NOTIFY pgrst, 'reload schema'` para atualizar o cache de RPC do PostgREST depois da aplicação.

Não editar a migration original já aplicada para essa correção; migrations corretivas devem sempre ser novas.

### Por que sincronizar o perfil público?

O projeto possui dois perfis profissionais:

- `professional_profiles`: dados privados e status de aprovação;
- `professional_public_profiles`: projeção para busca/perfil público.

O fluxo legado/moderno já exige os dois aprovados para visibilidade e plantão. Atualizar apenas o perfil privado criaria profissionais aprovados, mas invisíveis e incapazes de atender. A sincronização é limitada ao perfil público ainda `pending_review`, portanto não sobrescreve estados públicos posteriores, como suspensão.

## Indicadores

`backoffice-analytics-summary` retorna:

```json
{
  "totalProfessionals": 0,
  "totalUsers": 0,
  "totalCompletedConsultations": 0
}
```

Fontes:

- profissionais: total de `professional_profiles`;
- usuários: total de `app_users`;
- consultas realizadas: `consultas.status = 'finalizada'`.

`finalizada` foi confirmado no schema e no fluxo `finish-consulta`; não substituir por `completed`, que é status de appointment/fila e não de `consultas`.

## Deploy e primeiro administrador

1. Aplicar a migration.
2. Configurar secrets no Supabase:

```bash
supabase secrets set ADMIN_JWT_SECRET="<segredo-aleatorio-forte>"
supabase secrets set ADMIN_SESSION_TTL_SECONDS="28800"
```

3. Publicar as cinco Functions do backoffice.
4. Gerar hash:

```bash
node scripts/generate-backoffice-password-hash.mjs
```

5. Criar o primeiro registro:

```sql
insert into public.admin_users (email, password_hash, is_active)
values (
  lower(trim('admin@example.com')),
  'PBKDF2$SHA-256$310000$<salt>$<hash>',
  true
);
```

O arquivo `docs/BACKOFFICE_SETUP.md` contém uma versão operacional resumida dessas instruções.

Comandos de publicação:

```bash
supabase functions deploy backoffice-login --no-verify-jwt
supabase functions deploy backoffice-me --no-verify-jwt
supabase functions deploy backoffice-pending-professionals --no-verify-jwt
supabase functions deploy backoffice-review-professional --no-verify-jwt
supabase functions deploy backoffice-analytics-summary --no-verify-jwt
```

O `--no-verify-jwt` é intencional: o gateway não entende o JWT administrativo próprio. Não remover a validação interna de `requireActiveBackofficeAdmin` por causa dessa flag.

## Códigos de erro relevantes

| Código | Significado esperado | Tratamento de UI sugerido |
|---|---|---|
| `ADMIN_LOGIN_INVALID` | e-mail/senha inválidos ou admin inativo | mensagem genérica de login; não diferenciar causa. |
| `ADMIN_AUTHORIZATION_REQUIRED` | header Bearer ausente | limpar sessão e redirecionar ao login. |
| `ADMIN_TOKEN_INVALID` | token inválido/expirado | limpar sessão e redirecionar ao login. |
| `ADMIN_SESSION_REVOKED` | admin removido/inativo ou e-mail divergente | limpar sessão e redirecionar ao login. |
| `PROFESSIONAL_PROFILE_NOT_FOUND` | UUID não existe | mostrar erro e atualizar lista. |
| `PROFESSIONAL_PROFILE_NOT_PENDING` | outro admin já revisou ou perfil não é pendente | mostrar conflito e invalidar lista. |
| `LIMIT_INVALID` | listagem fora do intervalo permitido | erro de implementação; não reenviar sem corrigir. |

## CORS e diagnóstico de navegador

Para qualquer uma das cinco Functions, a chamada de navegador gera preflight porque há `Authorization` e `Content-Type: application/json`.

O comportamento esperado é:

```text
OPTIONS /functions/v1/backoffice-*
→ 204
→ Access-Control-Allow-Origin: *
→ Access-Control-Allow-Headers contém authorization, x-client-info, apikey, content-type
→ Access-Control-Allow-Methods contém GET, POST, PUT, PATCH, DELETE, OPTIONS
```

Se `OPTIONS` ainda responder 403 depois de publicar:

1. confirmar que todas as cinco Functions foram redeployadas;
2. confirmar que o projeto Supabase correto recebeu o deploy;
3. verificar que o navegador não está chamando uma URL antiga de Edge Functions;
4. inspecionar se a resposta veio do gateway/proxy anterior ao runtime da Function;
5. repetir a requisição sem cache/cached service worker.

Não trocar o preflight por validação de admin: o navegador não envia o bearer token em `OPTIONS` e o preflight não deve acessar banco.

## Limites e não objetivos da versão atual

- Não existe criação de administradores pelo browser.
- Não existe recuperação/troca de senha administrativa.
- Não existe refresh token administrativo, MFA, rate limit específico ou revogação individual de token.
- Não existe filtro, paginação por cursor ou busca na lista de pendências; há apenas `limit` até 200.
- O campo `reason` já é aceito e auditado, mas a UI atual não possui campo para preenchê-lo.
- Não existem gráficos, filtros temporais ou exportação na análise.
- Não existe gerenciamento de `admin_users` pela UI.

Esses itens devem ser tratados como novas features, cada uma com revisão de segurança, migration quando aplicável, autorização e testes. Não implementar atalhos usando `app_users` ou acesso direto do frontend à tabela `admin_users`.

## Como estender

Para adicionar menu novo:

1. criar API em `src/backoffice/api/`;
2. criar página em `src/backoffice/pages/`;
3. incluir link em `BackofficeSidebar.tsx`;
4. incluir rota filha em `BackofficeRoutes.tsx`;
5. criar Edge Function dedicada, autenticada por `requireActiveBackofficeAdmin`;
6. criar migration apenas se houver entidade/persistência nova;
7. definir query keys e invalidações no escopo `['backoffice', ...]`;
8. avaliar ownership, estados, auditoria, concorrência e dados pessoais.

Nunca ampliar o `select` de pendências sem necessidade: CPF e telefone já são dados pessoais acessíveis somente porque a tela administrativa atual os requer.

## Verificações realizadas e pendências

Executados com sucesso:

```text
git diff --check
node --check scripts/generate-backoffice-password-hash.mjs
npm run check:supabase-functions-config
```

O último comando confirmou 72 Functions configuradas.

`npm run build` e `npm run lint` não foram executados neste ambiente porque `node_modules` não existe e a instalação de dependências foi bloqueada pelo sandbox. Antes do deploy, executar em ambiente autorizado:

```bash
npm ci
npm run build
npm run lint
```

Também falta aplicar a migration e publicar Functions no Supabase; nenhum ambiente remoto foi alterado durante a implementação.
