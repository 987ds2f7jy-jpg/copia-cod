# Auditoria comparativa Playwright - files.zip

Data: 2026-05-09

Escopo executado:

- ZIP extraido em `tmp/claude-tests-review-full`.
- Todos os 37 arquivos do ZIP foram listados e lidos integralmente.
- Comparacao feita contra `tests/e2e`, `tests/e2e/support` e `package.json`.
- Nao foram executados testes, build ou install.
- Nenhum arquivo de producao do app foi alterado.
- Integracao foi seletiva: nada do ZIP foi copiado por cima dos arquivos atuais.

## 1. Inventario completo do ZIP

Total de arquivos encontrados no ZIP: 37.

```text
access-control.spec.ts
aprovacao.spec.ts
aprovacao-smoke.spec.ts
auth-harness.ts
by-profile.spec.ts
by-specialty.spec.ts
cancellation.spec.ts
constants.ts
consulta-agora.spec.ts
critical-paths.spec.ts
dashboard-error-loading.spec.ts
disponibilidade.spec.ts
edit-and-deactivate.spec.ts
especialidades-home.spec.ts
financeiro.spec.ts
financeiro-banking.spec.ts
fixtures.ts
global-setup.ts
laudos-steps.spec.ts
login.spec.ts
logout.spec.ts
meu-perfil.spec.ts
package.json
pagamento-retorno.spec.ts
page-helpers.ts
patient-dashboard.spec.ts
payment-flow.spec.ts
pergunte-especialista.spec.ts
planos.spec.ts
professional-dashboard.spec.ts
queue-widget.spec.ts
register.spec.ts
register-professional.spec.ts
renovacao-receitas-completo.spec.ts
room-access.spec.ts
room-flow.spec.ts
servicos-extras.spec.ts
```

## 2. Decisao por arquivo do ZIP

| Arquivo do ZIP | Tipo | Equivalente atual | Classificacao | Destino final | Motivo tecnico |
|---|---|---|---|---|---|
| `access-control.spec.ts` | spec auth | `tests/e2e/auth/access-control.spec.ts` | Descartado por duplicidade | preservado atual | O atual tem cobertura mais ampla de rotas por role, inclui rotas de paciente/profissional adicionadas depois da primeira auditoria e evita regressao em admin fora de escopo. |
| `aprovacao.spec.ts` | spec admin | `tests/e2e/admin/aprovacao.spec.ts` | Nao incorporado porque depende de admin ainda nao definido | preservado atual | O ZIP assume conteudo do dashboard admin; o requisito atual permite apenas bloqueio/acesso restrito. |
| `aprovacao-smoke.spec.ts` | spec admin/smoke | `tests/e2e/aprovacao-smoke.spec.ts` | Descartado por duplicidade | preservado atual | O atual ja valida bloqueio para sem sessao, paciente e profissional sem aprofundar admin. |
| `auth-harness.ts` | helper | `tests/e2e/support/auth-harness.ts` | Descartado por duplicidade | preservado atual | Arquivo identico ao atual. |
| `by-profile.spec.ts` | spec scheduling | `tests/e2e/scheduling/by-profile.spec.ts` | Descartado por duplicidade | preservado atual | O atual tem a versao melhor: diferencia fluxo por perfil, documenta seed, conflito de horario e profissional tentando agendar. |
| `by-specialty.spec.ts` | spec scheduling | `tests/e2e/scheduling/by-specialty.spec.ts` | Descartado por duplicidade | preservado atual | O ZIP ainda usa sinais visuais/classes em alguns pontos; o atual usa `aria-pressed` e cobre melhor step 3/4. |
| `cancellation.spec.ts` | spec scheduling | `tests/e2e/scheduling/cancellation.spec.ts` | Parcialmente aproveitado como referencia, sem alteracao | preservado atual | O ZIP trazia checks de labels/estados vazios, mas eles ja existem em `patient-dashboard` e `cancellation`; adicionar seria duplicidade. |
| `constants.ts` | constants | `tests/e2e/support/constants.ts` | Nao incorporado por ser inferior ao atual | preservado atual | O ZIP nao traz rotas atuais como `recuperarSenha`, `meuProntuario`, `meusPagamentos`, `pagamentoStatus`, `PATIENT_ROUTES` e `PAYMENT_STATUS_ROUTES`. |
| `consulta-agora.spec.ts` | spec patient | `tests/e2e/patient/consulta-agora.spec.ts` | Fundido com teste existente | `tests/e2e/patient/consulta-agora.spec.ts` | Aproveitadas verificacoes do step de fila: posicao/tempo estimado, aviso de manter pagina aberta e botao `Sair da Fila` habilitado. |
| `critical-paths.spec.ts` | spec smoke | `tests/e2e/smoke/critical-paths.spec.ts` | Descartado por duplicidade | preservado atual | O atual ja cobre smoke publico/protegido com rotas reais e aliases. |
| `dashboard-error-loading.spec.ts` | spec professional | `tests/e2e/professional/dashboard-error-loading.spec.ts` | Descartado por incorreto/obsoleto | preservado atual | O ZIP mockava endpoints antigos; o atual usa `get-professional-dashboard`, que e o endpoint real do dashboard. |
| `disponibilidade.spec.ts` | spec professional | `tests/e2e/professional/disponibilidade.spec.ts` | Mantido como ideia futura | preservado atual | O ZIP testa salvamento/erro, mas a suite atual evita salvar disponibilidade da conta compartilhada no bloco padrao. Ideia futura: mockar erro de save sem persistencia. |
| `edit-and-deactivate.spec.ts` | spec professional | `tests/e2e/professional/edit-and-deactivate.spec.ts` | Descartado por duplicidade | preservado atual | O atual e equivalente e mais seguro no login destrutivo/conta descartavel. |
| `especialidades-home.spec.ts` | spec patient/public | `tests/e2e/patient/especialidades-home.spec.ts` | Descartado por duplicidade | preservado atual | Arquivo identico ao atual. |
| `financeiro.spec.ts` | spec professional | `tests/e2e/professional/financeiro.spec.ts` | Parcialmente aproveitado | `tests/e2e/professional/financeiro.spec.ts` | Incorporada cobertura condicional do modal de saque com `E2E_HAS_SALDO`; teste existente do botao de saque foi fortalecido. |
| `financeiro-banking.spec.ts` | spec professional | `tests/e2e/professional/financeiro-banking.spec.ts` | Descartado por duplicidade | preservado atual | O atual tem escopo de dialog melhor, helpers para transferencia e evita persistencia acidental ao fechar com Escape. |
| `fixtures.ts` | fixture | `tests/e2e/support/fixtures.ts` | Nao incorporado por ser inferior ao atual | preservado atual | O atual usa seletores de senha com `exact: true`, reduzindo ambiguidade no login/setup. |
| `global-setup.ts` | global setup | `tests/e2e/support/global-setup.ts` | Nao incorporado por ser inferior ao atual | preservado atual | O atual trata admin como opcional e grava `admin.json` vazio quando nao ha credencial; o ZIP tentava sempre logar admin. |
| `laudos-steps.spec.ts` | spec patient | `tests/e2e/patient/laudos-steps.spec.ts` | Descartado por duplicidade | preservado atual | O atual e mais enxuto, usa helpers locais e cobre o wizard real sem inflar testes repetidos. |
| `login.spec.ts` | spec auth | `tests/e2e/auth/login.spec.ts` | Descartado por duplicidade/obsoleto | preservado atual | O atual ja cobre `/RecuperarSenha` real e usa labels mais precisos; o ZIP tratava recuperacao como lacuna. |
| `logout.spec.ts` | spec auth | `tests/e2e/auth/logout.spec.ts` | Descartado por duplicidade | preservado atual | Arquivo identico ao atual. |
| `meu-perfil.spec.ts` | spec professional | `tests/e2e/professional/meu-perfil.spec.ts` | Parcialmente aproveitado | `tests/e2e/professional/meu-perfil.spec.ts` | Aproveitada cobertura das secoes publicas do perfil, valores, visibilidade e atalho `Ver perfil`; removida dependencia de salvar dados reais. |
| `package.json` | package/script | `package.json` | Nao incorporado | preservado atual | Scripts do ZIP eram menos completos e nao tinham os blocos atuais; nenhuma dependencia nova era necessaria. |
| `pagamento-retorno.spec.ts` | spec teleconsulta/payment | sem equivalente direto | Descartado por estar incorreto em relacao ao app atual | nenhum | O app real usa auto-redirect e nao exibe CTAs `Ver painel`/`Voltar ao inicio`; o spec do ZIP reintroduziria slugs/UX antigos. |
| `page-helpers.ts` | helper | `tests/e2e/support/page-helpers.ts` | Descartado por duplicidade | preservado atual | Arquivo identico ao atual. |
| `patient-dashboard.spec.ts` | spec patient | `tests/e2e/patient/patient-dashboard.spec.ts` | Descartado por duplicidade | preservado atual | Arquivo identico ao atual. |
| `payment-flow.spec.ts` | spec teleconsulta/payment | `tests/e2e/teleconsulta/payment-flow.spec.ts` | Descartado por duplicidade | preservado atual | O atual ja usa os status reais `sucesso`, `falha`, `pendente` e documenta ausencia de CTAs no retorno automatico. |
| `pergunte-especialista.spec.ts` | spec patient/public | `tests/e2e/patient/pergunte-especialista.spec.ts` | Descartado por duplicidade | preservado atual | Arquivo identico ao atual. |
| `planos.spec.ts` | spec patient/public | `tests/e2e/patient/planos.spec.ts` | Descartado por duplicidade | preservado atual | O atual usa labels/roles e cobre abas, cards, CTAs visuais e formulario comercial sem backend. O ZIP usava seletores por id em pontos que nao melhoravam a estabilidade. |
| `professional-dashboard.spec.ts` | spec professional | `tests/e2e/professional/professional-dashboard.spec.ts` | Descartado por duplicidade | preservado atual | O atual ja cobre KPIs, abas, PlantaoBlock, fila em tempo real, toggle e ProfessionalStatusGate. |
| `queue-widget.spec.ts` | spec professional | sem arquivo separado; cobertura em `professional-dashboard.spec.ts` | Parcialmente aproveitado como criterio, sem novo arquivo | preservado atual | Os checks uteis de fila/estado seguro ja estavam no dashboard profissional. Criar arquivo separado duplicaria cobertura. |
| `register.spec.ts` | spec auth | `tests/e2e/auth/register.spec.ts` | Descartado por duplicidade/bug do teste do ZIP | preservado atual | O ZIP tinha um teste de upload com fixture incompleta; o atual ja documenta via `fixme` a dependencia de seed/upload. |
| `register-professional.spec.ts` | spec auth | `tests/e2e/auth/register-professional.spec.ts` | Descartado por duplicidade | preservado atual | O atual preserva o fluxo e mantem skips/fixmes condicionais mais claros para cadastro real. |
| `renovacao-receitas-completo.spec.ts` | spec patient | `tests/e2e/patient/renovacao-receitas-completo.spec.ts` | Descartado por duplicidade | preservado atual | Arquivo identico ao atual. |
| `room-access.spec.ts` | spec teleconsulta | `tests/e2e/teleconsulta/room-access.spec.ts` | Descartado por duplicidade | preservado atual | Arquivo identico ao atual. |
| `room-flow.spec.ts` | spec scheduling/teleconsulta | `tests/e2e/scheduling/room-flow.spec.ts` | Descartado por duplicidade | preservado atual | O atual cobre mais estados da sala, mensagens amigaveis, permissao, banner e limitacoes de Zoom/TTL. |
| `servicos-extras.spec.ts` | spec patient | `tests/e2e/patient/servicos-extras.spec.ts` | Descartado por duplicidade | preservado atual | Arquivo identico ao atual. |

## 3. Classificacao por teste/describe relevante do ZIP

### access-control.spec.ts

- Rotas publicas carregam sem login: ja existe teste melhor em `auth/access-control.spec.ts`.
- Rotas protegidas redirecionam e salvam `rd_login_next`: ja existe teste melhor.
- Paciente acessa rotas de paciente e bloqueia profissional/admin: ja existe teste melhor, com mais rotas.
- Profissional acessa rotas profissionais e bloqueia paciente/admin: ja existe teste melhor.
- Admin: nao incorporado; dashboard admin fora de escopo.

### aprovacao.spec.ts

- Sem sessao redireciona: ja existe teste melhor.
- Paciente/profissional veem bloqueio: ja existe teste melhor.
- Admin carrega dashboard/filtros/aprovar: nao incorporado porque depende de admin ainda nao definido.

### aprovacao-smoke.spec.ts

- Bloqueio sem sessao/paciente/profissional: ja existe teste melhor.
- Admin smoke/aprovar: nao incorporado porque depende de admin ainda nao definido.

### auth-harness.ts

- `skipIfNoAuth`, validacao de storage e helpers de sessao: duplicado identico, nao incorporado.

### by-profile.spec.ts

- Sem `professional` ou ID invalido: ja existe teste melhor.
- Sem sessao redireciona: ja existe teste melhor.
- Card do profissional/tipos de consulta: ja existe teste melhor.
- Disponibilidade/resumo/voltar: ja existe teste melhor.
- Caminho feliz com `E2E_ALLOW_SCHEDULING`: ja existe teste melhor.
- Profissional tentando agendar: ja existe teste melhor.

### by-specialty.spec.ts

- Protecao por login: ja existe teste melhor.
- Escolha de profissao/subespecialidade: ja existe teste melhor.
- Calendario/slots e continuidade: ja existe teste melhor.
- `aria-pressed`/troca de data: o atual e superior; ZIP usava sinais visuais mais frageis.
- Caminho feliz com flag: ja existe teste melhor.

### cancellation.spec.ts

- Abas Proximas/Historico/Canceladas: ja existe teste melhor.
- Labels de status PT/EN: ja existe teste melhor.
- Estado vazio sem seed: ja coberto tambem por `patient-dashboard`; nao incorporado para evitar duplicidade.
- Cancelamento real: mantido condicionado por flags no atual.

### constants.ts

- Rotas antigas/publicas: nao incorporadas.
- Dados de usuario, URLs e labels: nao incorporados; atual e mais completo e centralizado.

### consulta-agora.spec.ts

- Protecao sem sessao: ja existe teste melhor.
- Formulario/seletores/textarea: ja existe teste melhor.
- Entrada real na fila: incorporado adaptando no teste existente, com verificacoes de posicao, tempo estimado, aviso e saida de fila.
- Profissional acessando a pagina: preservado comportamento real documentado no atual.

### critical-paths.spec.ts

- Home/login/cadastro/especialidades/404: ja existe teste melhor.
- Rotas protegidas sem auth: ja existe teste melhor.
- Alias `/Agendamento`: ja existe teste melhor.

### dashboard-error-loading.spec.ts

- Loading e erro: nao incorporado; ZIP usa endpoints obsoletos.
- Estado de backend falhando: ja existe teste melhor com mock do endpoint real.
- CTA `Completar Cadastro`: ja existe teste melhor.

### disponibilidade.spec.ts

- Dias/slots/botao salvar: ja existe teste melhor, sem depender de classe.
- Alternancia de dia/slot: ja existe teste melhor.
- Salvar disponibilidade/erro de save: util como ideia futura, mas nao incorporado para nao introduzir risco de mutacao/flake na conta compartilhada.

### edit-and-deactivate.spec.ts

- Acesso/estrutura/campos: ja existe teste melhor.
- Salvamento de telefone/cidade: ja existe teste melhor.
- Desativacao real: mantida condicionada por flag no atual.

### especialidades-home.spec.ts

- Todos os testes: duplicados identicos, ja presentes.

### financeiro.spec.ts

- Controle de acesso: ja existe teste melhor.
- KPIs/grafico/secao Saques: ja existe teste melhor.
- Botao `Solicitar Saque`: incorporado adaptando; teste atual agora valida estado de habilitado/desabilitado de forma mais clara.
- Modal de saque: incorporado adaptando com `E2E_HAS_SALDO`, sem executar saque real.

### financeiro-banking.spec.ts

- Modal de dados bancarios: ja existe teste melhor.
- PIX/PF/PJ/TED: ja existe teste melhor.
- Escape sem persistir: atual e superior porque observa request de persistencia.
- Salvar PIX real: mantido com flag no atual.

### fixtures.ts

- `goto`, `clearAuthState`, `loginViaUi`: atual e superior por usar label de senha exato.

### global-setup.ts

- Login paciente/profissional: atual preservado.
- Admin: ZIP nao incorporado porque forca credencial admin; atual trata como opcional.

### laudos-steps.spec.ts

- Identificacao/Saude/Laudo/Documentos: ja existe teste melhor, com helpers e menos repeticao.
- Fluxos destrutivos/upload: nao incorporado alem do que ja existe com flags.

### login.spec.ts

- Tela/validacao/credenciais invalidas/toggle senha: ja existe teste melhor.
- Recuperacao de senha: ZIP estava obsoleto; atual testa `/RecuperarSenha`.
- Login paciente/profissional/rd_login_next/conta inativa: ja existe teste melhor.

### logout.spec.ts

- Todos os testes: duplicados identicos, ja presentes.

### meu-perfil.spec.ts

- Acesso, aba, foto e apresentacao: ja existe teste melhor.
- Secoes publicas do perfil: incorporado adaptando.
- Valores, visibilidade e atalho `Ver perfil`: incorporado adaptando.
- Edicao local de precos sem salvar: incorporado adaptando.
- Salvamento real adicional: nao incorporado para evitar mutacao sem flag nova.

### package.json

- Scripts Playwright genericos: nao incorporados; atual ja tem blocos por area.
- Dependencias: nenhuma adicionada.

### pagamento-retorno.spec.ts

- `/pagamento/sucesso`, `/falha`, `/pendente` com CTAs: incorreto para UI atual.
- Status desconhecido: ja coberto melhor por `teleconsulta/payment-flow.spec.ts`.
- Acessibilidade dos CTAs: nao incorporado porque CTAs nao existem no app atual.

### page-helpers.ts

- Todos os helpers: duplicados identicos, ja presentes.

### patient-dashboard.spec.ts

- Todos os testes: duplicados identicos, ja presentes.

### payment-flow.spec.ts

- Status reais e redirect para login: ja existe teste melhor.
- Retorno automatico e fallback: ja existe teste melhor.
- Step de pagamento da Consulta Agora: ja existe teste melhor.

### pergunte-especialista.spec.ts

- Todos os testes: duplicados identicos, ja presentes.

### planos.spec.ts

- Pagina publica, abas, cards e formulario comercial: ja existe teste melhor.
- Seletores por id/texto mais fragil do ZIP: nao incorporados.

### professional-dashboard.spec.ts

- Dashboard/KPIs/abas/PlantaoBlock: ja existe teste melhor.
- Fila em tempo real: ja existe teste melhor no atual.
- Pending review: ja existe teste melhor.

### queue-widget.spec.ts

- Widget vazio/loading/erro/fila: ja coberto no dashboard profissional atual ou melhor como ideia de mock futuro.
- Acoes profissionais na fila: nao incorporado como arquivo separado para evitar duplicidade; manter em `professional-dashboard` quando necessario.

### register.spec.ts

- Cadastro paciente: ja existe teste melhor.
- Cadastro profissional base dentro do arquivo: ja existe teste melhor.
- Upload de diploma do ZIP: bug do teste do ZIP, nao incorporado.

### register-professional.spec.ts

- Steps 1 a 4: ja existe teste melhor.
- Cadastro completo real: mantido condicionado por flag/fixme no atual.

### renovacao-receitas-completo.spec.ts

- Todos os testes: duplicados identicos, ja presentes.

### room-access.spec.ts

- Todos os testes: duplicados identicos, ja presentes.

### room-flow.spec.ts

- Sem sessao, ID invalido, sem permissao, finalizada, aguardando, banner e TTL: ja existe teste melhor.
- Zoom SDK: mantido documentado como limitacao no atual.

### servicos-extras.spec.ts

- Todos os testes: duplicados identicos, ja presentes.

## 4. Arquivos atuais preservados

Preservados sem alteracao por serem iguais ou superiores ao ZIP:

- `tests/e2e/auth/access-control.spec.ts`
- `tests/e2e/auth/login.spec.ts`
- `tests/e2e/auth/logout.spec.ts`
- `tests/e2e/auth/register.spec.ts`
- `tests/e2e/auth/register-professional.spec.ts`
- `tests/e2e/admin/aprovacao.spec.ts`
- `tests/e2e/aprovacao-smoke.spec.ts`
- `tests/e2e/patient/especialidades-home.spec.ts`
- `tests/e2e/patient/laudos-steps.spec.ts`
- `tests/e2e/patient/patient-dashboard.spec.ts`
- `tests/e2e/patient/pergunte-especialista.spec.ts`
- `tests/e2e/patient/planos.spec.ts`
- `tests/e2e/patient/renovacao-receitas-completo.spec.ts`
- `tests/e2e/patient/servicos-extras.spec.ts`
- `tests/e2e/professional/dashboard-error-loading.spec.ts`
- `tests/e2e/professional/disponibilidade.spec.ts`
- `tests/e2e/professional/edit-and-deactivate.spec.ts`
- `tests/e2e/professional/financeiro-banking.spec.ts`
- `tests/e2e/professional/professional-dashboard.spec.ts`
- `tests/e2e/scheduling/by-profile.spec.ts`
- `tests/e2e/scheduling/by-specialty.spec.ts`
- `tests/e2e/scheduling/cancellation.spec.ts`
- `tests/e2e/scheduling/room-flow.spec.ts`
- `tests/e2e/smoke/critical-paths.spec.ts`
- `tests/e2e/teleconsulta/payment-flow.spec.ts`
- `tests/e2e/teleconsulta/room-access.spec.ts`
- `tests/e2e/support/auth-harness.ts`
- `tests/e2e/support/constants.ts`
- `tests/e2e/support/fixtures.ts`
- `tests/e2e/support/global-setup.ts`
- `tests/e2e/support/page-helpers.ts`
- `package.json`

## 5. Arquivos alterados nesta integracao

- `tests/e2e/patient/consulta-agora.spec.ts`
  - Fundiu checks uteis do ZIP no fluxo existente de fila.
  - Nao criou teste novo; fortaleceu um teste condicionado por `E2E_ALLOW_QUEUE`.

- `tests/e2e/professional/financeiro.spec.ts`
  - Fortaleceu a verificacao do estado do botao `Solicitar Saque`.
  - Adicionou teste condicional do modal de saque com `E2E_HAS_SALDO`.

- `tests/e2e/professional/meu-perfil.spec.ts`
  - Adicionou tres testes nao destrutivos das secoes publicas do perfil profissional.
  - Reutilizou helper local para abrir a aba correta.

- `tests/e2e/README.md`
  - Atualizado para refletir a estrutura real, flags, seeds, mocks e admin fora de escopo.

## 6. Arquivos novos criados

- `tmp/claude-tests-review-full/RELATORIO_AUDITORIA_COMPLETA.md`
  - Relatorio desta auditoria comparativa.

Nenhum novo spec foi criado porque as melhorias cabiam melhor nos specs existentes.

## 7. Testes adicionados por area

Auth:

- Nenhum teste novo. Os specs atuais eram melhores que os do ZIP.

Patient:

- Nenhum novo `test(...)`.
- `patient/consulta-agora.spec.ts` foi fortalecido no teste condicionado por `E2E_ALLOW_QUEUE`, validando conteudo real do step de fila.

Professional:

- `professional/meu-perfil.spec.ts`
  - `exibe especializacao, modalidade e galeria do consultorio @critical`
  - `exibe valores de consulta, visibilidade e atalho publico @critical`
  - `campos de preco podem ser editados localmente sem salvar`

- `professional/financeiro.spec.ts`
  - `modal de saque exibe saldo, valor e confirmacao quando ha seed de saldo @critical`
  - O teste existente de `Solicitar Saque` foi ajustado para validar estado real do botao.

Scheduling:

- Nenhum teste novo. O ZIP duplicava a cobertura atual ou usava seletores menos estaveis.

Teleconsulta:

- Nenhum teste novo. O ZIP trazia `pagamento-retorno.spec.ts` incompatibilizado com a UI real atual.

Smoke:

- Nenhum teste novo. O smoke atual ja cobre as lacunas publicas/protegidas de forma mais limpa.

Support:

- Nenhum helper alterado. `constants.ts`, `fixtures.ts`, `auth-harness.ts`, `page-helpers.ts` e `global-setup.ts` foram preservados.

## 8. Duplicidades encontradas

Duplicidade literal ou praticamente equivalente:

- `auth-harness.ts`
- `page-helpers.ts`
- `logout.spec.ts`
- `especialidades-home.spec.ts`
- `patient-dashboard.spec.ts`
- `pergunte-especialista.spec.ts`
- `renovacao-receitas-completo.spec.ts`
- `room-access.spec.ts`
- `servicos-extras.spec.ts`

Duplicidade funcional com versao atual superior:

- `access-control.spec.ts`
- `by-profile.spec.ts`
- `by-specialty.spec.ts`
- `cancellation.spec.ts`
- `critical-paths.spec.ts`
- `financeiro-banking.spec.ts`
- `laudos-steps.spec.ts`
- `login.spec.ts`
- `planos.spec.ts`
- `professional-dashboard.spec.ts`
- `register.spec.ts`
- `register-professional.spec.ts`
- `room-flow.spec.ts`

## 9. Bugs de teste corrigidos ou evitados

- Evitado bug do ZIP em `register.spec.ts`: teste de upload usava fixture incompleta e nao deveria ser incorporado.
- Evitado bug do ZIP em `pagamento-retorno.spec.ts`: esperava CTAs que a pagina real atual nao exibe.
- Evitado bug/obsolescencia do ZIP em `dashboard-error-loading.spec.ts`: mocks apontavam para endpoints antigos.
- Evitado enfraquecimento de `global-setup.ts`: ZIP tentava autenticar admin mesmo sem credenciais admin.

## 10. Possiveis bugs reais do app identificados

Nenhum bug real do app foi confirmado nesta auditoria, porque o escopo foi comparar testes e nao executar a suite.

Observacoes:

- `pagamento-retorno.spec.ts` do ZIP pressupoe CTAs visiveis em `/pagamento/:status`, mas o app atual usa retorno automatico. Isso foi classificado como teste incorreto/obsoleto, nao como bug do app.
- Testes de salvamento de disponibilidade foram mantidos como ideia futura por risco de mutacao na conta compartilhada, nao por bug confirmado.

## 11. Skips mantidos ou adicionados

Adicionado:

- `E2E_HAS_SALDO` em `professional/financeiro.spec.ts` para validar o modal de saque somente quando a conta profissional tiver receita disponivel.

Mantidos:

- `E2E_ALLOW_REGISTRATION`: cadastro real.
- `E2E_ALLOW_SCHEDULING`: agendamento real.
- `E2E_ALLOW_QUEUE`: fila/plantao real.
- `E2E_ALLOW_SERVICES`: solicitacoes reais de servicos.
- `E2E_ALLOW_UPLOAD`: upload real.
- `E2E_ALLOW_BANKING`: persistencia de dados bancarios.
- `E2E_ALLOW_CANCELLATION`: cancelamento real.
- `E2E_ALLOW_DEACTIVATION`: desativacao real.
- `E2E_PROFESSIONAL_PUBLIC_ID`: agendamento por perfil.
- `E2E_PENDING_PROFESSIONAL_EMAIL`: estado `pending_review`.
- `E2E_HAS_ACTIVE_APPOINTMENT`, `E2E_HAS_COMPLETED_APPOINTMENT`, `E2E_CONSULTA_*_ID`: dados especificos de dashboard/teleconsulta.

Contagem estatica apos as alteracoes:

- `test(...)`/`rdTest(...)`: 371 declaracoes.
- chamadas `skip(...)`: 87.
- chamadas `fixme(...)`: 4.

Esses numeros sao contagem de codigo, nao resultado de execucao.

## 12. Mapa final de cobertura por rota e perfil

Publico:

| Rota | Cobertura final |
|---|---|
| `/` | `smoke/critical-paths.spec.ts`, auth layout/login/logout |
| `/Entrar` | `auth/login.spec.ts`, smoke |
| `/CadastroPaciente` | `auth/register.spec.ts`, smoke |
| `/CadastroProfissional` | `auth/register-professional.spec.ts`, smoke |
| `/Especialidades` | `patient/especialidades-home.spec.ts`, smoke |
| `/Planos` | `patient/planos.spec.ts` |
| `/PergunteEspecialista` | `patient/pergunte-especialista.spec.ts` |
| `/PerfilProfissional` | `scheduling/by-profile.spec.ts`, `professional/meu-perfil.spec.ts` indiretamente |

Sem sessao:

| Rota | Cobertura final |
|---|---|
| `/DashboardPaciente` | `auth/access-control.spec.ts`, smoke |
| `/Perfil` | `auth/access-control.spec.ts` |
| `/AgendamentoEspecialidade` | `auth/access-control.spec.ts`, `scheduling/by-specialty.spec.ts` |
| `/AgendamentoPerfil` | `auth/access-control.spec.ts`, `scheduling/by-profile.spec.ts` |
| `/ConsultaAgora` | `auth/access-control.spec.ts`, `patient/consulta-agora.spec.ts` |
| `/LaudosMedicos` | `auth/access-control.spec.ts`, `patient/laudos-steps.spec.ts` |
| `/SolicitacaoExames` | `auth/access-control.spec.ts`, `patient/servicos-extras.spec.ts` |
| `/RenovacaoReceitas` | `auth/access-control.spec.ts`, `patient/renovacao-receitas-completo.spec.ts` |
| `/consulta/:id` | `teleconsulta/room-access.spec.ts`, `scheduling/room-flow.spec.ts`, smoke |
| `/FinanceiroProfissional` | `auth/access-control.spec.ts`, `professional/financeiro.spec.ts`, smoke |
| `/AdminAprovacao` | `aprovacao-smoke.spec.ts`, `admin/aprovacao.spec.ts` |

Paciente autenticado:

| Rota/fluxo | Cobertura final |
|---|---|
| Dashboard paciente | `patient/patient-dashboard.spec.ts` |
| Perfil do paciente | `auth/access-control.spec.ts` |
| Agendamento por especialidade | `scheduling/by-specialty.spec.ts` |
| Agendamento por perfil | `scheduling/by-profile.spec.ts` |
| Consulta Agora/fila | `patient/consulta-agora.spec.ts`, `teleconsulta/payment-flow.spec.ts` |
| Laudos medicos | `patient/laudos-steps.spec.ts` |
| Solicitacao de exames | `patient/servicos-extras.spec.ts` |
| Renovacao de receitas | `patient/renovacao-receitas-completo.spec.ts`, `patient/servicos-extras.spec.ts` |
| Pergunte Especialista | `patient/pergunte-especialista.spec.ts` |
| Pagamento retorno | `teleconsulta/payment-flow.spec.ts` |
| Sala `/consulta/:id` | `teleconsulta/room-access.spec.ts`, `scheduling/room-flow.spec.ts` |
| Bloqueio de profissional/admin | `auth/access-control.spec.ts`, `aprovacao-smoke.spec.ts`, `professional/financeiro.spec.ts` |

Profissional autenticado:

| Rota/fluxo | Cobertura final |
|---|---|
| Dashboard profissional | `professional/professional-dashboard.spec.ts`, `professional/dashboard-error-loading.spec.ts` |
| Perfil profissional/edicao | `professional/meu-perfil.spec.ts`, `professional/edit-and-deactivate.spec.ts` |
| Disponibilidade/agenda | `professional/disponibilidade.spec.ts` |
| Financeiro | `professional/financeiro.spec.ts`, `professional/financeiro-banking.spec.ts` |
| Fila/queue widget | `professional/professional-dashboard.spec.ts` |
| Servicos extras atendidos | `professional/servicos-extras-atendimento.spec.ts` |
| Sala `/consulta/:id` | `teleconsulta/room-access.spec.ts`, `scheduling/room-flow.spec.ts` |
| Bloqueio de paciente/admin | `auth/access-control.spec.ts`, `aprovacao-smoke.spec.ts` |

Admin bloqueado:

| Rota | Cobertura final |
|---|---|
| `/AdminAprovacao` sem sessao | `aprovacao-smoke.spec.ts`, `admin/aprovacao.spec.ts` |
| `/AdminAprovacao` como paciente | `aprovacao-smoke.spec.ts`, `admin/aprovacao.spec.ts` |
| `/AdminAprovacao` como profissional | `aprovacao-smoke.spec.ts`, `admin/aprovacao.spec.ts` |
| Dashboard admin real | Pendente, fora de escopo ate haver credencial e definicao estavel |

## 13. Comandos sugeridos para rodar depois

Nao executados nesta auditoria, por instrucao explicita.

```bash
npm.cmd run test:e2e:smoke
npm.cmd run test:e2e:auth
npm.cmd run test:e2e:patient
npm.cmd run test:e2e:professional
npm.cmd run test:e2e:scheduling
npm.cmd run test:e2e:teleconsulta
npm.cmd run test:e2e -- tests/e2e/smoke tests/e2e/auth tests/e2e/scheduling tests/e2e/patient tests/e2e/professional tests/e2e/teleconsulta --workers=1
```

Se houver `ERR_CONNECTION_REFUSED` ao rodar depois:

```bash
npm.cmd run dev -- --host 127.0.0.1 --port 8080
```

## 14. Pendencias futuras

- Admin: criar cobertura real apenas quando o dashboard admin estiver definido e houver credencial admin.
- Disponibilidade: adicionar teste mockado de erro de `Salvar Disponibilidade` sem persistir dados reais.
- Queue widget: se houver endpoint mockavel estavel para fila profissional, criar cenarios dedicados de erro/loading/acao profissional sem duplicar `professional-dashboard`.
- Financeiro: liberar mais testes do modal de saque apenas com seed segura (`E2E_HAS_SALDO`) e sem realizar saque real no bloco padrao.
- Agendamento: manter seeds para `E2E_PROFESSIONAL_PUBLIC_ID` e dados de disponibilidade para reduzir skips condicionais.
