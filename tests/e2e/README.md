# Suíte E2E — Rápido Doutor

Testes de ponta a ponta com [Playwright](https://playwright.dev), organizados por domínio de negócio.

---

## Estrutura

```
tests/e2e/
├── support/
│   ├── constants.ts      # Rotas, seletores, usuários — fonte única de verdade
│   ├── fixtures.ts       # Extensão do test() com helpers de auth e navegação
│   └── global-setup.ts   # Gera storageState para cada role antes da suíte
│
├── smoke/
│   └── critical-paths.spec.ts   # 5 checks em < 2min — app está de pé?
│
├── auth/
│   ├── login.spec.ts            # Login por role, erros, rd_login_next
│   ├── logout.spec.ts           # Limpeza de sessão, redirect
│   └── register.spec.ts         # Cadastro paciente e profissional multi-step
│
├── routing/
│   └── access-control.spec.ts   # Público, autenticado, por role
│
├── scheduling/
│   ├── by-specialty.spec.ts     # 5 steps, janela 36h–14d
│   ├── by-profile.spec.ts       # Com profissional específico, tipo priority
│   └── cancellation.spec.ts     # Cancelar, status PT/EN (R4)
│
├── teleconsulta/
│   └── room-flow.spec.ts        # Estados da sala, banner de retomada
│
├── dashboard/
│   ├── patient-dashboard.spec.ts       # Abas, avaliação, status duplicados
│   └── professional-dashboard.spec.ts  # StatusGate, toggle de plantão
│
└── profile/
    └── edit-and-deactivate.spec.ts  # Edição e desativação de conta
```

---

## Como rodar

### Pré-requisito: app rodando localmente

```bash
npm run dev
```

### Configurar variáveis de ambiente

```bash
cp tests/e2e/.env.e2e.example tests/e2e/.env.e2e
# Edite .env.e2e com suas credenciais de teste
```

### Comandos

| Comando | O que faz |
|---|---|
| `npm run test:e2e:smoke` | Smoke tests — verificação rápida (sem auth) |
| `npm run test:e2e:critical` | Apenas testes marcados com `@critical` |
| `npm run test:e2e` | Suíte completa |
| `npm run test:e2e:ui` | Interface visual do Playwright |
| `npm run test:e2e:debug` | Modo debug com inspetor |
| `npm run test:e2e:report` | Abre o último relatório HTML |

---

## Tags de teste

| Tag | Significado |
|---|---|
| `@smoke` | Verifica que o app está de pé. Roda sem auth, sem dados. |
| `@critical` | Fluxo essencial do produto. Quebrar = usuários bloqueados. |
| _(sem tag)_ | Regra de negócio ou edge case. Importante mas não urgente. |

---

## Arquitetura de autenticação

O `global-setup.ts` executa **antes de toda a suíte** e gera um arquivo
de estado de sessão (`storageState`) para cada role:

```
tests/e2e/.auth/
├── patient.json        # localStorage com rd.auth.session.v1
├── professional.json
└── admin.json
```

Spec files que precisam de auth carregam esses arquivos via:

```ts
test.use({ storageState: AUTH_STATE.patient });
```

Testes que testam o **próprio fluxo de login** usam `clearAuthState()` no
`beforeEach` e o helper `loginViaUI()` — nunca herdam o storageState.

---

## Variáveis de ambiente

Veja `.env.e2e.example` para a lista completa com descrições.

Flags importantes para testes destrutivos (desabilitados por padrão):

| Flag | Efeito |
|---|---|
| `E2E_ALLOW_REGISTRATION` | Habilita testes que criam contas |
| `E2E_ALLOW_SCHEDULING` | Habilita testes que criam agendamentos |
| `E2E_ALLOW_CANCELLATION` | Habilita cancelamento de agendamentos |
| `E2E_ALLOW_DEACTIVATION` | Habilita desativação de conta (irreversível) |

---

## Riscos documentados

| ID | Risco | Onde é testado |
|---|---|---|
| R1 | Proteção de rota inconsistente (App.tsx vs interna) | `routing/access-control.spec.ts` |
| R2 | Conflito de horário client-side (race condition) | `scheduling/by-profile.spec.ts` |
| R3 | Sessão corrompida em localStorage | `auth/login.spec.ts`, `auth/logout.spec.ts` |
| R4 | Status de consulta misturado PT/EN | `scheduling/cancellation.spec.ts`, `dashboard/patient-dashboard.spec.ts` |
| R5 | Zoom SDK sem cleanup na navegação | `teleconsulta/room-flow.spec.ts` |
| R6 | Auto-resume com TTL conflita com JWT | `teleconsulta/room-flow.spec.ts` |
| R7 | ProfessionalStatusGate presentacional | `dashboard/professional-dashboard.spec.ts` |
| R8 | Profissional tenta agendar | `routing/access-control.spec.ts`, `scheduling/by-profile.spec.ts` |
| R9 | Upload de diploma com falha silenciosa | `auth/register.spec.ts` |
| R10 | `rd_login_next` não limpo em falha | `auth/login.spec.ts` |
| R11 | Cache stale pós-mutação | `dashboard/patient-dashboard.spec.ts` |

---

## Limitações conhecidas

- **Race condition de agendamento (R2):** não é testável com E2E de usuário único.
  Dois browsers simultâneos no mesmo slot podem passar pela verificação client-side.
  Documentado em `scheduling/by-profile.spec.ts`.

- **Zoom SDK:** não funciona em CI (sem WebRTC). Mockar a Edge Function
  `zoom-token` via `page.route()` para testar o restante do fluxo.

- **Recuperação de senha:** não existe no sistema (nenhuma rota, Edge Function
  ou link foi encontrado). Documentado em `auth/login.spec.ts`.
  Quando implementada, adicionar `auth/password-recovery.spec.ts`.

---

## Próxima etapa de implementação

**1ª rodada (implementar agora):**
- `smoke/critical-paths.spec.ts` — já quase pronto, ajustar seletores
- `auth/login.spec.ts` — caminho feliz e rd_login_next
- `routing/access-control.spec.ts` — loop de rotas públicas e protegidas

**2ª rodada:**
- `scheduling/by-specialty.spec.ts` — helper de seleção de data futura no calendário
- `scheduling/by-profile.spec.ts` — requer seed de profissional com disponibilidade

**3ª rodada:**
- `teleconsulta/room-flow.spec.ts` — requer mock do Zoom SDK
- `dashboard/` — requer seeds de dados por status
