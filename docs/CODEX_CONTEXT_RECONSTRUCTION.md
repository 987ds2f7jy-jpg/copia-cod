# Reconstrução de contexto — Rápido Doutor

Data da inspeção: 2026-08-08 (America/Sao_Paulo). Snapshot: branch `main`, commit `9a16897` (`pos formatacao`).

## Convenção de evidência

- **[FATO]** observado no commit ou no ambiente local, sem executar fluxo funcional.
- **[TESTE]** comportamento observado por comando automatizado nesta inspeção.
- **[HISTÓRICO]** evidência de commits, relatórios ou branches; não é baseline atual.
- **[INFERÊNCIA]** conclusão técnica provável derivada das evidências indicadas.
- **[PENDÊNCIA]** depende de ambiente remoto, fornecedor, decisão de negócio ou teste ainda não seguro.

Nenhum valor de secret, senha, token ou arquivo `.env` é reproduzido neste documento.

## Resumo executivo

**[FATO]** Rápido Doutor é um frontend React/Vite com rotas públicas e autenticadas, uma camada `client-api` que chama 67 Supabase Edge Functions implantáveis, PostgreSQL/Storage sob acesso privilegiado das funções e integrações com Zoom, Deepgram, Groq, Mapbox, Stripe, Mercado Pago e um serviço externo de planos. A composição da aplicação está em `src/App.tsx:34-112`, as páginas em `src/pages.config.js:3-62`, as chamadas de função em `src/client-api/edgeFunctions.js:95-176` e a configuração das funções em `supabase/config.toml:3-202`.

**[FATO]** O repositório estava limpo. O checkout Windows usa `core.autocrlf=true`, não há `.gitattributes`, e os dois diffs com `--ignore-space-at-eol` estavam vazios. Portanto, o antigo “grande diff” não existe no snapshot atual; há materialização CRLF local, mas nenhuma modificação a atribuir somente a finais de linha.

**[FATO]** Foram confirmados 50 arquivos de migração, 68 diretórios em `supabase/functions` sem contar `_shared`, mas somente 67 funções com `index.ts` e seção em `config.toml`; `upload-public-file` está vazio. Há 28 arquivos Vitest, 40 specs Playwright e, pela metodologia desta auditoria, 105.630 linhas em 690 arquivos textuais relevantes rastreados, excluindo lockfile, assets e relatórios. Os números antigos de aproximadamente 80 mil linhas e 67 funções eram, respectivamente, desatualizado/metodologicamente diferente e correto quanto às funções implantáveis.

**[TESTE]** A instalação limpa concluiu e os checks de sincronização, testes unitários e build passaram. Lint, staging readiness e a listagem Playwright falharam. Os resultados completos estão em “Baseline verificável”.

**[FATO]** Há três questões de resposta imediata: credenciais e sessões E2E reais foram versionadas historicamente; dois caminhos de stored/DOM XSS são alcançáveis por campos persistidos de perfil; os tokens da aplicação permanecem no `localStorage`, amplificando o impacto desses XSS (`src/client-api/session.js:1-99`, `src/components/map/MapboxMap.tsx:110-116`, `src/components/perfil/ProfileAbout.jsx:127-136`, `src/components/perfil/ProfileShare.jsx:24-58`).

## Estado Git e ambiente

| Item | Resultado | Classificação/evidência |
|---|---|---|
| Branch/commit | `main` em `9a16897`, alinhada com `origin/main` | **[FATO]** `git branch -a -vv`; `git log --all -30` |
| Árvore de trabalho inicial | limpa | **[FATO]** `git status --short` sem saída |
| Remoto | `origin` GitHub; URL sem credencial embutida | **[FATO]** `git remote -v` |
| Branch divergente | `origin/doidao`: 2 commits próprios e 85 commits atrás de `main` | **[FATO]** merge-base `47c8447`; inspeção somente, sem merge |
| Conteúdo de `doidao` | documentação de fluxos e tentativa de fila atômica por RPC `add_to_queue_atomic` | **[FATO]** diff `main...origin/doidao`; não foi localizada migração correspondente no commit atual |
| Node/npm | Node `v24.18.0`; npm `11.16.0` | **[FATO]** comandos de versão |
| Registry | registry público padrão; nenhum `.npmrc` de projeto/usuário encontrado | **[FATO]** inspeção de configuração |
| Lockfile | blob local idêntico ao `package-lock.json` do commit | **[FATO]** comparação `git ls-tree`/`git hash-object`; scripts/deps declarados em `package.json:6-105` |
| Finais de linha | `core.autocrlf=true`; sem `.gitattributes`; diffs ignorando EOL vazios | **[FATO]** Git config e ambos os comandos pedidos |

**[INFERÊNCIA]** A branch `origin/doidao` não é candidata a merge direto: está amplamente atrasada e a mudança de fila depende de uma RPC não comprovada no conjunto atual de migrações. Deve ser tratada como evidência histórica e fonte para cherry-pick/reimplementação somente após revisão.

## Segredos e material autenticado

**[FATO]** Existem localmente, ignorados pelo Git, `.env`, `.env.local`, `.env.staging`, `.env.staging.secrets`, `tests/e2e/.env.e2e` e estados em `tests/e2e/.auth/`. Foram inventariados somente nomes de variáveis. O estado atual de paciente e profissional contém `accessToken` e `refreshToken` não vazios na chave `rd.auth.session.v1`; o estado de admin não contém origem autenticada.

**[FATO]** O histórico Git contém versões de `.env`, `tests/e2e/.env.e2e` e dos três arquivos `.auth`. Foram confirmados senha E2E não vazia, token Mapbox, segredo de simulação e múltiplas sessões com access/refresh token. **Todos devem ser tratados como comprometidos**, ainda que possam já estar expirados ou revogados.

**[PENDÊNCIA]** Não foi consultado o Supabase, Mapbox ou qualquer provedor para saber se os artefatos históricos ainda são válidos. A resposta segura é revogar sessões, trocar credenciais e documentar a rotação antes de staging.

## Instalação de dependências

**[FATO]** O primeiro `npm ci` falhou com `EPERM` ao substituir o binário do esbuild porque um Vite/esbuild deste workspace estava em execução. Foram encerrados somente esses dois processos do workspace; nenhuma pasta fora de `node_modules` foi removida.

**[TESTE]** O segundo `npm ci` passou em 29,74 s: 557 pacotes instalados e 558 auditados. O npm reportou 20 vulnerabilidades (1 baixa, 3 moderadas, 15 altas e 1 crítica) e avisos de scripts nativos de esbuild/`@swc/core`. A vulnerabilidade crítica alcança a dependência direta Vitest; Vite, React Router DOM e PostCSS têm alertas altos. Não foi aplicado `--force`, `--legacy-peer-deps`, atualização ou correção automática.

**[PENDÊNCIA]** Node 24 não está fixado no projeto (`package.json` não declara `engines`/`packageManager`). É necessário definir e testar uma versão LTS suportada antes de tornar o build reproduzível.

## Baseline verificável

| Comando | Resultado e duração | Leitura |
|---|---|---|
| `npm run check:supabase-functions-config` | **[TESTE] PASS**, 1,23 s; 67 funções sincronizadas | Configuração local coerente com diretórios implantáveis (`package.json:16-18`) |
| `npm test` | **[TESTE] PASS**, 51,41 s; 28 arquivos, 163 testes | Baseline atual; “407 passed/90 skipped” é somente **[HISTÓRICO]** (`vitest.config.ts:5-12`) |
| `npm run build` | **[TESTE] PASS**, 37,69 s; Vite 5.4.19, 4.010 módulos | Warnings: Browserslist antigo; chunks Teleconsulta ~891 KB, Mapbox ~1,77 MB e core ~518 KB (`vite.config.ts:18-33`) |
| `npm run lint` | **[TESTE] FALHA**, 30,62 s; 100 erros/21 warnings | Parte substancial vem de cópias ignoradas `tmp/claude-tests-review*`; há erros reais em dashboard, teleconsulta/IA, UI, config e E2E. Não corrigidos em massa |
| `npm run check:staging` | **[TESTE] FALHA**, 1,40 s; 32 erros/1 warning | URL de funções ausente; placeholders/URLs inválidas e configuração incompleta de Supabase, Mapbox, pagamentos, planos, Zoom, Deepgram, Groq e CORS. A verificação remota de migrações foi pulada (`scripts/check-staging-readiness.mjs:10-80`, `scripts/check-staging-readiness.mjs:192-279`) |
| `npm run test:e2e -- --list` | **[TESTE] FALHA**, 20,76 s; zero testes listados | Erro de fixture em `tests/e2e/teleconsulta/payment-flow.spec.ts:90` e `tests/e2e/teleconsulta/payment-flow.spec.ts:180`; nenhum E2E executado |

**[FATO]** A configuração Playwright carrega ambiente, usa projetos públicos/autenticados e servidor Vite (`playwright.config.ts:26-68`, `playwright.config.ts:70-127`). O setup global autentica e regrava estados (`tests/e2e/support/global-setup.ts:40-87`). Existem mutações não protegidas por flag em perfil profissional e dados do paciente (`tests/e2e/professional/meu-perfil.spec.ts:84-101`, `tests/e2e/professional/edit-and-deactivate.spec.ts:140-176`); a desativação, por outro lado, está explicitamente guardada (`tests/e2e/professional/edit-and-deactivate.spec.ts:249-280`). Por isso nenhum E2E foi executado.

## Arquitetura resumida

```text
Browser
  ├─ React 18 + Vite + React Router + React Query
  ├─ UI Tailwind/shadcn/Radix + Mapbox + Zoom Video SDK
  ├─ sessão persistente em localStorage (rd.auth.session.v1)
  └─ src/client-api (POST/OPTIONS + Bearer manual)
       ↓
Supabase Edge Functions (67; verify_jwt=false)
  ├─ autenticação manual por auth.getUser e app_users
  ├─ autorização por papel, ownership e estado de domínio
  ├─ regras de clínica, pagamentos, planos e privacidade
  ├─ cliente PostgreSQL/Storage com service role
  └─ integrações Zoom, Deepgram, Groq, Stripe, Mercado Pago e planos
       ↓
PostgreSQL (31 tabelas) / Storage privado / webhooks e fornecedores
```

**[FATO]** `verify_jwt=false` está nas 67 seções (`supabase/config.toml:3-202`). Isso desliga a validação do gateway, mas não torna automaticamente cada endpoint público: os helpers extraem Bearer e chamam Supabase Auth (`supabase/functions/_shared/auth.ts:8-48`, `supabase/functions/_shared/supabase.ts:25-41`), e o contexto de conta rejeita usuário inexistente/inativo (`supabase/functions/_shared/sessionAccount.ts:240-276`). **[INFERÊNCIA]** A segurança depende principalmente da implementação manual e consistente de cada função.

**[FATO]** A aplicação mistura JS/JSX e TS/TSX; o TypeScript permite JS, desativa `strict` e `noImplicitAny` (`tsconfig.json:3-13`, `tsconfig.app.json:15-26`). A camada Edge usa service role para ultrapassar uma fronteira de banco fechada: a migração final força RLS em 27 tabelas, remove políticas de anon/authenticated e reserva operações ao service role (`supabase/migrations/20260712150000_harden_rls_storage_and_rpc.sql:8-92`). Tabelas posteriores também recebem `FORCE ROW LEVEL SECURITY` em suas respectivas migrações.

## Inventário funcional consolidado

Estado: **confirmado** significa rota/componente e backend localizados; não significa validação em staging.

| Módulo | Rota/componentes | Funções/tabelas | Papéis, estado e testes/lacunas |
|---|---|---|---|
| Cadastro/login/sessão | Cadastro, Login; `AuthContext`, `authService` | `register-*`, `login-app-user`, `refresh-app-session`, `logout-app-session`, `bootstrap-app-user`; `app_users`, perfis | Público no ingresso, depois usuário autenticado. Fluxo confirmado no código e unit tests; persistência local amplia XSS (`src/components/AuthContext.jsx:44-141`, `src/services/authService.js:243-394`) |
| Recuperação de senha | tela Auth + serviço | `request-password-reset`, `update-app-password` | Público/token de recuperação; E2E usa mock, não entrega real (`src/services/authService.js:315-360`, `tests/e2e/auth/password-recovery.spec.ts:5-64`) |
| Aprovação profissional | `/AdminAprovacao`; painel | `get-admin-approval-data`, `review-professional-registration` | Admin; rota protegida (`src/App.tsx:34-50`). Estado remoto pendente |
| Perfil público/consultório/QR | Perfil, `ProfileAbout`, `ProfileHero`, `ProfileShare`, Mapbox | `read-models`, `upsert-professional-profile`, `upsert-office-location`; perfis/locations | Leitura pública, escrita do profissional. Confirmado; XSS P0 e URL social sem esquema validado (`src/components/perfil/ProfileHero.jsx:97-102`) |
| Disponibilidade/agendamento | Perfil/dashboards/agendamento | `manage-availability`, `read-availability`, `create/accept/cancel-appointment`; `availability_slots`, `appointments` | Paciente/profissional conforme ownership. Preço resolvido no backend. Testes unitários; E2E não executado |
| Fila imediata | fila/consulta imediata | `join/leave/read/accept-queue`; `queues` | Paciente/profissional, regras de estado; branch `doidao` contém tentativa histórica de atomicidade não integrada |
| Teleconsulta | `/consulta/:id`, Teleconsulta | `start/finish-consulta`, `zoom-token`, consentimentos; `consultas`, `appointments` | Participantes da consulta. Zoom temporário e consentimento exigido; indisponibilidade do vídeo bloqueia o vídeo, não há fallback clínico automatizado (`src/App.tsx:67-112`) |
| Transcrição e IA | `PreenchimentoAutomaticoProntuario` | `deepgram-token`, `groq-completion`, consent/audit; `consultation_consent_events`, `system_audit_events` | Apenas profissional da consulta ativa. Revisão humana é sugerida, mas salvar imediatamente é possível; uso/modelo/prompt não entram no prontuário |
| Prontuário | formulário/prontuários | `read/upsert-prontuario`, `finish-consulta`; `prontuarios` | Participantes/leitura conforme regra, escrita profissional. Registro é sobrescrito, sem versão, assinatura ou retificação (`supabase/functions/upsert-prontuario/repository.ts:224-263`) |
| Exames/receitas/laudos | solicitações clínicas | `create/read/accept/complete-medical-request`; `solicitacoes_exames` | Paciente/profissional/ownership; tipos cobrem solicitações. Há testes de hardening majoritariamente estruturais (`src/test/medical-request-access-hardening.test.ts:10-89`) |
| Perguntas/avaliações | perguntas e pós-consulta | `create/answer-question`, `submit-evaluation`, `create-review`; `questions`, `avaliacao_consulta`, `reviews` | Público para leitura selecionada; escrita autenticada e vinculada. Enumeração pública requer hardening |
| Cobranças | checkout/pagamentos | `create-payment-charge`, `payments`, `payments-webhook`, simulação; charges/events | Paciente owner; webhooks assinados. Idempotência/valores backend confirmados no código; provedor real não testado |
| Planos/créditos | `/Planos`; checkout/ativação | `check/activate/create/retry/cancel-plan`, `consume-plan-credit`; orders/usages | Paciente e jobs de backend. Catálogo backend e exclusividade DB; serviço externo não verificado |
| Financeiro profissional | `/Financeiro`, dados bancários/saques | `get-professional-finance`, `upsert-banking`, `create-withdrawal`; banking/saques | Profissional owner; rota exige papel (`src/App.tsx:98-112`). Liquidação/reconciliação externa não comprovada |
| Reconciliação | sem UI operacional confirmada | `admin-reconciliation-queue/action`; claims/audit | Admin; backend existe. Workflow de operação em staging pendente |
| Privacidade/conta | configurações/direitos | `create/generate/admin privacy`, `deactivate-account`; requests/audit | Titular/admin. Desativação é lógica; export privado expira, arquivo não é apagado automaticamente (`docs/privacy-rights-and-account-lifecycle-staging.md:30-55`) |
| Auditoria/legal | consentimentos e eventos | `record-consultation-consent`, signup events; legal/consent/audit | Append-only para consentimento; eventos legais só por grant, sem trigger imutável. Empresa/retenção ainda têm placeholders (`src/config/legal.ts:12-32`) |
| Storage | upload/delete/signed URLs | `upload-file`, `delete-file`, `read-models`; bucket `uploads`/export | Privado, caminho por owner e MIME/extensão; não há magic-byte check (`supabase/functions/upload-file/index.ts:18-129`) |

**[FATO]** Não foram encontrados módulo, tabela, rota ou função de mini consultório, totem, unidade física assistida, check-in por QR, equipamentos ou facilitador local. O QR atual apenas codifica a URL pública do perfil via `api.qrserver.com` (`src/components/perfil/ProfileShare.jsx:5-16`).

## Fluxos essenciais

### Consulta programada/imediata

```text
paciente escolhe profissional/especialidade ou entra na fila
  → backend resolve disponibilidade, preço/plano e cria recurso
  → pagamento confirmado OU crédito reservado/consumido (exclusivos)
  → profissional aceita/inicia
  → consentimentos vigentes são exigidos para Zoom/transcrição/IA
  → teleconsulta
  → profissional salva prontuário e encerra
  → avaliação/review e financeiro
```

**[FATO]** A exclusão mútua entre financiamento por pagamento e por plano, além da unicidade do atendimento ativo por owner, é reforçada por constraints/triggers/RPCs (`supabase/migrations/20260712190000_harden_plan_coverage_credit_integrity.sql:36-198`, `supabase/migrations/20260712190000_harden_plan_coverage_credit_integrity.sql:203-404`). **[PENDÊNCIA]** A migração não foi aplicada nesta rodada; compatibilidade foi somente estática.

### IA clínica

```text
microfone do profissional
  → token Deepgram temporário, WebSocket e modelo nova-3
  → texto mantido em estado React
  → Groq llama-3.1-8b-instant com transcrição interpolada no prompt
  → conteúdo esperado como JSON
  → JSON.parse + campos textuais
  → preenchimento do formulário
  → clique do profissional salva/sobrescreve o prontuário
```

**[FATO]** O acesso exige profissional vinculado, consulta ativa e consentimentos (`supabase/functions/deepgram-token/index.ts:88-143`, `supabase/functions/groq-completion/index.ts:109-162`). O frontend não persiste deliberadamente áudio/transcrição e encerra conexões no cleanup (`src/components/teleconsulta/PreenchimentoAutomaticoProntuario.tsx:137-196`, `src/components/teleconsulta/PreenchimentoAutomaticoProntuario.tsx:252-269`, `src/components/teleconsulta/PreenchimentoAutomaticoProntuario.tsx:575-580`).

**[FATO]** Não existe schema robusto da resposta, versionamento de prompt/modelo, registro do uso de IA no prontuário nem defesa explícita contra prompt injection; `JSON.parse` e checagem de strings são o limite (`src/components/teleconsulta/PreenchimentoAutomaticoProntuario.tsx:53-75`). A auditoria registra provedor, não a versão/modelo/prompt (`supabase/functions/groq-completion/index.ts:175-205`).

**[PENDÊNCIA NORMATIVA]** Sem constituir parecer jurídico: Lei 14.510/2022, Resolução CFM 2.314/2022, Lei 13.787/2018 e LGPD requerem atenção a consentimento, prontuário, integridade, sigilo e dados sensíveis. A Resolução CFM 2.454/2026 entra em vigor 180 dias após publicação de 27/02/2026 e exige, entre outros pontos, supervisão médica, informação ao paciente, registro do uso da IA e governança. Fontes oficiais: [Lei 14.510](https://planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14510.htm), [CFM 2.314/2022](https://www.sistemas.cfm.org.br/normas/visualizar/resolucoes/BR/2022/2314), [Lei 13.787](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13787.htm), [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), [CFM 2.454/2026](https://sistemas.cfm.org.br/normas/visualizar/resolucoes/br/2026/2454). O PL 2338/2023 permanece projeto em tramitação, não lei vigente: [Congresso Nacional](https://www.congressonacional.leg.br/materias/materias-bicamerais/-/ver/pl-2338-2023).

## Decisões existentes que futuras sessões devem preservar

- **[FATO]** A API de browser usa somente POST/OPTIONS e modos de autenticação explícitos; em 401 pode renovar a sessão e tentar novamente (`src/client-api/edgeFunctions.js:36-84`, `src/client-api/edgeFunctions.js:199-240`).
- **[FATO]** CORS é fail-closed em staging/produção se origins não forem configuradas (`supabase/functions/_shared/cors-policy.ts:26-54`, `supabase/functions/_shared/http.ts:35-60`).
- **[FATO]** O banco foi intencionalmente fechado para anon/authenticated e as Edge Functions formam a fronteira privilegiada (`supabase/migrations/20260712150000_harden_rls_storage_and_rpc.sql:8-92`).
- **[FATO]** Consentimentos de consulta são versionados e imutáveis por trigger (`supabase/migrations/20260712220000_add_consultation_consent_events.sql:3-67`).
- **[FATO]** Simulação de pagamento é aceita apenas em local/dev/test quando habilitada e é excluída do script normal de deploy de staging (`supabase/functions/simulate-payment-paid/handler.ts:90-102`, `scripts/deploy-staging-functions.ps1:9-79`). Isso não impede publicação manual; estado remoto é pendente.
- **[FATO]** Exportações usam bucket privado e URL assinada curta; a própria documentação registra que limpeza automática e matriz de retenção ainda faltam (`docs/privacy-rights-and-account-lifecycle-staging.md:30-55`).

## Verificação dos 16 achados prioritários

| # | Resultado |
|---|---|
| 1 | **Confirmado [FATO]:** credenciais E2E e estados autenticados foram versionados historicamente. |
| 2 | **Confirmado [FATO]:** o pacote local contém sessões antigas com refresh tokens; validade remota pendente. |
| 3 | **Confirmado [FATO]:** stored XSS no popup Mapbox é alcançável por perfil/endereço persistido. |
| 4 | **Confirmado [FATO]:** impressão do QR interpola perfil em `document.write`, permitindo injeção. |
| 5 | **Confirmado [FATO]:** sessão fica em `localStorage/rd.auth.session.v1`. |
| 6 | **Confirmado [FATO]:** as 67 funções configuradas usam `verify_jwt=false`. |
| 7 | **Confirmado [FATO]:** autorização depende principalmente da validação manual nas funções. |
| 8 | **Confirmado [FATO]:** `read-models` é gateway genérico com service role; tem allowlist de entidades, mas `*`, filtros/ordenação flexíveis e paginação opcional exigem hardening (`supabase/functions/read-models/index.ts:155-165`, `supabase/functions/read-models/index.ts:448-523`, `supabase/functions/read-models/index.ts:739-795`). |
| 9 | **Confirmado [FATO]:** QR usa `api.qrserver.com`. |
| 10 | **Confirmado como aparentemente órfão [INFERÊNCIA]:** `backend/src/domains` não tem entrada/runtime/import externo localizados. Não está confirmado como removível. |
| 11 | **Confirmado [FATO]:** `upload-public-file` está vazio e sem seção de deploy. |
| 12 | **Confirmado [FATO]:** hosting e domínio real de staging não estão definidos (`docs/staging-environment-runbook.md:10-13`, `docs/staging-environment-runbook.md:132-150`). |
| 13 | **Confirmado [FATO]:** dados empresariais e retenção têm placeholders (`src/config/legal.ts:12-32`, `docs/legal-and-privacy-staging.md:18-24`). |
| 14 | **Confirmado [FATO]:** IA não registra claramente modelo, versão e uso no prontuário. |
| 15 | **Confirmado como ausência [FATO]:** não há implementação completa nem parcial identificável de mini consultório/totem. |
| 16 | **Refutado no estado atual [FATO]:** não existe grande diff; ambos os diffs ignorando EOL estão vazios. CRLF local é contexto, não modificação atual. |

## Incertezas que não devem ser convertidas em suposição

- **[PENDÊNCIA]** Estado remoto de migrações, RLS, funções publicadas, secrets, buckets e webhooks no Supabase.
- **[PENDÊNCIA]** Validade/revogação de todos os secrets e refresh tokens históricos.
- **[PENDÊNCIA]** Contratos, residência, retenção e subprocessadores de fornecedores.
- **[PENDÊNCIA]** Dados empresariais, responsável técnico, registros aplicáveis e matriz legal de retenção.
- **[PENDÊNCIA]** Comportamento real de Stripe, Mercado Pago, planos, Zoom, Deepgram e Groq sob timeout/retry/indisponibilidade.
- **[PENDÊNCIA]** Execução E2E segura com contas e dados descartáveis; a suíte nem lista no commit atual.
- **[PENDÊNCIA]** Compatibilidade das 50 migrações em banco vazio e upgrade de snapshot real. A ordem é cronológica e as dependências são estaticamente coerentes, mas não foi aplicado SQL.
- **[PENDÊNCIA]** Se eventos legais devem receber trigger imutável e qual retenção/anonimização se aplica a cada tabela e payload.

## Regras para a próxima sessão Codex

1. Não usar relatórios anteriores como baseline; começar por `git status`, branch/commit e checks.
2. Nunca imprimir valores de `.env` ou estados Playwright; tratar tudo que esteve no Git como comprometido.
3. Não publicar nem aplicar migrações sem reconciliar o estado remoto e obter autorização explícita.
4. Não executar E2E até corrigir a coleta e separar contas/dados descartáveis; flags documentadas estão em `tests/e2e/README.md:149-181`.
5. Priorizar o lote P0 do backlog antes de novas funcionalidades.
6. Usar `docs/ARCHITECTURE_CURRENT.md` como mapa técnico e `docs/SECURITY_AND_RELEASE_BACKLOG.md` como critério de liberação, sempre revalidando contra o commit corrente.
