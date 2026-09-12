# Notificações internas

O módulo de notificações para usuários finais é isolado em `src/notifications` e `supabase/functions/_shared/notifications`. Ele não usa o backoffice e nenhum browser insere diretamente nas tabelas.

## Fluxo

Um fluxo de negócio confirmado deve instanciar `InternalNotificationService` com um client `service_role` e chamar `notify`. O serviço lê `notification_types`, renderiza texto simples com dados mínimos, persiste o snapshot em `user_notifications` e cria o delivery `internal` em `notification_deliveries`.

`deduplication_key` é única. Em conflito, o serviço busca e devolve a notificação existente como `deduplicated: true`; isso torna retries e futuros webhooks seguros.

Não incluir dados clínicos, prontuário, laudo, resultado de exame, token, senha ou payload completo de pagamento em `data`, título ou mensagem.

## Leitura e segurança

As Functions `notifications-list`, `notifications-unread-count`, `notifications-mark-read` e `notifications-mark-all-read` usam a sessão Supabase do usuário, resolvem `app_users` ativo e aceitam somente os papéis `patient` e `professional`. Todas usam `service_role` somente após essa validação e sempre filtram por `recipient_user_id` do usuário autenticado.

`notifications-mark-read` retorna `404 NOTIFICATION_NOT_FOUND` quando o registro não existe ou não pertence ao usuário autenticado. Uma notificação própria já lida continua sendo uma operação idempotente de sucesso. Isso evita alteração cruzada e não revela a existência de notificações de terceiros.

RLS e FORCE RLS estão ativos. `anon` e `authenticated` não possuem grants diretos nessas tabelas; o frontend usa exclusivamente as Edge Functions.

## MVP e próxima etapa

O MVP entrega somente o canal `internal`, embora o catálogo e `notification_deliveries` já suportem email, WhatsApp, SMS, push e gateway. Não existe integração externa nem job de lembretes ainda. Tipos para lembretes e eventos de agendamento, financeiro, avaliação, solicitação clínica, planos, fila, teleconsulta e cadastro profissional já foram semeados.

`notification_preferences` foi intencionalmente adiada: no MVP, somente o delivery interno obrigatório é criado. Preferências por canal/categoria devem ser adicionadas antes de habilitar qualquer canal externo.

Nenhum fluxo clínico, financeiro, de pagamento, plano, teleconsulta ou backoffice foi alterado nesta etapa. As próximas integrações devem ocorrer somente depois da operação principal confirmar com sucesso e por chamadas pontuais ao `InternalNotificationService`.

## Checklist manual de QA após deploy

1. Autentique um paciente e um profissional diferentes; abra `/Notifications` para confirmar estado vazio/lista e o badge no avatar.
2. Use um evento de teste que chame o serviço no backend (nunca um insert pelo browser), confirme uma única linha em `user_notifications` e um delivery `internal`.
3. Marque uma notificação própria como lida e confirme redução do contador; repita para confirmar idempotência. Tente a mesma ação com o token do outro usuário e espere `404 NOTIFICATION_NOT_FOUND`.
4. Marque todas como lidas e confirme que o outro usuário não foi afetado.
5. Faça preflight e leitura usando `Authorization: Bearer USER_ACCESS_TOKEN` e `apikey: SUPABASE_ANON_OR_PUBLISHABLE_KEY`:

```bash
curl -i -X OPTIONS "https://PROJECT_REF.supabase.co/functions/v1/notifications-list" \
  -H "Origin: https://APP_ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization, apikey, content-type"

curl -i "https://PROJECT_REF.supabase.co/functions/v1/notifications-list?unread=true" \
  -H "Authorization: Bearer USER_ACCESS_TOKEN" \
  -H "apikey: SUPABASE_ANON_OR_PUBLISHABLE_KEY"
```

Inspeções SQL administrativas:

```sql
select key, category, title_template, message_template, is_active
from public.notification_types order by category, key;

select id, recipient_user_id, category, title, message, read_at, created_at
from public.user_notifications
where recipient_user_id = 'USER_ID' order by created_at desc;

select d.* from public.notification_deliveries d
join public.user_notifications n on n.id = d.user_notification_id
where n.recipient_user_id = 'USER_ID' order by d.created_at desc;
```
