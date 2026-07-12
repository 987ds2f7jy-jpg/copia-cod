# RLS sem policies diretas

O frontend nao usa `supabase.from` ou `supabase.rpc`. As tabelas abaixo permanecem com RLS forcada, sem policies e sem grants para `anon` ou `authenticated`; o acesso ocorre por Edge Functions com autenticacao e autorizacao server-side.

## Conteudo publico via Edge Function

- `home_banners`: `read-home-banners`.
- `professional_public_profiles`, `availability_slots`, `questions` e `reviews`: `read-models` com projecoes publicas.
- `professional_office_locations`: `upsert-office-location`; leitura publica e escrita autenticada separadas no handler.

## Bloqueadas intencionalmente para acesso direto

- Identidade e perfis privados: `app_users`, `patient_profiles`, `professionals`, `professional_profiles`, `professional_banking_data`.
- Fluxos assistenciais: `appointments`, `consultas`, `mensagem_consulta`, `avaliacao_consulta`, `prontuarios`, `queues`, `solicitacoes_exames`.
- Financeiro e operacao: `saques`, `platform_service_prices`, `platform_fee_rules`, `payment_charges`, `payment_webhook_events`, `zoom_webhook_events`.
- Planos: `plan_subscription_orders`, `plan_credit_usages`.

Nenhuma policy publica nova foi necessaria. O aviso de protecao contra senhas vazadas permanece como limitacao do plano Free; antes do beta, revisar senha minima de 12 caracteres, complexidade, CAPTCHA e rate limits do Supabase Auth.
