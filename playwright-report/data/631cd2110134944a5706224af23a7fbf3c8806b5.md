# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke\critical-paths.spec.ts >> smoke — app de pé >> página de cadastro de paciente renderiza @smoke
- Location: tests\e2e\smoke\critical-paths.spec.ts:52:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Criar conta' })
Expected: visible
Error: strict mode violation: getByRole('button', { name: 'Criar conta' }) resolved to 2 elements:
    1) <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-md px-3 bg-emerald-600 hover:bg-emerald-700 text-white h-9">Criar conta</button> aka getByRole('link', { name: 'Criar conta' }).getByRole('button')
    2) <button type="submit" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 px-4 py-2 h-12 w-full bg-emerald-600 text-white hover:bg-emerald-700">Criar conta</button> aka getByRole('main').getByRole('button', { name: 'Criar conta' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: 'Criar conta' })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e6]:
        - link "Rápido Doutor Rápido Doutor" [ref=e8] [cursor=pointer]:
          - /url: /Home
          - img "Rápido Doutor" [ref=e10]
          - generic [ref=e11]: Rápido Doutor
        - navigation [ref=e12]:
          - link "Início" [ref=e13] [cursor=pointer]:
            - /url: /Home
          - link "Agendamento" [ref=e14] [cursor=pointer]:
            - /url: /AgendamentoEspecialidade
          - link "Consulta Agora" [ref=e15] [cursor=pointer]:
            - /url: /ConsultaAgora
          - link "Pergunte ao Especialista" [ref=e16] [cursor=pointer]:
            - /url: /PergunteEspecialista
        - generic [ref=e18]:
          - link "Entrar" [ref=e19] [cursor=pointer]:
            - /url: /Entrar
            - button "Entrar" [ref=e20]:
              - img
              - generic [ref=e21]: Entrar
          - link "Criar conta" [ref=e22] [cursor=pointer]:
            - /url: /CadastroPaciente
            - button "Criar conta" [ref=e23]
    - main [ref=e24]:
      - generic [ref=e27]:
        - generic [ref=e28]:
          - img [ref=e30]
          - heading "Criar Conta de Paciente" [level=1] [ref=e33]
          - paragraph [ref=e34]:
            - text: Ja tem conta?
            - link "Entrar" [ref=e35] [cursor=pointer]:
              - /url: /Entrar
        - generic [ref=e36]:
          - heading "Dados pessoais" [level=3] [ref=e38]
          - generic [ref=e40]:
            - generic [ref=e41]:
              - generic [ref=e42]: Nome completo
              - textbox "Seu nome completo" [ref=e43]
            - generic [ref=e44]:
              - generic [ref=e45]: Email
              - textbox "seu@email.com" [ref=e46]
            - generic [ref=e47]:
              - generic [ref=e48]: Senha
              - generic [ref=e49]:
                - textbox "Minimo de 6 caracteres" [ref=e50]
                - button [ref=e51] [cursor=pointer]:
                  - img [ref=e52]
            - generic [ref=e55]:
              - generic [ref=e56]: CPF
              - textbox "000.000.000-00" [ref=e57]
            - generic [ref=e58]:
              - generic [ref=e59]: Telefone
              - textbox "(11) 99999-9999" [ref=e60]
            - generic [ref=e61]:
              - generic [ref=e62]: Data de nascimento
              - textbox [ref=e63]
            - generic [ref=e64]:
              - generic [ref=e65]: Sexo
              - combobox [ref=e66] [cursor=pointer]:
                - generic: Selecione
                - img [ref=e67]
              - combobox [ref=e69]
            - button "Criar conta" [ref=e70] [cursor=pointer]
    - contentinfo [ref=e71]:
      - generic [ref=e72]:
        - generic [ref=e73]:
          - generic [ref=e74]:
            - generic [ref=e75]:
              - img "Rápido Doutor" [ref=e77]
              - generic [ref=e78]: Rápido Doutor
            - paragraph [ref=e79]: Conectando você aos melhores profissionais de saúde, quando você precisa.
          - generic [ref=e80]:
            - heading "Serviços" [level=4] [ref=e81]
            - list [ref=e82]:
              - listitem [ref=e83]:
                - link "Ver Especialistas" [ref=e84] [cursor=pointer]:
                  - /url: /Especialidades
              - listitem [ref=e85]:
                - link "Agendamento" [ref=e86] [cursor=pointer]:
                  - /url: /AgendamentoEspecialidade
              - listitem [ref=e87]:
                - link "Consulta Agora" [ref=e88] [cursor=pointer]:
                  - /url: /ConsultaAgora
              - listitem [ref=e89]:
                - link "Pergunte ao Especialista" [ref=e90] [cursor=pointer]:
                  - /url: /PergunteEspecialista
          - generic [ref=e91]:
            - heading "Para Profissionais" [level=4] [ref=e92]
            - list [ref=e93]:
              - listitem [ref=e94]:
                - link "Cadastre-se" [ref=e95] [cursor=pointer]:
                  - /url: /CadastroProfissional
              - listitem [ref=e96]:
                - link "Área do Médico" [ref=e97] [cursor=pointer]:
                  - /url: /DashboardProfissional
          - generic [ref=e98]:
            - heading "Suporte" [level=4] [ref=e99]
            - list [ref=e100]:
              - listitem [ref=e101]:
                - link "Central de Ajuda" [ref=e102] [cursor=pointer]:
                  - /url: "#"
              - listitem [ref=e103]:
                - link "Termos de Uso" [ref=e104] [cursor=pointer]:
                  - /url: "#"
              - listitem [ref=e105]:
                - link "Privacidade" [ref=e106] [cursor=pointer]:
                  - /url: "#"
        - generic [ref=e107]: © 2026 Rápido Doutor. Todos os direitos reservados.
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1   | /**
  2   |  * smoke/critical-paths.spec.ts
  3   |  *
  4   |  * TIPO: Smoke tests
  5   |  *
  6   |  * PROPÓSITO
  7   |  *   Verificar em menos de 2 minutos que os caminhos mais críticos do
  8   |  *   sistema ainda funcionam. São os primeiros a rodar em CI e os primeiros
  9   |  *   a quebrar quando algo sério dá errado.
  10  |  *
  11  |  * REGRAS
  12  |  *   - Sem login. Sem dados externos. Sem storageState.
  13  |  *   - Seletores baseados em conteúdo visível real do HTML (sem toHaveTitle).
  14  |  *   - Cada teste deve passar em < 10s individualmente.
  15  |  */
  16  | 
  17  | import { test, expect } from '../support/fixtures';
  18  | import { ROUTES } from '../support/constants';
  19  | 
  20  | // ---------------------------------------------------------------------------
  21  | // Grupo 1 — app está respondendo e renderizando
  22  | // ---------------------------------------------------------------------------
  23  | test.describe('smoke — app de pé', () => {
  24  | 
  25  |   test.beforeEach(async ({ clearAuthState }) => {
  26  |     await clearAuthState();
  27  |   });
  28  | 
  29  |   test('home renderiza conteúdo principal @smoke', async ({ page, goto }) => {
  30  |     await goto(ROUTES.home);
  31  | 
  32  |     // O título do documento é "Lovable App" (index.html ainda não foi atualizado),
  33  |     // então validamos por conteúdo da UI — mais robusto que toHaveTitle.
  34  |     // Layout deslogado mostra botão "Entrar" e link "Criar conta".
  35  |     await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
  36  |     await expect(page.getByRole('link', { name: 'Criar conta' })).toBeVisible();
  37  | 
  38  |     // Home.jsx renderiza um h1 com o conteúdo principal
  39  |     await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  40  |   });
  41  | 
  42  |   test('página de login renderiza formulário @smoke', async ({ page, goto }) => {
  43  |     await goto(ROUTES.entrar);
  44  | 
  45  |     // Entrar.jsx: h1 "Entrar na sua conta" + campos + botão
  46  |     await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible();
  47  |     await expect(page.getByLabel('Email')).toBeVisible();
  48  |     await expect(page.getByLabel('Senha')).toBeVisible();
  49  |     await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  50  |   });
  51  | 
  52  |   test('página de cadastro de paciente renderiza @smoke', async ({ page, goto }) => {
  53  |     await goto(ROUTES.cadastroPaciente);
  54  | 
  55  |     await expect(page.getByRole('heading', { name: /criar conta de paciente/i })).toBeVisible();
> 56  |     await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
      |                                                                     ^ Error: expect(locator).toBeVisible() failed
  57  |   });
  58  | 
  59  |   test('especialidades renderiza sem login @smoke', async ({ page, goto }) => {
  60  |     await goto(ROUTES.especialidades);
  61  | 
  62  |     // Especialidades.jsx: h1 com "Especialidades" ou similar, sem redirect
  63  |     await expect(page).not.toHaveURL(/Entrar/);
  64  |     await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  65  |   });
  66  | 
  67  |   test('rota inexistente renderiza 404 sem crash @smoke', async ({ page, goto }) => {
  68  |     await goto(ROUTES.notFound);
  69  | 
  70  |     // PageNotFound renderiza um heading — não redireciona para /Entrar
  71  |     await expect(page).not.toHaveURL(/Entrar/);
  72  |     await expect(page.getByRole('heading').first()).toBeVisible();
  73  |   });
  74  | 
  75  | });
  76  | 
  77  | // ---------------------------------------------------------------------------
  78  | // Grupo 2 — proteção de rotas (sem login)
  79  | // ---------------------------------------------------------------------------
  80  | test.describe('smoke — proteção de rotas', () => {
  81  | 
  82  |   test.beforeEach(async ({ clearAuthState }) => {
  83  |     await clearAuthState();
  84  |   });
  85  | 
  86  |   test('dashboard do paciente sem auth redireciona para /Entrar @smoke', async ({ page, goto }) => {
  87  |     await goto(ROUTES.dashboardPaciente);
  88  | 
  89  |     await expect(page).toHaveURL(/Entrar/, { timeout: 10_000 });
  90  | 
  91  |     // ProtectedRoute salva rd_login_next para retomar após login
  92  |     const loginNext = await page.evaluate(() =>
  93  |       window.sessionStorage.getItem('rd_login_next'),
  94  |     );
  95  |     expect(loginNext).toContain('DashboardPaciente');
  96  |   });
  97  | 
  98  |   test('consulta/:id sem auth redireciona para /Entrar @smoke', async ({ page, goto }) => {
  99  |     await goto(ROUTES.consultaRoom('qualquer-id'));
  100 |     await expect(page).toHaveURL(/Entrar/, { timeout: 10_000 });
  101 |   });
  102 | 
  103 |   test('financeiro profissional sem auth redireciona para /Entrar @smoke', async ({ page, goto }) => {
  104 |     await goto(ROUTES.financeiroProf);
  105 |     await expect(page).toHaveURL(/Entrar/, { timeout: 10_000 });
  106 |   });
  107 | 
  108 | });
  109 | 
  110 | // ---------------------------------------------------------------------------
  111 | // Grupo 3 — redirecionamentos de rota
  112 | // ---------------------------------------------------------------------------
  113 | test.describe('smoke — redirecionamentos', () => {
  114 | 
  115 |   test('alias /Agendamento preserva query string ao redirecionar @smoke', async ({ page, goto }) => {
  116 |     await goto('/Agendamento?professional=test-id-123');
  117 | 
  118 |     // React Router <Navigate replace> → /AgendamentoPerfil mantendo QS
  119 |     await expect(page).toHaveURL(/AgendamentoPerfil/);
  120 |     await expect(page).toHaveURL(/professional=test-id-123/);
  121 |   });
  122 | 
  123 | });
  124 | 
```