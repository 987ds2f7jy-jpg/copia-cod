# Relatorio comparativo - files.zip x tests/e2e

## Inventario do ZIP

Arquivos extraidos e lidos integralmente:

- `planos.spec.ts`
- `laudos-steps.spec.ts`
- `disponibilidade.spec.ts`
- `queue-widget.spec.ts`
- `payment-flow.spec.ts`
- `by-specialty.spec.ts`
- `by-profile.spec.ts`
- `room-flow.spec.ts`
- `constants.ts`

## Classificacao por arquivo

### planos.spec.ts

Decisao: incorporar adaptando.

- Incorporados adaptando: rota publica sem login; abas `Planos` e `Empresas`; cards com produtos, precos e destaque; CTAs visuais sem navegacao; formulario empresas com labels acessiveis; submit simulado com toast e reset.
- Descartados por granularidade/duplicidade: badge isolado, aba ativa isolada, nota de valores ilustrativos isolada, botao habilitado isolado e texto mensal isolado. Esses pontos foram cobertos dentro de cenarios mais ricos.
- Classificacao: `Incorporar adaptando` para os cenarios de comportamento; `Duplicado/nao incorporar` para micro-assertions que inflavam a suite.

### laudos-steps.spec.ts

Decisao: incorporar adaptando.

- Incorporados adaptando: validacao de campos obrigatorios no step Identificacao; indicador de 4 etapas; step Saude com diagnostico obrigatorio e botao Anterior; campos clinicos opcionais; step Laudo com tipo/finalidade obrigatorios; step Documentos exigindo identidade antes de iniciar consulta.
- Ajuste de app associado: labels do wizard em `src/pages/LaudosMedicos.jsx` passaram a usar `htmlFor`/`id`, tornando `getByLabel` confiavel.
- Descartados: testes de sucesso/fila com `fixme()` e dependencia de `E2E_ALLOW_SERVICES` + upload real; teste `step 3` com skip artificial `E2E_REACH_STEP3`, substituido por navegacao real nao destrutiva.
- Classificacao: `Incorporar adaptando`; testes finais/pagamento ficaram como `Util, mas depende de seed/flag/conta`.

### disponibilidade.spec.ts

Decisao: incorporar adaptando.

- Incorporados adaptando: editor na aba Meu Perfil; sete dias; slots 08:00 e 17:40; botao salvar presente; dia ativo via `aria-pressed`; toggle de slot; preservacao local ao trocar dia.
- Ajuste de app associado: botoes de dia e horario em `DisponibilidadeEditor` ganharam `type="button"` e `aria-pressed`.
- Descartados: clique em `Salvar Disponibilidade`, mock de erro e loading de save, porque alteram conta compartilhada ou dependem de endpoint/estado instavel; o titulo do ZIP dizia `Disponibilidade Semanal`, mas a UI real e `Disponibilidade por Dia`.
- Classificacao: `Incorporar adaptando` para UI/local state; `Util, mas depende de seed/flag/conta` para persistencia.

### queue-widget.spec.ts

Decisao: fundir partes uteis no spec atual.

- Incorporados adaptando em `professional-dashboard.spec.ts`: titulo `Fila em Tempo Real`, contador `N aguardando`, estado seguro `Fila vazia` ou acao, e ausencia do widget na aba Meu Perfil.
- Descartados: badge por cor/classe CSS; testes de paciente em fila, painel `Analise`, `Aceitar e continuar` e `Atender` direto sem seed de fila. Esses exigem dados reais/fixture de queue.
- Classificacao: `Incorporar adaptando` para estrutura nao destrutiva; `Util, mas depende de seed/flag/conta` para fluxo real de atendimento; `Duplicado/nao incorporar` para classe CSS.

### payment-flow.spec.ts

Decisao: nao incorporar.

- Motivo: a suite atual ja cobre `/pagamento/sucesso`, `/pagamento/falha`, `/pagamento/pendente`, CTAs `Ver painel` e `Voltar ao inicio`, fallback de status desconhecido e `rd_login_next`.
- Problema no ZIP: usava API/constante antiga `pagamentoRetorno` e poderia reintroduzir slugs errados se copiado.
- Classificacao: `Ja existe teste melhor na suite atual`; partes de fila sao `Duplicado/nao incorporar`.

### by-specialty.spec.ts

Decisao: fundir partes uteis.

- Incorporados adaptando: selecao de horario marca apenas um slot com `aria-pressed`; trocar data reseta horario e desabilita `Continuar`.
- Ajuste de app associado: slots de `AgendamentoEspecialidade` ganharam `type="button"` e `aria-pressed`.
- Descartados: assertions por classe `bg-emerald-500`, uso invalido/fragil de seletor, teste de "Nenhum horario disponivel" dependente de data sem slots, e duplicatas ja cobertas pelo spec atual.
- Classificacao: `Incorporar adaptando` para estado de slot; demais `Duplicado` ou `Incorreto/fragil em relacao a UI atual`.

### by-profile.spec.ts

Decisao: nao incorporar.

- Motivo: o spec atual ja e igual ou melhor, preserva a documentacao da race condition client-side com um teste explicito e skips condicionais claros para `E2E_PROFESSIONAL_PUBLIC_ID`, `E2E_ALLOW_SCHEDULING` e `E2E_SLOT_CONFLICT_DATETIME`.
- Classificacao: `Ja existe teste melhor na suite atual`.

### room-flow.spec.ts

Decisao: nao incorporar.

- Motivo: a suite atual de `scheduling/room-flow.spec.ts` e `teleconsulta/room-access.spec.ts` ja cobre sem auth, ID invalido, erro amigavel, botao voltar, TTL/auto-resume e limitacao do Zoom.
- Classificacao: `Ja existe teste melhor na suite atual`; cenarios com consulta real continuam `Util, mas depende de seed/flag/conta`.

### constants.ts

Decisao: nao sobrescrever.

- Motivo: o `support/constants.ts` atual ja contem as rotas reais centralizadas, incluindo `/Planos`, `/PergunteEspecialista`, pagamentos reais `sucesso/falha/pendente`, rotas protegidas e role routes.
- Problema no ZIP: omisso em rotas atuais e com nomenclatura antiga `pagamentoRetorno`.
- Classificacao: `Ja existe versao melhor na suite atual`.

## Problemas encontrados

- Bug real/qualidade do app: campos de `LaudosMedicos` nao tinham associacao label-input; botoes de disponibilidade e slots de agendamento nao expunham estado selecionado semanticamente.
- Bug do teste novo: toast de Planos tinha seletor ambiguo; corrigido com escopo `.first()`.
- Bug do teste novo: `Ter` casava com `Salvar Alteracoes`; corrigido com regex ancorada.
- Bug do teste existente: waits do dashboard profissional eram curtos/fracas para primeiro carregamento; substituidos por `waitForProfessionalDashboard`.

## Testes adicionados/fundidos

- `tests/e2e/patient/planos.spec.ts`: 5 testes.
- `tests/e2e/patient/laudos-steps.spec.ts`: 6 testes.
- `tests/e2e/professional/disponibilidade.spec.ts`: 4 testes.
- `tests/e2e/professional/professional-dashboard.spec.ts`: 2 testes de QueueWidget.
- `tests/e2e/scheduling/by-specialty.spec.ts`: 2 testes de estado de slot, executados em Chromium e WebKit no bloco scheduling.

## Resultados finais

- Smoke: 18 passed.
- Auth: 164 passed, 18 skipped.
- Patient: 87 passed, 13 skipped.
- Professional: 66 passed, 6 skipped.
- Scheduling: 58 passed, 46 skipped.
- Teleconsulta: 14 passed, 7 skipped.
- Consolidado sem admin: 407 passed, 90 skipped.
