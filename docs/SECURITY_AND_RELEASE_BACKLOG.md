# Backlog de segurança e liberação — Rápido Doutor

Snapshot: `main@9a16897`, 2026-08-08. Este backlog é baseado em código local; não atesta o estado de staging/produção. Marcas: **[FATO]**, **[TESTE]**, **[HISTÓRICO]**, **[INFERÊNCIA]**, **[PENDÊNCIA]**.

## Critério de prioridade

- **P0:** caminho de exploração/exposição imediato ou credencial materialmente comprometida; iniciar contenção antes de staging.
- **P1:** bloqueia uma liberação responsável para staging/produção.
- **P2:** hardening necessário, mas não depende de exploração imediata comprovada.
- **P3:** manutenção, legibilidade, desempenho ou remoção futura.

## P0 — contenção imediata

### P0-01 — Stored XSS no popup Mapbox com acesso à sessão

- **Evidência [FATO]:** o mapa injeta `markerData.popup` com `.setHTML()` (`src/components/map/MapboxMap.tsx:110-116`). `ProfileAbout` monta HTML com nome, especialidade e endereço persistidos (`src/components/perfil/ProfileAbout.jsx:127-136`). Cadastro/upsert validam trim/tamanho, mas não neutralizam HTML (`supabase/functions/register-professional/validation.ts:26-113`, `supabase/functions/upsert-professional-profile/validation.ts:44-73`), e o serviço persiste o texto (`supabase/functions/upsert-professional-profile/service.ts:67-125`). A sessão, incluindo refresh token, fica em `localStorage` (`src/client-api/session.js:1-99`).
- **Caminho teórico:** profissional cadastra/aprova conteúdo HTML ativo em campo do perfil/endereço → visitante abre perfil e consente com o mapa → Mapbox cria popup via HTML → código executa na origem da aplicação → lê `rd.auth.session.v1` e age como vítima. Não foi executado payload real.
- **Impacto:** sequestro persistente de contas paciente/profissional/admin, leitura de dados clínicos/financeiros e mutações autenticadas.
- **Probabilidade:** alta; sink e entrada persistida estão conectados no código. Exige perfil controlado/aprovado e interação com mapa.
- **Correção proposta:** substituir HTML por DOM/text nodes ou Popup com conteúdo React/`textContent`; não concatenar string; validar/normalizar campos no backend como defesa adicional; considerar CSP e migração futura da sessão para mecanismo menos acessível a script.
- **Testes necessários:** unitário com `<`, aspas e entidades em todos os campos; teste de componente que confirme ausência de `setHTML`; E2E local descartável verificando texto literal e que nenhum evento/script executa; regressão com endereço.
- **Dependências:** decisão de rendering do Mapbox; limpeza segura de perfis já persistidos; rotação de sessões conforme P0-03.
- **Concluído quando:** nenhum dado de perfil chega a sink HTML; testes negativos passam; registros existentes são inspecionados/saneados; CSP mínima está habilitada e sessão pós-incidente foi rotacionada.

### P0-02 — Injeção no compartilhamento/impressão do QR

- **Evidência [FATO]:** `ProfileShare` interpola nome/especialidade/URL em um documento aberto e chama `document.write` (`src/components/perfil/ProfileShare.jsx:39-58`). A janela `about:blank` herda origin/opener. O WhatsApp é aberto por `window.open` sem `noopener,noreferrer` (`src/components/perfil/ProfileShare.jsx:24-37`). O QR usa serviço externo (`src/components/perfil/ProfileShare.jsx:5-16`).
- **Caminho teórico:** perfil persistido contém fechamento de markup → vítima clica imprimir QR → HTML executa na janela de mesma origem e alcança opener/storage. Não foi executado payload real.
- **Impacto:** tomada de sessão, alteração da janela principal e exposição da URL pública a terceiro.
- **Probabilidade:** alta para a injeção após clique; depende de campo persistido malicioso.
- **Correção proposta:** construir impressão por elementos DOM com `textContent` ou template estático sem interpolação HTML; validar URL como `https:` e origem esperada; usar `noopener,noreferrer`; preferir QR gerado localmente ou formalizar o fornecedor.
- **Testes necessários:** strings adversariais em nome/especialidade; espionagem de `document.write`; teste de `window.open` e `opener`; snapshot do QR com URL codificada.
- **Dependências:** política de QR/fornecedor e mesma limpeza de perfil do P0-01.
- **Concluído quando:** zero `document.write`/HTML concatenado no fluxo; todas as novas janelas isoladas; QR não vaza URL a fornecedor não aprovado, ou aprovação/contrato documentados; regressões passam.

### P0-03 — Credenciais, senhas E2E e refresh tokens no histórico Git

- **Evidência [FATO]:** versões históricas de `.env`, `tests/e2e/.env.e2e` e `tests/e2e/.auth/{patient,professional}.json` contêm valores não vazios. O estado local atual também contém access/refresh token. As regras de ignore atuais evitam novo tracking, mas não removem o comprometimento passado.
- **Impacto:** acesso não autorizado a contas e provedores, custos, dados pessoais/clínicos e persistência via refresh token.
- **Probabilidade:** desconhecida quanto à validade atual; exposição no histórico torna a probabilidade operacional alta o suficiente para contenção imediata.
- **Correção proposta:** revogar globalmente sessões das contas E2E; trocar senhas e todos os secrets/tokens que apareceram; revisar logs; remover material do histórico com procedimento coordenado e invalidar forks/clones; adotar secret scanning/pre-commit/CI; usar contas descartáveis e auth state efêmero.
- **Testes necessários:** inventário automatizado de histórico sem imprimir valores; confirmar IDs/versões rotacionados no provedor; login com credencial antiga deve falhar; secret scanner bloqueia fixture real.
- **Dependências:** acesso administrativo a Supabase/Mapbox e demais provedores; coordenação com donos de clones; plano de incidente. Conforme o Regulamento de Comunicação de Incidente da ANPD, avaliar formalmente risco e manter registros quando houver dados sensíveis/autenticação: [fonte oficial](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca).
- **Concluído quando:** todos os artefatos expostos têm rotação/revogação comprovada por identificador/data (sem valor no relatório); busca do histórico limpo/novo clone não encontra segredo; logs e obrigação de incidente foram avaliados e registrados.

## Auditoria das demais superfícies frontend

- **[FATO]** A busca completa por sinks encontrou `dangerouslySetInnerHTML` somente na geração de CSS de gráfico a partir de configuração interna (`src/components/ui/chart.tsx:68-86`); nenhum dado de usuário foi ligado a esse sink. Os usos de `innerHTML` apenas esvaziam containers do Zoom (`src/hooks/useZoomSession.ts:200-200`, `src/hooks/useZoomSession.ts:446-545`). Não foram encontrados `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function` ou `postMessage` em código de produção.
- **[FATO]** `document.write`, `setHTML` e `window.open` estão nos dois caminhos P0 (`src/components/perfil/ProfileShare.jsx:24-58`, `src/components/map/MapboxMap.tsx:110-116`).
- **[FATO]** Além da sessão em localStorage, estados temporários clínicos e financeiros ficam em sessionStorage: retomada de consulta (`src/Layout.jsx:122-122`, `src/pages/Teleconsulta.jsx:289-293`), wizard de laudo/plantão (`src/lib/solicitacoesExames.js:138-164`, `src/lib/solicitacoesExames.js:289-315`) e retorno de pagamento (`src/components/payments/PaymentStep.jsx:59-59`). A aplicação inventaria esses usos para transparência (`src/config/browser-storage.ts:13-168`).
- **[FATO]** Não foi localizado iframe de aplicação. Checkout é redirect de página para URL de backend/provedor (`src/components/payments/PaymentStep.jsx:205-218`, `src/pages/Planos.jsx:380-389`), e export navega para URL assinada (`src/components/privacy/PrivacyRightsPanel.jsx:68-68`). Os hardenings de URL estão em P2-01.
- **[FATO]** Não existe configuração de CSP/headers no repositório; o runbook atribui isso ao hosting ainda indefinido (`docs/staging-environment-runbook.md:132-150`).
- **[INFERÊNCIA]** A observabilidade compartilhada reduz conteúdo a IDs/códigos, mas diversos serviços usam `console.*` diretamente. Não foi comprovado vazamento atual de texto clínico; uma política/teste de redaction continua necessária (`supabase/functions/_shared/observability.ts:35-123`, `supabase/functions/groq-completion/index.ts:175-205`).

## P1 — bloqueios de staging/produção

### P1-01 — Fechar a matriz negativa de autorização, sobretudo `read-models`

- **Evidência [FATO]:** todas as funções usam validação manual porque `verify_jwt=false` (`supabase/config.toml:3-202`). `read-models` usa allowlist de entidades, mas retorna `*` em modos privados, aceita coluna de filtro/ordenação e torna limite opcional (`supabase/functions/read-models/index.ts:448-523`, `supabase/functions/read-models/index.ts:739-795`). A leitura pública de agendamentos aceita `patient_id`, formando oráculo de relação. Testes atuais são principalmente source checks (`src/test/medical-request-access-hardening.test.ts:10-89`).
- **Impacto/probabilidade:** crítico/mediana; qualquer omissão manual vira IDOR via service role.
- **Correção proposta:** contratos por modo com colunas, filtros, ordenações e limite default estritos; eliminar `*`; negar identificadores de terceiros no público; consolidar helper de autorização.
- **Testes:** Pac A→Pac B; Pro A→consulta Pro B; Pac→Pro; Pro→Adm; conta inativa; bearer inválido/expirado; recurso ausente; UUID previsível; paginação e filtros proibidos, para cada família de função.
- **Dependências:** fixtures isoladas e banco local/staging seguro.
- **Concluído quando:** matriz de 67 funções revisada por código + testes de integração; todos os casos retornam 401/403/404 sem oráculo; cobertura de `read-models` por modo e coluna está automatizada.

### P1-02 — Tornar staging identificável, fechado e reproduzível

- **Evidência [TESTE]:** `npm run check:staging` falhou com 32 erros/1 warning. Hosting/domínio continuam indefinidos (`docs/staging-environment-runbook.md:10-13`, `docs/staging-environment-runbook.md:132-150`); URLs/CORS e fornecedores estão incompletos (`scripts/check-staging-readiness.mjs:192-279`).
- **Impacto/probabilidade:** alto/certa; não existe baseline implantável verificável.
- **Correção proposta:** definir host/domínio TLS, `APP_BASE_URL`, CORS mínimo, Supabase exclusivo de staging, secrets por cofre, callbacks/webhooks e headers CSP/HSTS/referrer/permissions; fixar Node/npm.
- **Testes:** readiness zero erros; smoke público; CORS origem autorizada e negada; headers; callback/webhook; bundle sem secrets; DNS/TLS.
- **Dependências:** decisão de provedor e domínio, projeto Supabase e contas sandbox.
- **Concluído quando:** runbook tem valores não secretos reais/owners; `check:staging` passa; deploy dry-run reproduzível e inventário remoto bate com commit.

### P1-03 — Reconciliar estado remoto de migrações, RLS, Storage e funções

- **Evidência [PENDÊNCIA]:** 50 migrações são estaticamente ordenadas e o hardening pretende FORCE RLS/service role (`supabase/migrations/20260712150000_harden_rls_storage_and_rpc.sql:8-92`), mas nenhuma foi aplicada ou comparada ao remoto nesta rodada. Há 67 funções configuradas; `simulate-payment-paid` ainda tem seção local (`supabase/config.toml:165-166`).
- **Impacto/probabilidade:** crítico/mediana; drift pode reabrir policies, omitir triggers ou publicar simulação.
- **Correção proposta:** export read-only de migration history, schemas/policies/grants/buckets/functions/secrets-names; comparar com commit; planejar aplicação em clone descartável antes de staging.
- **Testes:** banco vazio + upgrade de snapshot; asserts de FORCE RLS/revokes; anon/authenticated negados; service role apenas via função; inventário remoto prova ausência da simulação.
- **Dependências:** acesso read-only inicialmente e backup/restore testado.
- **Concluído quando:** relatório de drift é zero ou cada diferença tem migração aprovada; lista remota de funções coincide e simulação está ausente/desabilitada.

### P1-04 — Corrigir dependências vulneráveis com upgrade controlado

- **Evidência [TESTE]:** `npm ci` reportou 20 vulnerabilidades: 1 crítica, 15 altas, 3 moderadas e 1 baixa. Vitest direto tem advisory crítico; Vite, React Router DOM e PostCSS têm alertas altos. Build usa Vite 5.4.19.
- **Impacto/probabilidade:** alto/mediana; risco maior em servidor de desenvolvimento/teste exposto e dependências de roteamento/build.
- **Correção proposta:** mapear caminhos com `npm audit`, atualizar diretamente para versões corrigidas compatíveis, uma família por vez; nunca expor Vitest UI/dev server; gerar SBOM e política de atualização.
- **Testes:** `npm ci`, unit, build, lint, E2E seguro e `npm audit` sem crítico/alto alcançável; regressão de rotas.
- **Dependências:** Node LTS escolhido e correção prévia da coleta E2E.
- **Concluído quando:** lockfile reproduzível, zero crítico/alto aceito sem risk waiver documentado e todos os baselines passam.

### P1-05 — Suíte E2E não coleta e contém mutações em contas compartilhadas

- **Evidência [TESTE]:** `npm run test:e2e -- --list` falha em `tests/e2e/teleconsulta/payment-flow.spec.ts:90` e `tests/e2e/teleconsulta/payment-flow.spec.ts:180`. O setup regrava auth (`tests/e2e/support/global-setup.ts:40-87`). Há saves reais não guardados em `tests/e2e/professional/meu-perfil.spec.ts:84-101` e `tests/e2e/professional/edit-and-deactivate.spec.ts:140-176`; somente a desativação exige flag (`tests/e2e/professional/edit-and-deactivate.spec.ts:249-280`).
- **Impacto/probabilidade:** alto/certa; não há baseline E2E e uma execução ingênua altera dados compartilhados.
- **Correção proposta:** corrigir fixtures, classificar cada spec public/auth/read-only/mutating/destructive, criar tenants/contas descartáveis e teardown; default deny para mutação; estados fora do Git.
- **Testes:** `--list` passa e produz inventário; execução public/read-only; mutações somente em dados com prefixo/run-id; scanner garante ausência de token.
- **Dependências:** ambiente local/staging sandbox e seeds idempotentes.
- **Concluído quando:** coleta completa das 40 specs; nenhuma conta compartilhada sofre alteração; CI separa suites e publica resultados atuais.

### P1-06 — Governança de IA clínica e prontuário antes da vigência da CFM 2.454/2026

- **Evidência [FATO]:** Groq usa `llama-3.1-8b-instant` e prompt com transcrição direta (`supabase/functions/groq-completion/index.ts:134-162`); frontend apenas faz `JSON.parse`/strings (`src/components/teleconsulta/PreenchimentoAutomaticoProntuario.tsx:53-75`) e permite salvar logo após preenchimento (`src/components/teleconsulta/ProntuarioForm.jsx:85-146`, `src/components/teleconsulta/ProntuarioForm.jsx:196-212`). Auditoria não registra modelo/prompt; prontuário não registra IA (`supabase/functions/groq-completion/index.ts:175-205`).
- **Impacto/probabilidade:** crítico/alta; alucinação/prompt injection pode contaminar registro clínico, e a governança existente é insuficiente.
- **Correção proposta:** avaliação de risco e finalidade; schema fechado; separar instrução/dado, validar saída e limitar campos; exigir confirmação humana explícita; registrar uso, fornecedor, modelo, versão de prompt, timestamps e decisão/revisão no prontuário/audit; informar paciente e respeitar recusa; política de monitoramento/incidente.
- **Testes:** transcrição adversarial/prompt injection; JSON inválido/parcial; alucinação conhecida; timeout/cancelamento; bloqueio sem consentimento; impossibilidade de salvar sugestão não confirmada; trilha auditável.
- **Dependências:** responsável clínico, jurídico/DPO, contratos dos fornecedores e desenho de retificação. Fontes oficiais: [CFM 2.454/2026](https://sistemas.cfm.org.br/normas/visualizar/resolucoes/br/2026/2454), [CFM 2.314/2022](https://www.sistemas.cfm.org.br/normas/visualizar/resolucoes/BR/2022/2314).
- **Concluído quando:** avaliação de risco aprovada; modelo/prompt versionados; consentimento/informação e recusa funcionam; cada entrada assistida é rastreável e confirmada pelo médico; auditoria clínica passa.

### P1-07 — Dados empresariais, termos e matriz de retenção são placeholders

- **Evidência [FATO]:** `src/config/legal.ts:12-32`, `docs/legal-and-privacy-staging.md:18-24` e `docs/privacy-rights-and-account-lifecycle-staging.md:45-55` registram pendências de empresa, contato, responsável e retenção.
- **Impacto/probabilidade:** alto/certa; consentimento de tela não supre transparência, base legal ou retenção definida.
- **Correção proposta:** preencher dados aprovados; mapear finalidade/base legal/controlador-operador/subprocessador/localização/retenção/descarte por tabela, storage, log e fornecedor; versionar documentos.
- **Testes:** rendering/versionamento; evento legal aponta versão efetiva; revogação e mudança de termos; jobs de retenção em dry-run.
- **Dependências:** empresa, responsável técnico, jurídico/DPO e contratos.
- **Concluído quando:** zero placeholder; matriz aprovada e implementada; cada evento referencia documento/versionamento imutável.

### P1-08 — Lint sem baseline confiável

- **Evidência [TESTE]:** 100 erros/21 warnings; cópias em `tmp/claude-tests-review*` multiplicam falhas, mas há erros reais em `UpcomingAppointments.jsx:75`, `PreenchimentoAutomaticoProntuario.tsx:18-378`, `useZoomSession.ts`, UI e `tailwind.config.ts:96`.
- **Impacto/probabilidade:** médio/certa; o gate não distingue regressão de ruído, inclusive em código clínico.
- **Correção proposta:** excluir somente artefatos locais conhecidos na config, registrar baseline real e corrigir por domínio, começando teleconsulta/IA/auth/payments; não auto-reescrever.
- **Testes:** lint zero ou baseline temporário explícito/decrescente; unit/build após cada lote.
- **Dependências:** decisão de política TS/ESLint.
- **Concluído quando:** `npm run lint` passa no checkout limpo e CI o exige.

## P2 — hardening

### P2-01 — URLs, redirects e janelas

- **Evidência [FATO]:** `instagram_url` persistida é usada em `href` sem allowlist de esquema (`src/components/perfil/ProfileHero.jsx:97-102`). Checkout navega para URL devolvida pelo backend/provedor sem allowlist frontend (`src/components/payments/PaymentStep.jsx:205-218`, `src/pages/Planos.jsx:380-389`). WhatsApp abre sem isolamento (`src/components/perfil/ProfileShare.jsx:24-37`).
- **Impacto/probabilidade:** alto/mediana. **Correção:** parser URL, somente `https:` e hosts aprovados; `noopener,noreferrer`; callback state. **Testes:** `javascript:`, `data:`, userinfo, subdomínio enganoso, CRLF. **Concluído:** todo sink de navegação usa validador central e testes.

### P2-02 — Upload valida MIME declarado, não conteúdo

- **Evidência [FATO]:** regras de bucket/tamanho/MIME/ext em `supabase/functions/upload-file/index.ts:18-129`; nenhuma assinatura/magic bytes. Storage é privado (`supabase/migrations/20260712150000_harden_rls_storage_and_rpc.sql:58-92`).
- **Impacto/probabilidade:** alto/mediana. **Correção:** sniffing seguro, reencode quando aplicável, nomes gerados, antivírus/quarentena, Content-Disposition/Content-Type seguros. **Testes:** polyglot, extensão dupla, SVG/HTML, zip bomb, path traversal. **Concluído:** arquivo ativo não é servido inline e conteúdo incompatível é rejeitado/quarentenado.

### P2-03 — Export LGPD pode persistir e truncar silenciosamente

- **Evidência [FATO]:** limite fixo de 1.000 por tabela, URL 5 min e reuso de caminho em `supabase/functions/generate-my-privacy-data-export/index.ts:10-163`; a migração declara ausência de auto-delete (`supabase/migrations/20260712230000_add_privacy_rights_account_lifecycle.sql:133-138`).
- **Impacto/probabilidade:** crítico/mediana. **Correção:** paginação total, manifesto/contagens, criptografia, job de expiração/delete e audit; não confundir expiração da URL com remoção. **Testes:** >1.000 linhas, arquivo expirado/removido, retry, falha parcial, autorização cruzada. **Concluído:** export completo verificável e objeto removido no SLA da matriz.

### P2-04 — Prontuário sobrescrevível e sem assinatura/retificação

- **Evidência [FATO]:** upsert atualiza linha (`supabase/functions/upsert-prontuario/repository.ts:224-263`); validação mínima em `supabase/functions/upsert-prontuario/validation.ts:7-82`; finish exige subset (`supabase/functions/finish-consulta/service.ts:17-165`).
- **Impacto/probabilidade:** crítico/alta. **Correção:** versões append-only/adendos, autor/timestamp, hash/assinatura adequada, campos clínicos/documentos/consentimentos/IA e trilha de retificação. **Testes:** concorrência, edição após encerramento, assinatura, adendo e audit. **Dependências:** responsável clínico e requisitos legais. **Concluído:** nenhuma alteração destrói versão anterior e documento exportável demonstra integridade/autoria.

### P2-05 — Minimização, retenção e erro/log

- **Evidência [FATO]:** Zoom persiste payload JSON completo (`supabase/migrations/20260429120000_create_zoom_webhook_events.sql:1-47`); respostas podem expor `details` (`supabase/functions/_shared/http.ts:119-138`). Observabilidade compartilhada prefere IDs (`supabase/functions/_shared/observability.ts:35-53`, `supabase/functions/_shared/observability.ts:84-123`), mas logs ad hoc não têm política global.
- **Impacto/probabilidade:** alto/mediana. **Correção:** allowlist/redaction, erro público opaco+correlation ID, retenção por evento, varredura de logs e payloads clínicos. **Testes:** secrets/PII/PHI nunca aparecem em logs/respostas; purge por SLA. **Concluído:** schema mínimo e política automatizada auditada.

### P2-06 — Rate limiting e abuso

- **Evidência [FATO]:** foi localizado limite 5/h apenas em privacidade (`supabase/functions/create-privacy-rights-request/index.ts:67-74`); login, refresh, cadastro, pergunta, upload e tokens externos não têm limitador de aplicação uniforme confirmado.
- **Impacto/probabilidade:** alto/mediana. **Correção:** limites por IP/conta/recurso e custo, backoff, captcha onde proporcional, métricas/alertas. **Testes:** burst, concorrência distribuída, headers e fail-safe. **Concluído:** política cobre endpoints públicos/caros e abuso dispara alerta sem bloquear consulta legítima.

### P2-07 — Idempotência e webhook Mercado Pago

- **Evidência [FATO]:** eventos têm ID/hash únicos (`supabase/migrations/20260418090000_create_pricing_and_payment_base.sql:174-215`) e a assinatura é checada (`supabase/functions/_shared/payments/providers/real-provider.ts:335-364`), mas não foi localizada janela de frescor equivalente aos 300 s do Stripe (`supabase/functions/_shared/payments/providers/stripe-provider.ts:454-482`).
- **Impacto/probabilidade:** alto/baixa-mediana devido à deduplicação. **Correção:** validar timestamp/frescor conforme especificação oficial, preservar raw body e reconciliar eventos fora de ordem. **Testes:** duplicado, replay tardio, assinatura inválida, evento fora de ordem, valor/moeda divergentes. **Concluído:** matriz de ambos os provedores passa e replay não muda ledger.

### P2-08 — `simulate-payment-paid` depende também de disciplina de deploy

- **Evidência [FATO]:** runtime fail-closed e script a exclui (`supabase/functions/simulate-payment-paid/handler.ts:90-102`, `scripts/deploy-staging-functions.ps1:9-79`), mas a função permanece configurada (`supabase/config.toml:165-166`).
- **Impacto/probabilidade:** crítico/baixa enquanto env correto; alta se publicação/env forem errados. **Correção:** separar config/projeto local, CI denylist e assert remoto pós-deploy. **Testes:** pipeline falha se artefato entra; inventário staging/prod não contém nome; chamada sempre 404. **Concluído:** impossibilidade técnica comprovada, não só convenção.

## P3 — manutenção

### P3-01 — Código aparentemente órfão

- **Evidência [INFERÊNCIA]:** `backend/src/domains/**` não possui consumidor/runtime localizado; `supabase/functions/upload-public-file` está vazio e sem config.
- **Impacto/probabilidade:** baixo/certa para confusão. **Correção:** confirmar com owners/histórico e remover em PR isolado ou documentar uso. **Testes:** imports/build/deploy inventory. **Concluído:** cada item é ativo documentado ou removido com prova.

### P3-02 — TypeScript permissivo e JS/TS duplicados

- **Evidência [FATO]:** `allowJs`, `strict:false`, `noImplicitAny:false` (`tsconfig.json:3-13`, `tsconfig.app.json:15-26`); 116 JS/JSX e 94 TS/TSX em `src`.
- **Impacto/probabilidade:** médio/alta para defeitos silenciosos. **Correção:** strict incremental por domínio, começando auth/pagamentos/teleconsulta; contratos únicos para client API. **Testes:** typecheck dedicado e redução mensurável de `any`. **Concluído:** áreas críticas strict e CI impede regressão.

### P3-03 — Tooling, chunks e runtime não fixado

- **Evidência [TESTE/FATO]:** build alerta chunks ~891 KB, 1,77 MB e 518 KB; Browserslist antigo; projeto não declara Node/npm; ESLint lê `tmp` ignorado pelo Git.
- **Impacto/probabilidade:** médio/certa. **Correção:** fixar Node LTS/npm, excluir tmp de tooling, lazy split de Mapbox/teleconsulta e budgets. **Testes:** build size budget, cold load e CI em runtime fixo. **Concluído:** build reproduzível, sem varredura de tmp e chunks dentro de orçamento aprovado.

### P3-04 — Branch `origin/doidao`

- **Evidência [FATO/HISTÓRICO]:** 2 commits próprios, 85 atrás; contém documentação e RPC de fila sem migração correspondente comprovada.
- **Impacto/probabilidade:** baixo/mediana para perda/confusão. **Correção:** extrair requisitos/documentação útil e reimplementar atomicidade sobre `main` com migração/teste; não fazer merge bruto. **Concluído:** decisão registrada e branch arquivada ou conteúdo reaplicado com testes.

## Gate objetivo de liberação

Staging não deve receber tráfego ou dados reais enquanto qualquer condição abaixo falhar:

1. Todos os P0 fechados e rotação/revogação comprovada.
2. `npm ci`, funções-config, unit, build, lint, staging readiness e `playwright --list` passam em runtime fixo.
3. E2E público/read-only passa; E2E mutante usa exclusivamente dados descartáveis.
4. Matriz negativa de autorização passa contra ambiente isolado.
5. Drift remoto de migrações/RLS/Storage/funções é zero; `simulate-payment-paid` está ausente.
6. Hosting, domínio, CORS, CSP e headers estão definidos/testados.
7. Dados empresariais, documentos legais e matriz de retenção não têm placeholders.
8. IA clínica tem governança, registro e revisão humana verificáveis antes da entrada em vigor da Resolução CFM 2.454/2026.

Produção exige adicionalmente ensaio de backup/restore, reconciliação financeira, webhooks sandbox→produção, resposta a incidente, monitoramento, contratos/retention de fornecedores e aceite clínico/jurídico. Este documento não é parecer jurídico nem certificação de conformidade.
