# Arquitetura atual — Rápido Doutor

Snapshot: `main@9a16897`, inspecionado em 2026-08-08. As marcas **[FATO]**, **[TESTE]**, **[HISTÓRICO]**, **[INFERÊNCIA]** e **[PENDÊNCIA]** têm o significado definido em `docs/CODEX_CONTEXT_RECONSTRUCTION.md`.

## Componentes e fronteiras

```text
Browser
  ├─ React 18 / Vite / React Router
  │    ├─ páginas públicas e perfil profissional
  │    ├─ áreas paciente, profissional e administração
  │    ├─ React Query + client-api
  │    └─ Mapbox / Zoom Video SDK / Deepgram SDK
  ├─ localStorage
  │    └─ rd.auth.session.v1 = accessToken + refreshToken + user
  └─ HTTPS POST/OPTIONS
       ├─ Bearer para funções autenticadas
       └─ funções públicas ou webhooks assinados
            ↓
Supabase Edge Functions (67 configuradas; verify_jwt=false)
  ├─ autenticação manual: auth.getUser(token)
  ├─ conta da aplicação: app_users + active + role
  ├─ autorização: papel + ownership + estado do recurso
  ├─ regras clínicas, financeiras, legais e de privacidade
  ├─ cliente service role
  └─ clientes externos
       ├─ Zoom / Deepgram / Groq
       ├─ Stripe / Mercado Pago / serviço de planos
       └─ Storage / URLs assinadas
            ↓
PostgreSQL (31 tabelas; RLS/FORCE RLS) + Storage privado
```

**[FATO]** O roteamento e o lazy loading estão em `src/pages.config.js:3-62`; somente um subconjunto recebe `ProtectedRoute` diretamente em `src/App.tsx:34-50`, enquanto rotas geradas e `/consulta/:id` são montadas em `src/App.tsx:67-112`. A defesa decisiva deve, portanto, permanecer no backend.

**[FATO]** A sessão é persistida, restaurada e removida pela chave `rd.auth.session.v1` (`src/client-api/session.js:1-99`). `AuthContext` restaura, autentica, registra, recupera senha, encerra e reage à desativação (`src/components/AuthContext.jsx:44-141`, `src/components/AuthContext.jsx:170-191`). A camada HTTP define modos anônimo/bearer, envia POST e renova o token em 401 (`src/client-api/edgeFunctions.js:36-127`, `src/client-api/edgeFunctions.js:142-240`).

**[FATO]** Todas as 67 funções configuradas têm `verify_jwt=false` (`supabase/config.toml:3-202`). A autenticação é feita por helpers que extraem Bearer e consultam Supabase Auth (`supabase/functions/_shared/auth.ts:8-48`, `supabase/functions/_shared/supabase.ts:16-41`); o contexto de sessão cruza o usuário Auth com `app_users` e recusa conta inativa (`supabase/functions/_shared/sessionAccount.ts:240-276`).

**[FATO]** CORS compartilhado valida origem e responde preflight (`supabase/functions/_shared/http.ts:35-60`, `supabase/functions/_shared/http.ts:146-169`), com política fail-closed fora de local se a allowlist não estiver definida (`supabase/functions/_shared/cors-policy.ts:26-54`). Zoom webhook tem handling próprio. Respostas de erro podem incluir `details` derivados de exceção (`supabase/functions/_shared/errors.ts:29-39`, `supabase/functions/_shared/http.ts:119-138`).

## Mapa frontend e client API

| Camada | Responsabilidade | Evidência/observação |
|---|---|---|
| Pages/layout | descoberta pública, autenticação, dashboards, consulta, planos, financeiro e administração | **[FATO]** `src/pages.config.js:3-62`, `src/Layout.jsx:1-200` |
| Proteção visual | aguarda Auth, redireciona usuário/role inadequado | **[FATO]** `src/components/ProtectedRoute.jsx:10-35`; não substitui backend |
| Auth | sessão e lifecycle de conta | **[FATO]** `src/services/authService.js:243-427` |
| Client API | wrappers de cada domínio sobre Edge Functions | **[FATO]** autenticação/retry em `src/client-api/edgeFunctions.js:36-240` |
| Env | URLs/chaves públicas, staging e simulação local | **[FATO]** `src/config/env.ts:3-55`, `src/config/env.ts:91-96` |
| Browser privacy | inventário de storage/cookies e consentimento opcional do Mapbox | **[FATO]** `src/config/browser-storage.ts:13-168` |
| Legal | documentos/versionamento e dados empresariais ainda incompletos | **[FATO]** `src/config/legal.ts:12-32` |

## Matriz das Edge Functions

Legenda: `Pub` pública; `U` usuário ativo; `Pac` paciente; `Pro` profissional; `Adm` administrador; `Wh` webhook assinado. “Owner/estado” significa que o serviço/repositório valida vínculo e transições. Todas recebem POST/OPTIONS, usam CORS (compartilhado ou equivalente) e estão com gateway JWT desligado. Salvo indicação, não foi localizado rate limit; o acesso a tabelas ocorre por service role. A lista/configuração é **[FATO]** em `supabase/config.toml:3-202`; as garantias comuns estão em `supabase/functions/_shared/sessionAccount.ts:240-276` e `supabase/functions/_shared/http.ts:35-169`.

| Função | Finalidade | Acesso | Ownership/estado e controles | Risco se falhar |
|---|---|---|---|---|
| `accept-appointment` | aceitar agendamento | Pro | profissional do recurso; estado elegível | alto: consulta alheia |
| `accept-queue-entry` | aceitar fila imediata | Pro | profissional/entrada/estado | alto |
| `accept-solicitacao-exame` | aceitar solicitação clínica | Pro | vínculo e estado | alto: dado clínico |
| `answer-question` | responder pergunta | Pro | profissional e pergunta pendente | médio |
| `bootstrap-app-user` | criar/restaurar app user | Pub/U | signup opcional ou bearer (`supabase/functions/bootstrap-app-user/handler.ts:39-52`) | alto: identidade/papel |
| `cancel-appointment` | cancelar | Pac/Pro | participante, regra de estado | alto: financeiro/agenda |
| `check-plan-coverage` | consultar cobertura | Pac | próprio plano/atendimento; fallback self-pay | alto: funding |
| `create-appointment` | criar agendamento | Pac | usuário próprio, slot e preço backend | alto: cobrança/agenda |
| `create-plan-checkout` | checkout de plano | Pac | catálogo backend, idempotência | alto |
| `create-privacy-rights-request` | direito LGPD | U | próprio titular; idempotência e 5/h (`supabase/functions/create-privacy-rights-request/index.ts:67-74`) | alto: privacidade |
| `create-question` | pergunta | Pac | autor próprio | médio |
| `create-solicitacao-exame` | pedido clínico | Pac | autor/objeto próprio | alto |
| `deactivate-account` | desativação lógica | U | própria conta, revoga sessões | crítico: takeover/DoS |
| `deepgram-token` | token temporário STT | Pro | consulta ativa, vínculo e consentimento (`supabase/functions/deepgram-token/index.ts:88-143`) | crítico: áudio clínico |
| `delete-question` | excluir pergunta | Pac | autor/estado | médio |
| `delete-solicitacao-exame` | excluir pedido | Pac | autor/estado | alto |
| `delete-uploaded-files` | apagar arquivos | U | caminho/bucket/owner (`supabase/functions/delete-uploaded-files/service.ts:18-90`) | crítico: IDOR/delete |
| `ensure-payment-charge` | criar/reusar cobrança | Pac | owner, snapshot e idempotência | crítico: valor duplo |
| `finish-consulta` | encerrar consulta | Pro | profissional, prontuário mínimo/estado | crítico: registro clínico |
| `finish-solicitacao-exame-atendimento` | concluir pedido | Pro | profissional/estado | alto |
| `generate-my-privacy-data-export` | exportação LGPD | U | titular/request; reuso de arquivo | crítico: exfiltração |
| `get-admin-approval-queue` | fila de credenciamento | Adm | role admin | alto: PII/documentos |
| `get-admin-privacy-rights-queue` | fila LGPD | Adm | role admin | crítico |
| `get-finance-dashboard` | financeiro profissional | Pro | próprio profissional | crítico: bancário |
| `get-my-active-consultation` | consulta ativa | U | participante | crítico: clínico |
| `get-my-plans` | planos | Pac | owner | alto |
| `get-my-privacy-rights-requests` | solicitações LGPD | U | owner | alto |
| `get-patient-payments` | pagamentos | Pac | owner | crítico: financeiro |
| `get-patient-prontuarios` | prontuários | Pac | próprio paciente | crítico: saúde |
| `get-payment-status` | status cobrança | Pac | owner/resource | alto |
| `get-professional-dashboard` | dashboard | Pro | próprio profissional | alto |
| `get-reconciliation-queue` | inconsistências | Adm | admin e claims | crítico |
| `get-solicitacao-exame-atendimento` | detalhe clínico | Pac/Pro | relação com pedido | crítico |
| `get-teleconsulta-context` | contexto da sala | Pac/Pro | participante/estado | crítico |
| `groq-completion` | estruturar transcrição | Pro | consulta ativa, consentimento/aviso (`supabase/functions/groq-completion/index.ts:109-162`) | crítico: dado/decisão clínica |
| `join-queue` | entrar na fila | Pac | paciente/estado/funding | alto |
| `leave-queue` | sair da fila | Pac | owner/estado | médio |
| `login-app-user` | autenticar | Pub | email/senha; sem rate limit local confirmado | crítico: brute force |
| `payments` | dispatcher de pagamento | Wh | delega webhook (`supabase/functions/payments/index.ts:7-29`) | crítico |
| `payments-webhook` | confirmar pagamento | Wh | assinatura, raw body, evento/hash idempotente (`supabase/functions/payments-webhook/handler.ts:688-725`) | crítico |
| `quote-service-pricing` | cotar serviço | U | preço/fee backend | alto |
| `read-home-banners` | banners | Pub | select explícito | baixo |
| `read-models` | gateway de leitura | Pub/U | entidade allowlist; regras por modo, ownership parcial | crítico: exfiltração |
| `reconcile-financial-owner` | reconciliar funding | Adm | admin, claim/estado | crítico |
| `record-consultation-consent` | consentimento | Pac | paciente participante; append/idempotente (`supabase/functions/record-consultation-consent/index.ts:118-220`) | crítico: base legal |
| `record-legal-event` | aceite legal | U | usuário/documento/versão | alto |
| `refresh-app-session` | renovar sessão | Pub | refresh token no corpo | crítico: sessão |
| `register-professional` | cadastro profissional | Pub | valida campos e cria pendente | alto: identidade |
| `replace-availability-slots` | substituir agenda | Pro | próprio profissional | alto |
| `request-withdrawal` | saque | Pro | owner/saldo/dados bancários | crítico |
| `retry-plan-activation` | retry ativação | Pac | próprio pedido/estado | crítico: crédito duplicado |
| `review-privacy-rights-request` | tratar direito | Adm | admin/transição | crítico |
| `review-professional-application` | aprovar/rejeitar | Adm | admin/transição | crítico: privilégio |
| `set-professional-duty` | plantão/fila | Pro | próprio profissional | alto |
| `simulate-payment-paid` | simular paid | Pac/Adm local | somente local/dev/test + flag; ownership (`supabase/functions/simulate-payment-paid/handler.ts:90-102`, `supabase/functions/simulate-payment-paid/handler.ts:226-269`) | crítico se publicado/habilitado |
| `start-consulta-session` | iniciar sessão | Pro | profissional, funding e estado | crítico |
| `submit-appointment-review` | avaliação pública | Pac | consulta concluída/owner | médio |
| `submit-consulta-evaluation` | avaliação interna | Pac | consulta/owner | médio |
| `update-my-profile` | perfil paciente | Pac | owner | alto: PII |
| `update-solicitacao-exame` | atualizar pedido | Pac/Pro | relação/estado | crítico |
| `upload-file` | upload privado | U | role/path/owner, tamanho, MIME/ext (`supabase/functions/upload-file/index.ts:18-129`) | crítico: malware/IDOR |
| `upsert-office-location` | local consultório | Pub(get)/Pro(write) | get anônimo; write owner (`supabase/functions/upsert-office-location/handler.ts:40-57`) | alto: XSS/PII |
| `upsert-professional-banking-data` | dados bancários | Pro | owner | crítico |
| `upsert-professional-profile` | perfil profissional | Pro | owner/estado; validação textual | alto: XSS/perfil falso |
| `upsert-prontuario` | salvar prontuário | Pro | profissional/consulta/estado | crítico: integridade clínica |
| `zoom-token` | token de vídeo | Pac/Pro | participante, consentimento, token 2 h (`supabase/functions/zoom-token/index.ts:138-238`) | crítico: sala alheia |
| `zoom-webhook` | eventos Zoom | Wh | secret token/assinatura; evento idempotente | crítico |

### Análise específica de `read-models`

**[FATO]** Há allowlist de entidade→tabela e selects explícitos nos modos públicos (`supabase/functions/read-models/index.ts:21-165`). Bearer opcional é validado (`supabase/functions/read-models/index.ts:255-294`), os modos públicos são separados (`supabase/functions/read-models/index.ts:328-367`) e modos autenticados impõem regras por papel/owner (`supabase/functions/read-models/index.ts:369-439`).

**[FATO]** Nos modos privados, exceto solicitação clínica, o select efetivo é `*`; nomes de colunas para filtro e ordenação vêm do cliente; limite máximo é 500 quando fornecido, mas não há limite default quando omitido; a consulta roda com service role (`supabase/functions/read-models/index.ts:448-523`, `supabase/functions/read-models/index.ts:739-795`).

**[FATO]** A leitura pública de agendamentos limita as colunas e o status, mas aceita filtro por `patient_id`; isso cria um oráculo de relacionamento/horário por IDs previsíveis. **[INFERÊNCIA]** É uma exposição de metadados e superfície de enumeração, não leitura pública de prontuário. Deve receber allowlist por modo, proibição explícita de identificadores de terceiros e paginação obrigatória.

**[PENDÊNCIA]** Faltam testes negativos executáveis para paciente A/B, profissional A/B, papel cruzado, admin, usuário inativo, token inválido/expirado, ID inexistente/previsível e modos públicos. Os testes atuais de hardening são em grande parte verificações estáticas de fonte (`src/test/medical-request-access-hardening.test.ts:10-89`, `src/test/rls-storage-edge-hardening.test.ts:9-76`).

## Catálogo PostgreSQL e Storage

**[FATO]** O esquema-base cria usuários, perfis, consultas, mensagens, prontuário, filas, avaliações e saques (`supabase/migrations/20260402234507_2d7911fb-58b4-4d42-a16e-0bab7c08608e.sql:12-323`). Migrações posteriores removem credenciais/sessões legadas, ligam `app_users` ao Auth e adicionam tabelas financeiras, clínicas, legais e de privacidade (`supabase/migrations/20260409000400_strengthen_constraints.sql:26-208`).

Legenda de sensibilidade: `S` saúde, `P` pessoal, `F` financeiro, `A` autenticação/auditoria. A coluna RLS descreve o estado pretendido pelas migrações locais; aplicação remota é pendente.

| Tabela | Finalidade e chaves/relações | Sensível | Constraints/índices, RLS e retenção |
|---|---|---|---|
| `app_users` | identidade de aplicação; PK e FK `auth.users`; role/status | P/A | email/CPF/telefone únicos conforme hardening; FORCE RLS/service role; desativação lógica, retenção indefinida |
| `patient_profiles` | dados do paciente; FK app user | P/S | owner único; FORCE RLS; sem política final de exclusão |
| `professionals` | credenciamento/status; FK app user | P | registros profissionais/estado; FORCE RLS |
| `professional_profiles` | perfil privado | P | 1:1 profissional; FORCE RLS |
| `professional_public_profiles` | vitrine pública | P | 1:1 profissional; FORCE RLS, exposto apenas via backend select |
| `professional_office_locations` | endereço/coordenadas | P | profissional/local; FORCE RLS |
| `professional_banking_data` | conta de recebimento | F/P | 1:1/owner; FORCE RLS |
| `availability_slots` | agenda | P | profissional/intervalo; índices temporais; FORCE RLS |
| `appointments` | agendamento/funding | S/P/F | paciente+profissional, estados e owner ativo único; triggers financeiros; FORCE RLS |
| `queues` | fila imediata/funding | S/P/F | paciente/profissional/estado; exclusividade payment/plan; FORCE RLS |
| `consultas` | sessão clínica | S/P | appointment/queue e participantes; estados; FORCE RLS |
| `mensagem_consulta` | mensagens | S/P | consulta/remetente; FORCE RLS; retenção não definida |
| `prontuarios` | registro clínico | S/P | consulta/paciente/profissional; upsert sobrescreve; FORCE RLS; sem versionamento/retenção explícita |
| `solicitacoes_exames` | exames/receitas/laudos | S/P | autor/profissional/estado; FORCE RLS |
| `questions` | perguntas | S/P | paciente/profissional; FORCE RLS; subset público |
| `avaliacao_consulta` | avaliação interna | P | consulta/paciente; FORCE RLS |
| `reviews` | review público | P | consulta/paciente/profissional; FORCE RLS; subset público |
| `home_banners` | conteúdo público | não | ordenação/ativo; FORCE RLS; leitura mediada |
| `platform_service_prices` | tabela de preço | F | service_type/version/active; snapshot posterior; FORCE RLS; valores seed são placeholders (`supabase/migrations/20260418092000_seed_initial_pricing_placeholders.sql:1-39`) |
| `platform_fee_rules` | comissão | F | versão/percentual; FORCE RLS; seed 15% (`supabase/migrations/20260418092000_seed_initial_pricing_placeholders.sql:41-67`) |
| `payment_charges` | cobrança e snapshots | F/P | idempotency/provider ref únicos e índices (`supabase/migrations/20260418090000_create_pricing_and_payment_base.sql:96-171`); FORCE RLS |
| `payment_webhook_events` | replay/auditoria webhook | F/A | provider event/hash únicos (`supabase/migrations/20260418090000_create_pricing_and_payment_base.sql:174-215`); FORCE RLS; retenção não definida |
| `plan_subscription_orders` | assinatura/ativação | F/P | pedido aberto único/estados (`supabase/migrations/20260530120000_create_plan_subscription_orders.sql:3-84`); FORCE RLS |
| `plan_credit_usages` | reserva/consumo de crédito | F/P | plano/owner/atendimento, idempotência (`supabase/migrations/20260601090000_add_plan_funding_to_appointments.sql:3-101`); FORCE RLS |
| `saques` | solicitações de saque | F/P | profissional/valor/estado; FORCE RLS |
| `consultation_consent_events` | consentimentos versão/evento | S/A | chave idempotente e trigger imutável (`supabase/migrations/20260712220000_add_consultation_consent_events.sql:3-67`); FORCE RLS/append-only |
| `legal_user_events` | aceite/revogação legal | P/A | usuário/documento/versão/evento único (`supabase/migrations/20260712210000_add_legal_user_events.sql:3-40`); FORCE RLS; append-only por grants, sem trigger |
| `privacy_rights_requests` | pedidos LGPD/export | P/S/A | tipos/status/únicos (`supabase/migrations/20260712230000_add_privacy_rights_account_lifecycle.sql:7-81`); FORCE RLS; limpeza pendente |
| `system_audit_events` | auditoria técnica/domínio | S/P/A | evento/ator/recurso/metadata; FORCE RLS; retenção pendente |
| `system_reconciliation_claims` | lock/reconciliação | F/A | owner/claim/estado; FORCE RLS |
| `zoom_webhook_events` | eventos do Zoom | S/P/A | event ID/duplicidade, payload JSON completo (`supabase/migrations/20260429120000_create_zoom_webhook_events.sql:1-47`); FORCE RLS; minimização/retenção pendentes |

**[FATO]** A migração de hardening força RLS, derruba policies prévias, revoga anon/authenticated e concede acesso ao service role em 27 tabelas então existentes; também torna `uploads` privado e revoga acesso direto ao Storage (`supabase/migrations/20260712150000_harden_rls_storage_and_rpc.sql:8-92`). Tabelas legais/privacidade posteriores repetem FORCE RLS. **[INFERÊNCIA]** Quase toda operação sensível depende corretamente da Edge Function; um erro de autorização nela contorna a proteção por usar service role.

**[FATO]** `upload-file` limita bucket/pasta/tamanho/MIME/extensão e exige caminho do owner, mas confia no MIME declarado/extensão, sem inspecionar magic bytes (`supabase/functions/upload-file/index.ts:18-129`, `supabase/functions/_shared/uploadPaths.ts:13-55`). URLs assinadas são emitidas pelo backend. O bucket de export é privado, mas a migração documenta explicitamente ausência de auto-delete (`supabase/migrations/20260712230000_add_privacy_rights_account_lifecycle.sql:89-138`).

**[FATO]** As 50 migrações têm nomes cronológicos e referências estáticas em ordem compatível; substituições repetidas de funções SQL parecem hardening incremental. **[PENDÊNCIA]** Não foram aplicadas em banco vazio nem comparadas com `supabase_migrations.schema_migrations`; portanto não há confirmação de execução, drift ou rollback remoto.

### Funções SQL, triggers e eventos append-only

- **[FATO]** `accept_appointment_transaction` e `accept_queue_entry_transaction` concentram aceitação atômica e foram substituídas incrementalmente por migrações de status, snapshots e planos (`supabase/migrations/20260411010000_normalize_professional_status_domain.sql:55-340`, `supabase/migrations/20260418093000_propagate_pricing_snapshots_on_accept.sql:3-420`).
- **[FATO]** Guards de pagamento e exclusividade plano/pagamento são triggers `BEFORE` sobre appointments, queues e charges; o mesmo arquivo expõe RPCs de criação/cancelamento/consumo financiados por plano (`supabase/migrations/20260712190000_harden_plan_coverage_credit_integrity.sql:112-267`, `supabase/migrations/20260712190000_harden_plan_coverage_credit_integrity.sql:272-1015`).
- **[FATO]** Auditoria crítica sanitiza metadata, insere evento por função dedicada e observa transições de cobrança, crédito, agendamento, fila, consulta e ativação; claims SQL serializam reconciliação (`supabase/migrations/20260712200000_add_safe_audit_and_reconciliation.sql:64-180`, `supabase/migrations/20260712200000_add_safe_audit_and_reconciliation.sql:291-430`).
- **[FATO]** `consultation_consent_events` é append-only por trigger que rejeita update/delete (`supabase/migrations/20260712220000_add_consultation_consent_events.sql:50-67`). `legal_user_events` concede apenas select/insert ao service role, mas não possui trigger equivalente (`supabase/migrations/20260712210000_add_legal_user_events.sql:3-40`).
- **[FATO]** Triggers genéricos mantêm `updated_at` nas tabelas mutáveis (`supabase/migrations/20260402234507_2d7911fb-58b4-4d42-a16e-0bab7c08608e.sql:326-341`). Isso é conveniência temporal, não versionamento ou prova de integridade.

## Integrações e dados transmitidos

| Fornecedor | Finalidade/dados/quando | Secret, timeout/retry/fallback | Webhook/log/retenção/risco |
|---|---|---|---|
| Supabase | Auth: email/sessão; PostgreSQL: PII, saúde, finanças; Storage: documentos/export; sempre nos fluxos | publishable no browser; service role somente Edge secret (`supabase/functions/_shared/supabase.ts:16-23`) | núcleo sem fallback; logs técnicos; retenção depende da aplicação. **[PENDÊNCIA]** região, backup, PITR e DPA |
| Zoom Video SDK | sessão/role/identificadores para teleconsulta autorizada | key/secret Edge; JWT temporário 2 h (`supabase/functions/zoom-token/index.ts:219-238`); sem fallback de vídeo | webhook assinado e payload completo persistido; indisponibilidade impede sala; retenção/minimização pendentes |
| Deepgram | áudio ao vivo + parâmetros STT durante consulta | API key Edge troca por token de 30 s; timeout configurável (`supabase/functions/deepgram-token/index.ts:110-149`) | sem webhook/persistência deliberada local; cleanup fecha socket (`src/components/teleconsulta/PreenchimentoAutomaticoProntuario.tsx:151-196`); fornecedor recebe áudio |
| Groq | transcrição completa para JSON de prontuário | API key Edge; modelo `llama-3.1-8b-instant`, timeout e limite de caracteres (`supabase/functions/groq-completion/index.ts:47-87`, `supabase/functions/groq-completion/index.ts:134-162`); sem retry | sem webhook; auditoria só provedor; retorno inválido falha; prompt injection/alucinação e retenção do fornecedor pendentes |
| Mapbox | mapa, endereço/coordenadas e uso do navegador | token público; carregamento depende de consentimento opcional (`src/config/browser-storage.ts:159-168`) | browser direto; sem fallback além da UI; popup tem XSS P0 |
| Stripe | checkout/cobrança; customer/payment metadata | secret Edge; assinatura com tolerância 300 s (`supabase/functions/_shared/payments/providers/stripe-provider.ts:454-482`, `supabase/functions/_shared/payments/providers/stripe-provider.ts:601-621`) | webhook raw-body, replay e estados; retry é do provedor/idempotência local; retenção contratual pendente |
| Mercado Pago | cobrança e metadata | access token/secret Edge; assinatura validada (`supabase/functions/_shared/payments/providers/real-provider.ts:76-104`, `supabase/functions/_shared/payments/providers/real-provider.ts:335-364`) | evento/hash evitam replay; não foi localizada checagem de frescor temporal; retenção pendente |
| Plans interno | elegibilidade, ativação, créditos e acesso nutricional | `PlansFacade` → `InternalPlansProvider` → RPC/Postgres; worker protegido por service role (`docs/context/plans/internal-plans.md`) | ativação assíncrona durável, consumo atômico e manutenção agendada; cliente/config HTTP antigos permanecem apenas para limpeza na Fase 2B |
| `api.qrserver.com` | gera QR da URL pública do perfil ao abrir compartilhar | sem secret/timeout/retry (`src/components/perfil/ProfileShare.jsx:5-16`) | browser envia URL pública ao terceiro; retenção/privacidade desconhecidas; disponibilidade bloqueia QR |

## Fluxo financeiro e invariantes

```text
serviço + profissional
  → resolve preço ativo e fee no backend
  → snapshot financeiro no owner (appointment/queue)
  ├─ cobrança idempotente → provider checkout → webhook assinado
  │      → event/hash único → amount/currency conferidos → paid
  └─ plano → pedido/ativação → reserva de crédito → consumo ou liberação
          ↓
gatilhos impedem payment e plan simultâneos
          ↓
consulta financiada → ledger/dashboard → saque → reconciliação administrativa
```

**[FATO]** Preço e fee são resolvidos no backend (`supabase/functions/_shared/pricing/resolve-service-pricing.ts:70-123`, `supabase/functions/_shared/pricing/resolve-service-pricing.ts:264-308`), e o valor pedido para a cobrança é comparado ao snapshot do owner (`supabase/functions/_shared/payments/create-payment-charge.ts:256-283`). Constraints únicas protegem chave idempotente e referência do provedor (`supabase/migrations/20260418090000_create_pricing_and_payment_base.sql:144-207`, `supabase/migrations/20260418101000_add_provider_payment_reference_unique.sql:4-6`).

**[FATO]** O webhook usa corpo bruto, verifica assinatura, registra duplicidade e confronta valor/moeda antes da transição (`supabase/functions/payments-webhook/handler.ts:141-246`, `supabase/functions/payments-webhook/handler.ts:386-725`). A exclusividade pagamento/crédito e os guards de estado ficam em `supabase/migrations/20260712190000_harden_plan_coverage_credit_integrity.sql:112-404`.

**[FATO]** `simulate-payment-paid` está no código/config local, mas o script de deploy staging a omite e falha se entrar na lista (`scripts/deploy-staging-functions.ps1:9-79`). O runtime também exige ambiente local/dev/test e flag (`supabase/functions/simulate-payment-paid/handler.ts:90-102`). **[PENDÊNCIA]** Não há prova local de que ela nunca foi publicada manualmente; a lista remota precisa ser verificada sem invocá-la.

## Fluxo clínico, privacidade e integridade do prontuário

**[FATO]** Os helpers de teleconsulta verificam participante, papel e estado (`supabase/functions/_shared/teleconsultaAccess.ts:29-161`). Zoom, Deepgram e Groq adicionam requisitos de consentimento/documento vigente (`supabase/functions/_shared/consultation-consent.ts:5-165`). Tokens de fornecedor são temporários; áudio e transcrição não são intencionalmente gravados pelo frontend, mas os fornecedores os processam.

**[FATO]** O prontuário exige motivo e recomendações, aceita campos até 10 mil caracteres, verifica profissional/consulta/estado e atualiza a linha existente (`supabase/functions/upsert-prontuario/validation.ts:7-82`, `supabase/functions/upsert-prontuario/service.ts:30-165`, `supabase/functions/upsert-prontuario/repository.ts:224-263`). O encerramento exige apenas um subconjunto de campos (`supabase/functions/finish-consulta/service.ts:17-165`).

**[PENDÊNCIA CLÍNICA]** Não há campos/fluxo confirmado para assinatura digital, hash de integridade, versão/retificação/adendo, exame/propedêutica estruturado, resultados complementares, documentos emitidos, modelo/prompt/uso da IA ou atestado explícito de revisão humana. Identificadores e timestamps existem por relações/colunas, mas isso isoladamente não demonstra integridade ou conformidade.

**[FATO]** Desativação marca a conta inativa e faz global sign-out; não apaga Auth nem dados (`supabase/functions/deactivate-account/service.ts:31-66`, `supabase/functions/deactivate-account/repository.ts:108-162`). Exportação agrega tabelas com limite de 1.000 linhas cada, reusa caminho anterior e cria URL assinada de 5 min (`supabase/functions/generate-my-privacy-data-export/index.ts:10-163`). Não há job de remoção do objeto; uma conta grande pode receber export silenciosamente truncado.

## Código órfão e dívida técnica

| Item | Classificação | Evidência |
|---|---|---|
| `backend/src/domains/**` | **aparentemente órfão [INFERÊNCIA]** | cinco arquivos pequenos; nenhum import, package script ou runtime externo localizado; não confirmado removível |
| `supabase/functions/upload-public-file` | **aparentemente órfão [FATO]** | diretório vazio, sem `index.ts` e sem `config.toml`; não implantável no snapshot |
| Client APIs/Edge Functions operacionais sem UI | **ativo backend/incerto UI** | privacidade admin, reconciliação e retry existem na matriz; rota operacional completa não confirmada |
| JS/TS misturados | **ativo/dívida [FATO]** | 116 JS/JSX e 94 TS/TSX em `src`; `allowJs` e strict desligado (`tsconfig.json:3-13`) |
| `tmp/claude-tests-review*` | **artefato local/dívida de tooling [FATO]** | ignorado pelo Git, mas incluído pelo ESLint, multiplica erros |
| filtros genéricos de `read-models` | **ativo/dívida de segurança [FATO]** | `supabase/functions/read-models/index.ts:448-523` |

Nenhum desses itens foi removido ou alterado nesta rodada.
