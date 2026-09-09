# Backoffice administrativo

O backoffice usa uma identidade separada de `app_users`. Não reutilize usuários de paciente, profissional ou o role administrativo do aplicativo público.

## Secrets de Edge Functions

Configure no Supabase, nunca em variáveis `VITE_*`:

```bash
supabase secrets set ADMIN_JWT_SECRET="<segredo-aleatorio-com-pelo-menos-32-bytes>"
supabase secrets set ADMIN_SESSION_TTL_SECONDS="28800"
```

`ADMIN_SESSION_TTL_SECONDS` aceita de 300 segundos a 24 horas; o padrão é oito horas.

## Criar o primeiro administrador

Após aplicar a migration, gere um hash PBKDF2 sem colocar senha na linha de comando:

```bash
node scripts/generate-backoffice-password-hash.mjs
```

Copie somente a saída gerada e execute no SQL Editor, substituindo os valores de exemplo:

```sql
insert into public.admin_users (email, password_hash, is_active)
values (
  lower(trim('admin@example.com')),
  'PBKDF2$SHA-256$310000$<salt>$<hash>',
  true
);
```

O hash e a senha não devem ser incluídos em migrations, commits, arquivos `.env`, logs ou tickets.

## Acesso

1. Abra `/admin/login`.
2. Entre com o e-mail e a senha do registro em `admin_users`.
3. A sessão é armazenada exclusivamente em `rd.backoffice.session.v1`.
4. A rota protegida é `/admin/backoffice`; ela redireciona para `pending-registrations`.

O token é assinado com `ADMIN_JWT_SECRET`, tem expiração e é validado a cada Edge Function contra `admin_users.is_active`. Desativar o registro no banco invalida a sessão no próximo uso.

## Deploy

Além da migration, publique as cinco funções:

```text
backoffice-login
backoffice-me
backoffice-pending-professionals
backoffice-review-professional
backoffice-analytics-summary
```

Todas utilizam `service_role` internamente e recusam acesso direto sem token administrativo. A função de revisão utiliza uma RPC transacional para manter `professional_profiles` e a projeção pública atual alinhadas, além de registrar `backoffice_audit_events`.
