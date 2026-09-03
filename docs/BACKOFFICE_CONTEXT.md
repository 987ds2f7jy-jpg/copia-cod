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

Migration: `supabase/migrations/20260902090000_create_backoffice_admin_users.sql`.

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
