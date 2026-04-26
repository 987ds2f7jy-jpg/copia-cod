# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: patient\servicos-extras.spec.ts >> renovacao-receitas — sem autenticação >> redireciona para /Entrar sem sessão @critical
- Location: tests\e2e\patient\servicos-extras.spec.ts:309:3

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/Entrar/
Received string:  "http://localhost:8080/RenovacaoReceitas"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    14 × unexpected value "http://localhost:8080/RenovacaoReceitas"

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
          - link "Planos" [ref=e17] [cursor=pointer]:
            - /url: /Planos
        - generic [ref=e19]:
          - link "Entrar" [ref=e20] [cursor=pointer]:
            - /url: /Entrar
            - button "Entrar" [ref=e21]:
              - img
              - generic [ref=e22]: Entrar
          - link "Criar conta" [ref=e23] [cursor=pointer]:
            - /url: /CadastroPaciente
            - button "Criar conta" [ref=e24]
    - main [ref=e25]:
      - generic [ref=e28]:
        - generic [ref=e29]:
          - heading "Renovacao de Receitas" [level=1] [ref=e30]
          - paragraph [ref=e31]: Renove suas receitas de medicamentos de uso continuo de forma rapida e digital, com envio direto ao medico.
        - generic [ref=e33]:
          - generic [ref=e34]:
            - generic [ref=e35]:
              - img [ref=e36]
              - generic [ref=e38]:
                - paragraph [ref=e39]: Medicamentos nao renovados
                - paragraph [ref=e40]: Nao renovamos medicamentos tarja preta, antibioticos e terapias hormonais com esteroides androgenicos e anabolizantes.
            - generic [ref=e41]:
              - img [ref=e42]
              - generic [ref=e45]:
                - paragraph [ref=e46]: Documentacao obrigatoria
                - paragraph [ref=e47]: E obrigatorio anexar a prescricao anterior de forma legivel para analise medica.
            - generic [ref=e48]:
              - img [ref=e49]
              - generic [ref=e52]:
                - paragraph [ref=e53]: Autonomia medica
                - paragraph [ref=e54]: O medico possui total autonomia para negar o pedido caso considere necessario.
            - generic [ref=e55]:
              - img [ref=e56]
              - generic [ref=e58]:
                - paragraph [ref=e59]: Sua responsabilidade
                - paragraph [ref=e60]: Voce e responsavel pela veracidade das informacoes fornecidas ao medico.
          - button "Confirmo que entendi as regras e desejo prosseguir com a renovacao" [ref=e61] [cursor=pointer]
    - contentinfo [ref=e62]:
      - generic [ref=e63]:
        - generic [ref=e64]:
          - generic [ref=e65]:
            - generic [ref=e66]:
              - img "Rápido Doutor" [ref=e68]
              - generic [ref=e69]: Rápido Doutor
            - paragraph [ref=e70]: Conectando você aos melhores profissionais de saúde, quando você precisa.
          - generic [ref=e71]:
            - heading "Serviços" [level=4] [ref=e72]
            - list [ref=e73]:
              - listitem [ref=e74]:
                - link "Ver Especialistas" [ref=e75] [cursor=pointer]:
                  - /url: /Especialidades
              - listitem [ref=e76]:
                - link "Agendamento" [ref=e77] [cursor=pointer]:
                  - /url: /AgendamentoEspecialidade
              - listitem [ref=e78]:
                - link "Consulta Agora" [ref=e79] [cursor=pointer]:
                  - /url: /ConsultaAgora
              - listitem [ref=e80]:
                - link "Pergunte ao Especialista" [ref=e81] [cursor=pointer]:
                  - /url: /PergunteEspecialista
              - listitem [ref=e82]:
                - link "Planos" [ref=e83] [cursor=pointer]:
                  - /url: /Planos
          - generic [ref=e84]:
            - heading "Para Profissionais" [level=4] [ref=e85]
            - list [ref=e86]:
              - listitem [ref=e87]:
                - link "Cadastre-se" [ref=e88] [cursor=pointer]:
                  - /url: /CadastroProfissional
              - listitem [ref=e89]:
                - link "Área do Médico" [ref=e90] [cursor=pointer]:
                  - /url: /DashboardProfissional
          - generic [ref=e91]:
            - heading "Suporte" [level=4] [ref=e92]
            - list [ref=e93]:
              - listitem [ref=e94]:
                - link "Central de Ajuda" [ref=e95] [cursor=pointer]:
                  - /url: "#"
              - listitem [ref=e96]:
                - link "Termos de Uso" [ref=e97] [cursor=pointer]:
                  - /url: "#"
              - listitem [ref=e98]:
                - link "Privacidade" [ref=e99] [cursor=pointer]:
                  - /url: "#"
        - generic [ref=e100]: © 2026 Rápido Doutor. Todos os direitos reservados.
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  214 |   });
  215 | 
  216 | });
  217 | 
  218 | // ===========================================================================
  219 | // LAUDOS MÉDICOS
  220 | // ===========================================================================
  221 | 
  222 | rdTest.describe('laudos-medicos — sem autenticação', () => {
  223 | 
  224 |   rdTest('redireciona para /Entrar sem sessão @critical', async ({
  225 |     page, goto, clearAuthState,
  226 |   }) => {
  227 |     await clearAuthState();
  228 |     await goto(ROUTES.laudosMedicos);
  229 |     await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  230 |   });
  231 | 
  232 | });
  233 | 
  234 | rdTest.describe('laudos-medicos — paciente autenticado', () => {
  235 | 
  236 |   rdTest.use({ storageState: AUTH_STATE.patient });
  237 | 
  238 |   rdTest.beforeEach(async ({ page }, testInfo) => {
  239 |     void page;
  240 |     skipIfNoAuth(testInfo, 'patient');
  241 |   });
  242 | 
  243 |   rdTest('página carrega com h1 e tela de avisos @critical', async ({ page, goto }) => {
  244 |     await goto(ROUTES.laudosMedicos);
  245 |     await expect(page).not.toHaveURL(/\/Entrar/);
  246 | 
  247 |     // LaudosMedicos.jsx: h1 "Laudos Medicos" (sem acento)
  248 |     await expect(
  249 |       page.getByRole('heading', { name: 'Laudos Medicos' }).first()
  250 |     ).toBeVisible({ timeout: 12_000 });
  251 |   });
  252 | 
  253 |   rdTest('tela de avisos exibe informações obrigatórias antes do aceite @critical', async ({
  254 |     page, goto,
  255 |   }) => {
  256 |     await goto(ROUTES.laudosMedicos);
  257 |     await expect(page).not.toHaveURL(/\/Entrar/);
  258 |     await expect(
  259 |       page.getByRole('heading', { name: 'Laudos Medicos' }).first()
  260 |     ).toBeVisible({ timeout: 12_000 });
  261 | 
  262 |     // Avisos importantes são exibidos antes de aceitar
  263 |     await expect(page.getByText(/autonomia medica/i)).toBeVisible();
  264 |     await expect(page.getByText(/documentacao obrigatoria/i)).toBeVisible();
  265 |   });
  266 | 
  267 |   rdTest('botão de aceite existe e é clicável @critical', async ({ page, goto }) => {
  268 |     await goto(ROUTES.laudosMedicos);
  269 |     await expect(page).not.toHaveURL(/\/Entrar/);
  270 |     await expect(
  271 |       page.getByRole('heading', { name: 'Laudos Medicos' }).first()
  272 |     ).toBeVisible({ timeout: 12_000 });
  273 | 
  274 |     await expect(
  275 |       page.getByRole('button', { name: /confirmo que li os avisos/i })
  276 |     ).toBeVisible();
  277 |   });
  278 | 
  279 |   rdTest('aceitar avisos exibe o formulário multi-step @critical', async ({ page, goto }) => {
  280 |     await goto(ROUTES.laudosMedicos);
  281 |     await expect(page).not.toHaveURL(/\/Entrar/);
  282 |     await expect(
  283 |       page.getByRole('heading', { name: 'Laudos Medicos' }).first()
  284 |     ).toBeVisible({ timeout: 12_000 });
  285 | 
  286 |     await page.getByRole('button', { name: /confirmo que li os avisos/i }).click();
  287 | 
  288 |     // Após aceite, o formulário multi-step aparece
  289 |     // LaudosMedicos.jsx mostra steps de formulário (identidade, exames, relatórios)
  290 |     // O h1 permanece visível
  291 |     await expect(
  292 |       page.getByRole('heading', { name: 'Laudos Medicos' }).first()
  293 |     ).toBeVisible({ timeout: 8_000 });
  294 | 
  295 |     // Deve ter algum indicador de step ou campo de upload
  296 |     const hasStepIndicator = await page.locator('[class*="step"]').count() > 0 ||
  297 |       await page.getByText(/documento|identidade|upload/i).isVisible().catch(() => false);
  298 |     expect(hasStepIndicator).toBe(true);
  299 |   });
  300 | 
  301 | });
  302 | 
  303 | // ===========================================================================
  304 | // RENOVAÇÃO DE RECEITAS
  305 | // ===========================================================================
  306 | 
  307 | rdTest.describe('renovacao-receitas — sem autenticação', () => {
  308 | 
  309 |   rdTest('redireciona para /Entrar sem sessão @critical', async ({
  310 |     page, goto, clearAuthState,
  311 |   }) => {
  312 |     await clearAuthState();
  313 |     await goto(ROUTES.renovacaoReceitas);
> 314 |     await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
      |                        ^ Error: expect(page).toHaveURL(expected) failed
  315 |   });
  316 | 
  317 | });
  318 | 
  319 | rdTest.describe('renovacao-receitas — paciente autenticado', () => {
  320 | 
  321 |   rdTest.use({ storageState: AUTH_STATE.patient });
  322 | 
  323 |   rdTest.beforeEach(async ({ page }, testInfo) => {
  324 |     void page;
  325 |     skipIfNoAuth(testInfo, 'patient');
  326 |   });
  327 | 
  328 |   rdTest('página carrega com h1 e avisos antes do aceite @critical', async ({ page, goto }) => {
  329 |     await goto(ROUTES.renovacaoReceitas);
  330 |     await expect(page).not.toHaveURL(/\/Entrar/);
  331 | 
  332 |     // RenovacaoReceitas.jsx: h1 sem acento
  333 |     await expect(
  334 |       page.getByRole('heading', { name: 'Renovacao de Receitas' })
  335 |     ).toBeVisible({ timeout: 12_000 });
  336 | 
  337 |     // Avisos obrigatórios
  338 |     await expect(page.getByText(/medicamentos nao renovados/i)).toBeVisible();
  339 |     await expect(page.getByText(/autonomia medica/i)).toBeVisible();
  340 |   });
  341 | 
  342 |   rdTest('botão de aceite abre o formulário @critical', async ({ page, goto }) => {
  343 |     await goto(ROUTES.renovacaoReceitas);
  344 |     await expect(page).not.toHaveURL(/\/Entrar/);
  345 |     await expect(
  346 |       page.getByRole('heading', { name: 'Renovacao de Receitas' })
  347 |     ).toBeVisible({ timeout: 12_000 });
  348 | 
  349 |     await page.getByRole('button', {
  350 |       name: /confirmo que entendi as regras e desejo prosseguir/i,
  351 |     }).click();
  352 | 
  353 |     // Formulário aparece com campo de medicamento
  354 |     await expect(
  355 |       page.locator('#medicamento')
  356 |     ).toBeVisible({ timeout: 8_000 });
  357 |   });
  358 | 
  359 |   rdTest('formulário exibe campos obrigatórios após aceite @critical', async ({
  360 |     page, goto,
  361 |   }) => {
  362 |     await goto(ROUTES.renovacaoReceitas);
  363 |     await expect(page).not.toHaveURL(/\/Entrar/);
  364 |     await expect(
  365 |       page.getByRole('heading', { name: 'Renovacao de Receitas' })
  366 |     ).toBeVisible({ timeout: 12_000 });
  367 | 
  368 |     await page.getByRole('button', {
  369 |       name: /confirmo que entendi as regras e desejo prosseguir/i,
  370 |     }).click();
  371 | 
  372 |     await expect(page.locator('#medicamento')).toBeVisible({ timeout: 8_000 });
  373 |     await expect(page.locator('#dosagem')).toBeVisible();
  374 | 
  375 |     // Select de frequência
  376 |     await expect(page.getByText('Selecione a frequencia')).toBeVisible();
  377 | 
  378 |     // Área de upload de receita
  379 |     await expect(
  380 |       page.getByText(/clique para enviar jpg|upload/i)
  381 |     ).toBeVisible();
  382 |   });
  383 | 
  384 |   rdTest('botão submit fica desabilitado sem medicamento e dosagem @critical', async ({
  385 |     page, goto,
  386 |   }) => {
  387 |     await goto(ROUTES.renovacaoReceitas);
  388 |     await expect(page).not.toHaveURL(/\/Entrar/);
  389 |     await expect(
  390 |       page.getByRole('heading', { name: 'Renovacao de Receitas' })
  391 |     ).toBeVisible({ timeout: 12_000 });
  392 | 
  393 |     await page.getByRole('button', {
  394 |       name: /confirmo que entendi as regras e desejo prosseguir/i,
  395 |     }).click();
  396 | 
  397 |     await expect(page.locator('#medicamento')).toBeVisible({ timeout: 8_000 });
  398 | 
  399 |     // Botão desabilitado sem preencher os campos obrigatórios
  400 |     await expect(
  401 |       page.getByRole('button', { name: /enviar solicitacao de renovacao/i })
  402 |     ).toBeDisabled();
  403 |   });
  404 | 
  405 |   rdTest('preencher medicamento e dosagem não é suficiente — precisa do arquivo @critical', async ({
  406 |     page, goto,
  407 |   }) => {
  408 |     await goto(ROUTES.renovacaoReceitas);
  409 |     await expect(page).not.toHaveURL(/\/Entrar/);
  410 |     await expect(
  411 |       page.getByRole('heading', { name: 'Renovacao de Receitas' })
  412 |     ).toBeVisible({ timeout: 12_000 });
  413 | 
  414 |     await page.getByRole('button', {
```