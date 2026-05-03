# Suíte E2E — Rápido Doutor

Testes de ponta a ponta com Playwright, organizados por domínio de negócio. A suíte valida autenticação, controle de acesso por perfil, fluxos de paciente, área profissional, agendamento, teleconsulta e pagamentos do plantão.

## Estrutura atual

```text
tests/e2e/
├── .auth/                         # storageState gerado pelo global-setup
├── admin/
│   └── aprovacao.spec.ts           # bloqueio/admin futuro, sem cobertura profunda agora
├── auth/
│   ├── access-control.spec.ts      # rotas públicas, protegidas e restritas por role
│   ├── login.spec.ts               # login, erros, rd_login_next, sessão
│   ├── logout.spec.ts              # limpeza de sessão e redirects
│   ├── register.spec.ts            # cadastro paciente/profissional base
│   └── register-professional.spec.ts
├── patient/
│   ├── consulta-agora.spec.ts
│   ├── especialidades-home.spec.ts
│   ├── laudos-steps.spec.ts
│   ├── patient-dashboard.spec.ts
│   ├── pergunte-especialista.spec.ts
│   ├── planos.spec.ts
│   ├── renovacao-receitas-completo.spec.ts
│   └── servicos-extras.spec.ts
├── professional/
│   ├── dashboard-error-loading.spec.ts
│   ├── disponibilidade.spec.ts
│   ├── edit-and-deactivate.spec.ts
│   ├── financeiro.spec.ts
│   ├── financeiro-banking.spec.ts
│   ├── meu-perfil.spec.ts
│   └── professional-dashboard.spec.ts
├── scheduling/
│   ├── by-profile.spec.ts
│   ├── by-specialty.spec.ts
│   ├── cancellation.spec.ts
│   └── room-flow.spec.ts
├── smoke/
│   └── critical-paths.spec.ts
├── teleconsulta/
│   ├── payment-flow.spec.ts
│   └── room-access.spec.ts
├── support/
│   ├── auth-harness.ts
│   ├── constants.ts
│   ├── fixtures.ts
│   ├── global-setup.ts
│   └── page-helpers.ts
└── aprovacao-smoke.spec.ts         # bloqueios básicos da rota admin
```

## Como rodar

O Playwright sobe o Vite via `webServer` quando necessário. Se preferir iniciar manualmente:

```bash
npm run dev -- --host 127.0.0.1 --port 8080
```

Configure `tests/e2e/.env.e2e` com credenciais de paciente e profissional. Admin é opcional e não faz parte do consolidado atual.

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

## Autenticação

`support/global-setup.ts` gera:

```text
tests/e2e/.auth/patient.json
tests/e2e/.auth/professional.json
tests/e2e/.auth/admin.json
```

Paciente e profissional devem conter `rd.auth.session.v1` no `localStorage`. Se as credenciais admin não existirem, `admin.json` fica vazio de propósito e os testes admin autenticados são pulados com justificativa.

Specs autenticados usam:

```ts
test.use({ storageState: AUTH_STATE.patient });
```

Specs que testam login/logout usam `clearAuthState()` e login via UI, para não herdar sessão.

## Rotas cobertas

As rotas reais ficam centralizadas em `support/constants.ts`.

Públicas: `/`, `/Entrar`, `/CadastroPaciente`, `/CadastroProfissional`, `/Especialidades`, `/PerfilProfissional`, `/PergunteEspecialista`, `/Planos`.

Protegidas por autenticação: `/AgendamentoEspecialidade`, `/AgendamentoPerfil`, `/ConsultaAgora`, `/DashboardPaciente`, `/Perfil`, `/LaudosMedicos`, `/SolicitacaoExames`, `/RenovacaoReceitas`, `/Teleconsulta`, `/pagamento/sucesso`, `/pagamento/falha`, `/pagamento/pendente`, `/consulta/:id`.

Restritas por role profissional: `/DashboardProfissional`, `/FinanceiroProfissional`.

Admin: `/AdminAprovacao` é validada apenas como rota bloqueada para sem sessão, paciente e profissional. Cobertura profunda de dashboard admin fica pendente até haver credencial e definição estável do fluxo.

## Flags e seeds

Flags destrutivas ou dependentes de dados reais ficam desativadas por padrão:

| Flag | Uso |
|---|---|
| `E2E_ALLOW_REGISTRATION` | cria contas reais |
| `E2E_ALLOW_SCHEDULING` | cria agendamentos reais |
| `E2E_ALLOW_QUEUE` | cria entrada real na fila de plantão |
| `E2E_ALLOW_SERVICES` | envia solicitações reais de serviços |
| `E2E_ALLOW_UPLOAD` | usa arquivo real de upload |
| `E2E_ALLOW_BANKING` | salva dados bancários reais |
| `E2E_ALLOW_CANCELLATION` | cancela agendamento real |
| `E2E_ALLOW_DEACTIVATION` | desativa conta descartável |

O editor de disponibilidade profissional é coberto sem clicar em "Salvar Disponibilidade", para não alterar a conta compartilhada durante o bloco padrão.

Seeds opcionais relevantes: `E2E_PROFESSIONAL_PUBLIC_ID`, `E2E_PENDING_PROFESSIONAL_EMAIL`, `E2E_HAS_ACTIVE_APPOINTMENT`, `E2E_HAS_COMPLETED_APPOINTMENT`, `E2E_CONSULTA_*_ID`.

## Convenções de qualidade

- Preferir `getByRole`, `getByLabel` e `getByText` com escopo claro.
- Usar `data-testid` apenas quando não houver semântica acessível.
- Evitar classes CSS, ordem de elementos e texto genérico como seletor principal.
- Usar `page.route()` para backend, pagamento ou Zoom quando o ambiente real for instável.
- Manter `skip` somente quando houver variável, seed ou limitação explícita.
- Não alterar regra de negócio para teste passar.

## Riscos documentados

| ID | Risco | Cobertura |
|---|---|---|
| R1 | Proteção de rota inconsistente | `auth/access-control.spec.ts` |
| R2 | Conflito de horário client-side | `scheduling/by-profile.spec.ts` |
| R3 | Sessão corrompida | `auth/login.spec.ts`, `auth/logout.spec.ts` |
| R4 | Status de consulta PT/EN | `scheduling/cancellation.spec.ts`, `patient/patient-dashboard.spec.ts` |
| R5 | Zoom SDK em CI | `teleconsulta/room-access.spec.ts`, `scheduling/room-flow.spec.ts` |
| R6 | Auto-resume com TTL | `teleconsulta/room-access.spec.ts` |
| R7 | ProfessionalStatusGate | `professional/professional-dashboard.spec.ts` |
| R8 | Profissional tentando agendar | `auth/access-control.spec.ts`, `scheduling/by-profile.spec.ts` |
| R9 | Upload de diploma | `auth/register.spec.ts` |
| R10 | `rd_login_next` | `auth/login.spec.ts`, `auth/access-control.spec.ts` |
| R11 | Cache stale pós-mutação | `patient/patient-dashboard.spec.ts` |
