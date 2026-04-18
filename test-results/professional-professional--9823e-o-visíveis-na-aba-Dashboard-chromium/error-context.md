# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: professional\professional-dashboard.spec.ts >> professional-dashboard — profissional aprovado >> filtros de período Hoje/Semana/Mês estão visíveis na aba Dashboard
- Location: tests\e2e\professional\professional-dashboard.spec.ts:93:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /dr\(a\)\.|painel profissional/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading', { name: /dr\(a\)\.|painel profissional/i })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - link "Rápido Doutor Rápido Doutor" [ref=e6] [cursor=pointer]:
        - /url: /Home
        - img "Rápido Doutor" [ref=e8]
        - generic [ref=e9]: Rápido Doutor
      - heading "Entrar na sua conta" [level=1] [ref=e10]
      - paragraph [ref=e11]: Bem-vindo de volta.
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]:
          - text: Email
          - textbox "Email" [ref=e16]:
            - /placeholder: seu@email.com
        - generic [ref=e17]:
          - text: Senha
          - generic [ref=e18]:
            - textbox "Senha" [ref=e19]:
              - /placeholder: Digite sua senha
            - button [ref=e20] [cursor=pointer]:
              - img [ref=e21]
        - button "Entrar" [ref=e24] [cursor=pointer]
      - generic [ref=e25]:
        - text: Nao tem conta?
        - link "Criar conta de paciente" [ref=e26] [cursor=pointer]:
          - /url: /CadastroPaciente
      - generic [ref=e27]:
        - text: E profissional de saude?
        - link "Cadastrar-se como profissional" [ref=e28] [cursor=pointer]:
          - /url: /CadastroProfissional
          - img [ref=e29]
          - text: Cadastrar-se como profissional
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  17  | import { USERS } from './constants';
  18  | 
  19  | // ---------------------------------------------------------------------------
  20  | // Menu do usuário (Layout.jsx — DropdownMenu no header)
  21  | // O trigger mostra user.full_name.split(' ')[0] || 'Usuário'
  22  | // ---------------------------------------------------------------------------
  23  | 
  24  | /** Abre o dropdown de usuário no Layout. */
  25  | export async function openUserMenu(page: Page) {
  26  |   // Localiza o trigger pelo primeiro nome OU fallback 'Usuário'
  27  |   const trigger = page
  28  |     .locator('header')
  29  |     .getByRole('button', { name: /usuário/i })
  30  |     .or(
  31  |       page.locator('header').getByRole('button', {
  32  |         name: new RegExp(
  33  |           [USERS.patient.name, USERS.professional.name, USERS.admin.name]
  34  |             .map((n) => n.split(' ')[0])
  35  |             .join('|'),
  36  |           'i',
  37  |         ),
  38  |       }),
  39  |     );
  40  |   await trigger.first().click();
  41  | }
  42  | 
  43  | /** Faz logout via menu do Layout. */
  44  | export async function logoutViaMenu(page: Page) {
  45  |   await openUserMenu(page);
  46  |   await page.getByRole('menuitem', { name: 'Sair' }).click();
  47  |   await expect(page).toHaveURL('/', { timeout: 15_000 });
  48  | }
  49  | 
  50  | // ---------------------------------------------------------------------------
  51  | // Calendário (react-day-picker — table[role="grid"])
  52  | // Usado em AgendamentoEspecialidade e AgendamentoPerfil
  53  | // ---------------------------------------------------------------------------
  54  | 
  55  | /** Clica na primeira célula de data habilitada no calendário. */
  56  | export async function selectFirstAvailableDate(page: Page): Promise<boolean> {
  57  |   await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });
  58  |   const enabledDay = page
  59  |     .locator('table[role="grid"] button[name]:not([disabled])')
  60  |     .first();
  61  |   const count = await enabledDay.count();
  62  |   if (count === 0) return false;
  63  |   await enabledDay.click();
  64  |   return true;
  65  | }
  66  | 
  67  | /** Clica no primeiro slot de horário disponível (botões HH:MM). */
  68  | export async function selectFirstAvailableTimeSlot(page: Page): Promise<string | null> {
  69  |   const slot = page
  70  |     .locator('div.grid button')
  71  |     .filter({ hasText: /^\d{2}:\d{2}$/ })
  72  |     .first();
  73  |   const count = await slot.count();
  74  |   if (count === 0) return null;
  75  |   const text = await slot.textContent();
  76  |   await slot.click();
  77  |   return text?.trim() ?? null;
  78  | }
  79  | 
  80  | // ---------------------------------------------------------------------------
  81  | // Dashboard do paciente (DashboardPaciente.jsx)
  82  | // ---------------------------------------------------------------------------
  83  | 
  84  | /** Aguarda o DashboardPaciente carregar completamente (h1 visível). */
  85  | export async function waitForPatientDashboard(page: Page) {
  86  |   await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  87  |   await expect(page.getByText('Gerencie suas consultas e agendamentos')).toBeVisible();
  88  | }
  89  | 
  90  | /** Clica em uma das abas do DashboardPaciente. */
  91  | export async function clickDashboardTab(
  92  |   page: Page,
  93  |   tab: 'proximas' | 'historico' | 'canceladas',
  94  | ) {
  95  |   const labels: Record<typeof tab, RegExp> = {
  96  |     proximas:   /próximas/i,
  97  |     historico:  /histórico/i,
  98  |     canceladas: /canceladas/i,
  99  |   };
  100 |   await page.getByRole('tab', { name: labels[tab] }).click();
  101 |   await expect(page.getByRole('tab', { name: labels[tab] })).toHaveAttribute(
  102 |     'aria-selected',
  103 |     'true',
  104 |   );
  105 | }
  106 | 
  107 | // ---------------------------------------------------------------------------
  108 | // Dashboard do profissional (DashboardProfissional.jsx)
  109 | // Tem duas abas internas: "Dashboard" e "Meu Perfil" (botões, não Tabs Radix)
  110 | // ---------------------------------------------------------------------------
  111 | 
  112 | /** Aguarda o DashboardProfissional carregar (h1 com nome ou fallback). */
  113 | export async function waitForProfessionalDashboard(page: Page) {
  114 |   await expect(page).toHaveURL(/\/DashboardProfissional/, { timeout: 15_000 });
  115 |   await expect(
  116 |     page.getByRole('heading', { name: /dr\(a\)\.|painel profissional/i }),
> 117 |   ).toBeVisible({ timeout: 15_000 });
      |     ^ Error: expect(locator).toBeVisible() failed
  118 | }
  119 | 
  120 | /** Clica na aba interna do DashboardProfissional. */
  121 | export async function clickProfessionalTab(
  122 |   page: Page,
  123 |   tab: 'dashboard' | 'perfil',
  124 | ) {
  125 |   const labels = { dashboard: 'Dashboard', perfil: 'Meu Perfil' };
  126 |   // São <button> normais com texto, não Tabs Radix
  127 |   await page.getByRole('button', { name: labels[tab], exact: true }).click();
  128 | }
  129 | 
  130 | // ---------------------------------------------------------------------------
  131 | // Perfil do usuário (Perfil.jsx — /Perfil)
  132 | // ---------------------------------------------------------------------------
  133 | 
  134 | /** Aguarda a página /Perfil carregar (h1 "Meu perfil"). */
  135 | export async function waitForPerfilPage(page: Page) {
  136 |   await expect(
  137 |     page.getByRole('heading', { name: 'Meu perfil' })
  138 |   ).toBeVisible({ timeout: 12_000 });
  139 | }
  140 | 
  141 | /** Preenche um campo do formulário de perfil por id. */
  142 | export async function fillPerfilField(page: Page, fieldId: string, value: string) {
  143 |   const input = page.locator(`#${fieldId}`);
  144 |   await input.clear();
  145 |   await input.fill(value);
  146 | }
  147 | 
  148 | /** Submete o formulário de perfil e aguarda o feedback de sucesso "Salvo!". */
  149 | export async function savePerfilAndWait(page: Page) {
  150 |   await page.getByRole('button', { name: /salvar alteracoes/i }).click();
  151 |   // Perfil.jsx: onSuccess → setSaved(true) → botão muda para "Salvo!" por 3s
  152 |   await expect(
  153 |     page.getByRole('button', { name: /salvo!/i })
  154 |   ).toBeVisible({ timeout: 12_000 });
  155 | }
  156 | 
```