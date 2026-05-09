# Suite E2E - Rapido Doutor

Testes de ponta a ponta com Playwright, organizados por dominio de negocio. A suite valida autenticacao, controle de acesso por perfil, fluxos de paciente, area profissional, agendamento, teleconsulta e pagamentos do plantao.

## Estrutura atual

```text
tests/e2e/
|-- .auth/                         # storageState gerado pelo global-setup
|-- admin/
|   `-- aprovacao.spec.ts          # bloqueio/admin futuro, sem cobertura profunda
|-- auth/
|   |-- access-control.spec.ts     # rotas publicas, protegidas e restritas por role
|   |-- login.spec.ts              # login, erros, rd_login_next e sessao
|   |-- logout.spec.ts             # limpeza de sessao e redirects
|   |-- password-recovery.spec.ts  # recuperacao de senha
|   |-- register.spec.ts           # cadastro de paciente
|   `-- register-professional.spec.ts
|-- patient/
|   |-- consulta-agora.spec.ts
|   |-- ensure-payment-charge-config.spec.ts
|   |-- especialidades-home.spec.ts
|   |-- laudos-steps.spec.ts
|   |-- meu-prontuario.spec.ts
|   |-- meus-pagamentos.spec.ts
|   |-- patient-dashboard.spec.ts
|   |-- payment-step-mock.spec.ts
|   |-- pergunte-especialista.spec.ts
|   |-- planos.spec.ts
|   |-- renovacao-receitas-completo.spec.ts
|   `-- servicos-extras.spec.ts
|-- professional/
|   |-- dashboard-error-loading.spec.ts
|   |-- disponibilidade.spec.ts
|   |-- edit-and-deactivate.spec.ts
|   |-- financeiro.spec.ts
|   |-- financeiro-banking.spec.ts
|   |-- meu-perfil.spec.ts
|   |-- professional-dashboard.spec.ts
|   `-- servicos-extras-atendimento.spec.ts
|-- scheduling/
|   |-- by-profile.spec.ts
|   |-- by-specialty.spec.ts
|   |-- cancellation.spec.ts
|   `-- room-flow.spec.ts
|-- smoke/
|   `-- critical-paths.spec.ts
|-- teleconsulta/
|   |-- payment-flow.spec.ts
|   `-- room-access.spec.ts
|-- support/
|   |-- auth-harness.ts
|   |-- constants.ts
|   |-- edge-mocks.ts
|   |-- fixtures.ts
|   |-- global-setup.ts
|   `-- page-helpers.ts
`-- aprovacao-smoke.spec.ts        # bloqueio basico da rota admin
```

## Como rodar depois da auditoria

O Playwright sobe o Vite via `webServer` quando necessario. Se preferir iniciar manualmente:

```bash
npm run dev -- --host 127.0.0.1 --port 8080
```

Configure `tests/e2e/.env.e2e` com credenciais de paciente e profissional. Admin e opcional e nao faz parte do consolidado atual.

Blocos principais:

```bash
npm run test:e2e:smoke
npm run test:e2e:auth
npm run test:e2e:patient
npm run test:e2e:professional
npm run test:e2e:scheduling
npm run test:e2e:teleconsulta
```

Consolidado sem admin:

```bash
npm run test:e2e -- tests/e2e/smoke tests/e2e/auth tests/e2e/scheduling tests/e2e/patient tests/e2e/professional tests/e2e/teleconsulta --workers=1
```

## Autenticacao

`support/global-setup.ts` gera:

```text
tests/e2e/.auth/patient.json
tests/e2e/.auth/professional.json
tests/e2e/.auth/admin.json
```

Paciente e profissional devem conter `rd.auth.session.v1` no `localStorage`. Se as credenciais admin nao existirem, `admin.json` fica vazio de proposito e os testes admin autenticados sao pulados com justificativa.

Specs autenticados usam:

```ts
test.use({ storageState: AUTH_STATE.patient });
```

Specs que testam login/logout usam `clearAuthState()` e login via UI, para nao herdar sessao.

## Rotas cobertas

As rotas reais ficam centralizadas em `support/constants.ts`.

Publicas:

- `/`
- `/Entrar`
- `/CadastroPaciente`
- `/CadastroProfissional`
- `/Especialidades`
- `/PerfilProfissional`
- `/PergunteEspecialista`
- `/Planos`

Protegidas por autenticacao ou por perfil de paciente:

- `/AgendamentoEspecialidade`
- `/AgendamentoPerfil`
- `/ConsultaAgora`
- `/DashboardPaciente`
- `/Perfil`
- `/LaudosMedicos`
- `/SolicitacaoExames`
- `/RenovacaoReceitas`
- `/Teleconsulta`
- `/pagamento/sucesso`
- `/pagamento/falha`
- `/pagamento/pendente`
- `/consulta/:id`

Restritas por role profissional:

- `/DashboardProfissional`
- `/FinanceiroProfissional`

Admin:

- `/AdminAprovacao` e validada apenas como rota bloqueada para usuario sem sessao, paciente e profissional.
- Cobertura profunda de dashboard admin fica pendente ate existir credencial admin e fluxo estavel.

## Flags, seeds e skips condicionais

Flags destrutivas ou dependentes de dados reais ficam desativadas por padrao:

| Flag | Uso |
|---|---|
| `E2E_ALLOW_REGISTRATION` | cria contas reais |
| `E2E_ALLOW_SCHEDULING` | cria agendamentos reais |
| `E2E_ALLOW_QUEUE` | cria entrada real na fila de plantao |
| `E2E_ALLOW_SERVICES` | envia solicitacoes reais de servicos |
| `E2E_ALLOW_UPLOAD` | usa arquivo real de upload |
| `E2E_ALLOW_BANKING` | salva dados bancarios reais |
| `E2E_ALLOW_CANCELLATION` | cancela agendamento real |
| `E2E_ALLOW_DEACTIVATION` | desativa conta descartavel |
| `E2E_HAS_SALDO` | habilita validacao do modal de saque com profissional contendo receita disponivel |

Seeds opcionais relevantes:

- `E2E_PROFESSIONAL_PUBLIC_ID`
- `E2E_PENDING_PROFESSIONAL_EMAIL`
- `E2E_HAS_ACTIVE_APPOINTMENT`
- `E2E_HAS_COMPLETED_APPOINTMENT`
- `E2E_CONSULTA_*_ID`

O editor de disponibilidade profissional e coberto sem clicar em `Salvar Disponibilidade` no bloco padrao, para nao alterar a conta compartilhada.

## Mocks controlados

Alguns cenarios usam `page.route()` para isolar comportamento instavel:

- `patient/payment-step-mock.spec.ts`: etapa de pagamento sem depender do provedor real.
- `professional/dashboard-error-loading.spec.ts`: loading/erro do dashboard profissional.
- `teleconsulta/room-access.spec.ts` e `scheduling/room-flow.spec.ts`: sala/consulta sem depender de Zoom real.

## Convencoes de qualidade

- Preferir `getByRole`, `getByLabel` e `getByText` com escopo claro.
- Usar `data-testid` apenas quando nao houver semantica acessivel.
- Evitar classes CSS, ordem de elementos e texto generico como seletor principal.
- Usar mock controlado quando backend, pagamento, Zoom ou dados reais forem instaveis.
- Manter `skip` somente quando houver variavel, seed, conta ou limitacao explicita.
- Nao alterar regra de negocio para teste passar.

## Riscos documentados

| ID | Risco | Cobertura |
|---|---|---|
| R1 | Protecao de rota inconsistente | `auth/access-control.spec.ts` |
| R2 | Conflito de horario client-side | `scheduling/by-profile.spec.ts` |
| R3 | Sessao corrompida | `auth/login.spec.ts`, `auth/logout.spec.ts` |
| R4 | Status de consulta PT/EN | `scheduling/cancellation.spec.ts`, `patient/patient-dashboard.spec.ts` |
| R5 | Zoom SDK em CI | `teleconsulta/room-access.spec.ts`, `scheduling/room-flow.spec.ts` |
| R6 | Auto-resume com TTL | `teleconsulta/room-access.spec.ts` |
| R7 | ProfessionalStatusGate | `professional/professional-dashboard.spec.ts` |
| R8 | Profissional tentando agendar | `auth/access-control.spec.ts`, `scheduling/by-profile.spec.ts` |
| R9 | Upload de diploma | `auth/register.spec.ts` |
| R10 | `rd_login_next` | `auth/login.spec.ts`, `auth/access-control.spec.ts` |
| R11 | Cache stale pos-mutacao | `patient/patient-dashboard.spec.ts` |
| R12 | Modal de saque depende de seed com saldo | `professional/financeiro.spec.ts` |
