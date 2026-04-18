# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke\critical-paths.spec.ts >> smoke — app de pé >> home renderiza conteúdo principal @smoke
- Location: tests\e2e\smoke\critical-paths.spec.ts:29:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('link', { name: 'Criar conta' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('link', { name: 'Criar conta' })

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
        - generic [ref=e12]:
          - link "Entrar" [ref=e14] [cursor=pointer]:
            - /url: /Entrar
            - button "Entrar" [ref=e15]:
              - img
              - generic [ref=e16]: Entrar
          - button [ref=e17] [cursor=pointer]:
            - img [ref=e18]
    - main [ref=e19]:
      - generic [ref=e21]:
        - generic [ref=e28]:
          - generic [ref=e29]:
            - img [ref=e30]
            - text: Atendimento 24 horas
          - heading "Seu médico a um clique de distância" [level=1] [ref=e33]
          - paragraph [ref=e34]: Conectamos você aos melhores profissionais de saúde. Agende consultas, entre na fila para atendimento imediato ou tire suas dúvidas com especialistas.
          - generic [ref=e35]:
            - link "Consulta Agora" [ref=e36] [cursor=pointer]:
              - /url: /ConsultaAgora
              - button "Consulta Agora" [ref=e37]:
                - img
                - text: Consulta Agora
            - link "Agendar Consulta" [ref=e38] [cursor=pointer]:
              - /url: /AgendamentoEspecialidade
              - button "Agendar Consulta" [ref=e39]:
                - text: Agendar Consulta
                - img
          - generic [ref=e40]:
            - generic [ref=e41]:
              - img [ref=e43]
              - img [ref=e47]
              - img [ref=e51]
              - img [ref=e55]
            - generic [ref=e58]:
              - generic [ref=e59]:
                - img [ref=e60]
                - img [ref=e62]
                - img [ref=e64]
                - img [ref=e66]
                - img [ref=e68]
              - paragraph [ref=e70]: +10.000 pacientes satisfeitos
        - generic [ref=e72]:
          - generic [ref=e73]:
            - heading "Encontre o especialista ideal" [level=2] [ref=e74]
            - paragraph [ref=e75]: Mais de 15 especialidades médicas disponíveis para você escolher
          - generic [ref=e76]:
            - link "Clínico Geral" [ref=e78] [cursor=pointer]:
              - /url: /Especialidades?especialidade=Cl%C3%ADnico%20Geral
              - generic [ref=e80]:
                - img [ref=e82]
                - paragraph [ref=e86]: Clínico Geral
            - link "Cardiologia" [ref=e88] [cursor=pointer]:
              - /url: /Especialidades?especialidade=Cardiologia
              - generic [ref=e90]:
                - img [ref=e92]
                - paragraph [ref=e94]: Cardiologia
            - link "Neurologia" [ref=e96] [cursor=pointer]:
              - /url: /Especialidades?especialidade=Neurologia
              - generic [ref=e98]:
                - img [ref=e100]
                - paragraph [ref=e110]: Neurologia
            - link "Ortopedia" [ref=e112] [cursor=pointer]:
              - /url: /Especialidades?especialidade=Ortopedia
              - generic [ref=e114]:
                - img [ref=e116]
                - paragraph [ref=e118]: Ortopedia
            - link "Oftalmologia" [ref=e120] [cursor=pointer]:
              - /url: /Especialidades?especialidade=Oftalmologia
              - generic [ref=e122]:
                - img [ref=e124]
                - paragraph [ref=e127]: Oftalmologia
            - link "Pediatria" [ref=e129] [cursor=pointer]:
              - /url: /Especialidades?especialidade=Pediatria
              - generic [ref=e131]:
                - img [ref=e133]
                - paragraph [ref=e136]: Pediatria
          - link "Ver todas as especialidades" [ref=e138] [cursor=pointer]:
            - /url: /Especialidades
            - button "Ver todas as especialidades" [ref=e139]:
              - text: Ver todas as especialidades
              - img
        - generic [ref=e141]:
          - heading "Serviços" [level=2] [ref=e143]
          - generic [ref=e144]:
            - link "Solicitação de Exames Pedidos digitais para exames laboratoriais e de imagem com orientação médica." [ref=e146] [cursor=pointer]:
              - /url: /SolicitacaoExames
              - generic [ref=e148]:
                - img [ref=e150]
                - paragraph [ref=e153]: Solicitação de Exames
                - paragraph [ref=e154]: Pedidos digitais para exames laboratoriais e de imagem com orientação médica.
            - link "💊 Renovação de Receitas Prescrições rápidas com envio digital para medicações de uso contínuo." [ref=e156] [cursor=pointer]:
              - /url: /RenovacaoReceitas
              - generic [ref=e158]:
                - generic [ref=e160]: 💊
                - paragraph [ref=e161]: Renovação de Receitas
                - paragraph [ref=e162]: Prescrições rápidas com envio digital para medicações de uso contínuo.
            - link "📄 Laudos Médicos Emissão digital com assinatura eletrônica certificada e envio imediato." [ref=e164] [cursor=pointer]:
              - /url: /LaudosMedicos
              - generic [ref=e166]:
                - generic [ref=e168]: 📄
                - paragraph [ref=e169]: Laudos Médicos
                - paragraph [ref=e170]: Emissão digital com assinatura eletrônica certificada e envio imediato.
        - generic [ref=e173]:
          - generic [ref=e176]:
            - img [ref=e178]
            - heading "Consulta em Minutos" [level=3] [ref=e181]
            - paragraph [ref=e182]: Conecte-se com um médico disponível agora mesmo, sem espera.
          - generic [ref=e185]:
            - img [ref=e187]
            - heading "Escolha seu Especialista" [level=3] [ref=e190]
            - paragraph [ref=e191]: Busque por especialidade ou profissional específico.
          - generic [ref=e194]:
            - img [ref=e196]
            - heading "Tire suas Dúvidas" [level=3] [ref=e198]
            - paragraph [ref=e199]: Pergunte a especialistas e receba respostas qualificadas.
          - generic [ref=e202]:
            - img [ref=e204]
            - heading "Seguro e Confiável" [level=3] [ref=e206]
            - paragraph [ref=e207]: Todos os profissionais verificados e credenciados.
        - generic [ref=e209]:
          - generic [ref=e210]:
            - heading "Como funciona" [level=2] [ref=e211]
            - paragraph [ref=e212]: Em poucos passos você já estará conectado com seu médico
          - generic [ref=e213]:
            - generic [ref=e214]:
              - generic [ref=e215]: "01"
              - heading "Escolha a especialidade" [level=3] [ref=e216]
              - paragraph [ref=e217]: Selecione o tipo de atendimento que precisa
            - generic [ref=e218]:
              - generic [ref=e219]: "02"
              - heading "Agende ou entre na fila" [level=3] [ref=e220]
              - paragraph [ref=e221]: Marque horário ou seja atendido agora
            - generic [ref=e222]:
              - generic [ref=e223]: "03"
              - heading "Realize sua consulta" [level=3] [ref=e224]
              - paragraph [ref=e225]: Converse por vídeo com seu médico
        - generic [ref=e232]:
          - heading "Pronto para cuidar da sua saúde?" [level=2] [ref=e233]
          - paragraph [ref=e234]: Milhares de pessoas já transformaram a forma como cuidam da saúde. Junte-se a elas.
          - generic [ref=e235]:
            - link "Começar Agora" [ref=e236] [cursor=pointer]:
              - /url: /ConsultaAgora
              - button "Começar Agora" [ref=e237]
            - link "Sou Profissional" [ref=e238] [cursor=pointer]:
              - /url: /CadastroProfissional
              - button "Sou Profissional" [ref=e239]
    - navigation [ref=e240]:
      - generic [ref=e241]:
        - link "Início" [ref=e242] [cursor=pointer]:
          - /url: /Home
          - img [ref=e243]
          - generic [ref=e246]: Início
        - link "Agendar" [ref=e248] [cursor=pointer]:
          - /url: /AgendamentoEspecialidade
          - img [ref=e249]
          - generic [ref=e252]: Agendar
        - link "Consultas" [ref=e253] [cursor=pointer]:
          - /url: /DashboardPaciente
          - img [ref=e254]
          - generic [ref=e256]: Consultas
        - link "Perfil" [ref=e257] [cursor=pointer]:
          - /url: /Perfil
          - img [ref=e258]
          - generic [ref=e261]: Perfil
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
> 36  |     await expect(page.getByRole('link', { name: 'Criar conta' })).toBeVisible();
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
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
  56  |     await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
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