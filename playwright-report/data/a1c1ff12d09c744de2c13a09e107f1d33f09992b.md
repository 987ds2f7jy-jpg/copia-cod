# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: professional\professional-dashboard.spec.ts >> professional-dashboard — status gate (R7) >> acesso por role >> paciente em /DashboardProfissional vê "Acesso Restrito"
- Location: tests\e2e\professional\professional-dashboard.spec.ts:225:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Acesso Restrito' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: 'Acesso Restrito' })

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
  130 |     await goto(ROUTES.dashboardProfissional);
  131 |     await waitForProfessionalDashboard(page);
  132 | 
  133 |     await page.getByRole('button', { name: 'Semana', exact: true }).click();
  134 | 
  135 |     // Botão selecionado recebe bg-white e shadow — verificar que a página não quebra
  136 |     await expect(page.getByText('Consultas realizadas')).toBeVisible();
  137 |   });
  138 | 
  139 |   rdTest('clicar em "Meu Perfil" exibe o componente MeuPerfil @critical', async ({
  140 |     page, goto,
  141 |   }) => {
  142 |     await goto(ROUTES.dashboardProfissional);
  143 |     await waitForProfessionalDashboard(page);
  144 | 
  145 |     await clickProfessionalTab(page, 'perfil');
  146 | 
  147 |     // MeuPerfil.jsx: CardTitle "Foto de Perfil", "Apresentação", etc.
  148 |     await expect(
  149 |       page.getByText('Foto de Perfil').or(page.getByText('Apresentação'))
  150 |     ).toBeVisible({ timeout: 10_000 });
  151 |   });
  152 | 
  153 |   rdTest('sessão persiste após reload @critical', async ({ page, goto }) => {
  154 |     await goto(ROUTES.dashboardProfissional);
  155 |     await waitForProfessionalDashboard(page);
  156 | 
  157 |     await page.reload();
  158 | 
  159 |     await expect(page).toHaveURL(/DashboardProfissional/, { timeout: 15_000 });
  160 |     await waitForProfessionalDashboard(page);
  161 |   });
  162 | 
  163 |   rdTest('após logout, dashboard redireciona para /Entrar', async ({ page, goto }) => {
  164 |     await goto(ROUTES.dashboardProfissional);
  165 |     await waitForProfessionalDashboard(page);
  166 | 
  167 |     await logoutViaMenu(page);
  168 | 
  169 |     await goto(ROUTES.dashboardProfissional);
  170 |     await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  171 |   });
  172 | 
  173 |   // -------------------------------------------------------------------------
  174 |   // Sem dados — não deve quebrar a tela
  175 |   // -------------------------------------------------------------------------
  176 |   rdTest('dashboard sem consultas não exibe crash (estado zerado)', async ({
  177 |     page, goto,
  178 |   }) => {
  179 |     await goto(ROUTES.dashboardProfissional);
  180 |     await waitForProfessionalDashboard(page);
  181 | 
  182 |     // KPIs existem mesmo com valor 0
  183 |     await expect(page.getByText('Consultas realizadas')).toBeVisible({ timeout: 10_000 });
  184 |     // Nenhum erro de JS na tela
  185 |     await expect(page.getByText(/something went wrong|error boundary/i)).not.toBeVisible();
  186 |   });
  187 | 
  188 | });
  189 | 
  190 | // ---------------------------------------------------------------------------
  191 | // Profissional com status não aprovado (R7)
  192 | // ---------------------------------------------------------------------------
  193 | rdTest.describe('professional-dashboard — status gate (R7)', () => {
  194 | 
  195 |   rdTest('pending_review: ProfessionalStatusGate bloqueia dashboard @critical', async ({
  196 |     page, goto,
  197 |   }) => {
  198 |     rdTest.skip(
  199 |       !process.env.E2E_PENDING_PROFESSIONAL_EMAIL,
  200 |       'Define E2E_PENDING_PROFESSIONAL_EMAIL (profissional com status=pending_review).',
  201 |     );
  202 | 
  203 |     // Login manual com o profissional pending
  204 |     await goto(ROUTES.entrar);
  205 |     await page.getByLabel('Email').fill(process.env.E2E_PENDING_PROFESSIONAL_EMAIL!);
  206 |     await page.getByLabel('Senha').fill(process.env.E2E_PENDING_PROFESSIONAL_PASSWORD ?? '');
  207 |     await page.getByRole('button', { name: 'Entrar' }).click();
  208 |     await page.waitForURL(/DashboardProfissional/, { timeout: 20_000 });
  209 | 
  210 |     // ProfessionalStatusGate.jsx: h2 "Cadastro em análise"
  211 |     await expect(
  212 |       page.getByRole('heading', { name: 'Cadastro em análise' })
  213 |     ).toBeVisible({ timeout: 10_000 });
  214 | 
  215 |     // O gate exibe link para voltar ao início
  216 |     await expect(page.getByRole('link', { name: 'Voltar ao Início' })).toBeVisible();
  217 | 
  218 |     // Nenhum KPI deve estar visível (dashboard real bloqueado)
  219 |     await expect(page.getByText('Consultas realizadas')).not.toBeVisible();
  220 |   });
  221 | 
  222 |   rdTest.describe('acesso por role', () => {
  223 |     rdTest.use({ storageState: AUTH_STATE.patient });
  224 | 
  225 |     rdTest('paciente em /DashboardProfissional vê "Acesso Restrito"', async ({ page, goto }) => {
  226 |     await goto(ROUTES.dashboardProfissional);
  227 | 
  228 |     await expect(
  229 |       page.getByRole('heading', { name: 'Acesso Restrito' })
> 230 |     ).toBeVisible({ timeout: 10_000 });
      |       ^ Error: expect(locator).toBeVisible() failed
  231 | 
  232 |     // URL permanece — não houve redirect (comportamento documentado em R1)
  233 |     await expect(page).toHaveURL(/DashboardProfissional/);
  234 |   });
  235 |   });
  236 | 
  237 | });
  238 | 
```