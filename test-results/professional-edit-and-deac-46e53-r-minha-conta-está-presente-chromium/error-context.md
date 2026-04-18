# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: professional\edit-and-deactivate.spec.ts >> perfil — AlertDialog de desativação >> botão de confirmação "Sim, desativar minha conta" está presente
- Location: tests\e2e\professional\edit-and-deactivate.spec.ts:221:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Meu perfil' })
Expected: visible
Timeout: 12000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 12000ms
  - waiting for getByRole('heading', { name: 'Meu perfil' })

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
  117 |   ).toBeVisible({ timeout: 15_000 });
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
> 138 |   ).toBeVisible({ timeout: 12_000 });
      |     ^ Error: expect(locator).toBeVisible() failed
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