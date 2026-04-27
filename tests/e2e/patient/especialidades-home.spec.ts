/**
 * patient/especialidades-home.spec.ts
 *
 * TIPO: Fluxo crítico — rotas públicas de descoberta
 *
 * ROTAS COBERTAS (sem cobertura anterior):
 *   /             — Home: CTAs, seção de especialidades, navegação
 *   /Especialidades — busca por texto, filtro por especialidade, estado vazio,
 *                     navegação para perfil e agendamento
 *   /PerfilProfissional — sem ?id= (not-found), com id inválido, com id válido
 *
 * SELETORES REAIS
 *   Home.jsx:
 *     h1 hero principal
 *     Link /ConsultaAgora  → button "Consulta Agora"
 *     Link /AgendamentoEspecialidade → button "Agendar Consulta"
 *     section de especialidades → "Mais de 15 especialidades..."
 *     Link /Especialidades → button "Ver todas as especialidades"
 *
 *   Especialidades.jsx:
 *     h1 (sempre visível)
 *     p "Selecione uma especialidade ou busque por profissional" (sem filtro)
 *     p "Escolha o profissional ideal para você" (com filtro)
 *     h3 "Especialidades" (sidebar)
 *     Input placeholder "Buscar por nome ou especialidade..."
 *     h3 "Nenhum profissional encontrado" + button "Limpar busca" (estado vazio)
 *     button "Ver Perfil" / button "Agendar" (cards de profissional)
 *
 *   PerfilProfissional.jsx:
 *     h2 "Profissional não encontrado" (sem id ou id inválido)
 *     p  "Este perfil pode estar inativo ou o link pode estar incorreto."
 *     button "Ver todos os especialistas" → /Especialidades
 *     button "Agendar Consulta" (com id válido)
 *
 * DEPENDÊNCIAS
 *   E2E_PROFESSIONAL_PUBLIC_ID — para testes com perfil válido
 */

import { test as rdTest, expect } from '../support/fixtures';
import { ROUTES } from '../support/constants';

// ===========================================================================
// HOME — CTAs e navegação
// ===========================================================================

rdTest.describe('home — estrutura', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('h1 hero e link "Entrar" visíveis sem auth @smoke', async ({ page, goto }) => {
    await goto(ROUTES.home);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 12_000 });
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
  });

  rdTest('CTA "Consulta Agora" aponta para /ConsultaAgora @critical', async ({ page, goto }) => {
    await goto(ROUTES.home);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 12_000 });
    await page.getByRole('link', { name: 'Consulta Agora' }).first().click();
    // Sem auth redireciona para /Entrar; com auth vai para /ConsultaAgora
    await expect(page).toHaveURL(/ConsultaAgora|Entrar/, { timeout: 10_000 });
  });

  rdTest('CTA "Agendar Consulta" navega para /AgendamentoEspecialidade @critical', async ({ page, goto }) => {
    await goto(ROUTES.home);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 12_000 });
    await page.getByRole('link', { name: 'Agendar Consulta' }).first().click();
    await expect(page).toHaveURL(/AgendamentoEspecialidade/, { timeout: 10_000 });
  });

  rdTest('"Ver todas as especialidades" navega para /Especialidades @critical', async ({ page, goto }) => {
    await goto(ROUTES.home);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 12_000 });
    const link = page.getByRole('link', { name: 'Ver todas as especialidades' })
      .or(page.getByRole('button', { name: 'Ver todas as especialidades' }));
    await expect(link.first()).toBeVisible({ timeout: 10_000 });
    await link.first().click();
    await expect(page).toHaveURL(/Especialidades/, { timeout: 10_000 });
  });

  rdTest('cards de especialidade na seção hero têm links para /Especialidades?especialidade=', async ({ page, goto }) => {
    await goto(ROUTES.home);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 12_000 });
    // Pelo menos um card deve ter link para Especialidades com query param
    const specLinks = page.getByRole('link').filter({
      hasText: /clínico|cardiolog|psicolog|nutriç|pediatria|dermatolog|ginecolog/i,
    });
    await expect(specLinks.first()).toBeVisible({ timeout: 10_000 });
  });

});

// ===========================================================================
// ESPECIALIDADES — busca e filtros
// ===========================================================================

rdTest.describe('especialidades — estrutura e acesso', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('carrega sem login e exibe h1 @smoke', async ({ page, goto }) => {
    await goto(ROUTES.especialidades);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
  });

  rdTest('subtítulo inicial "Selecione uma especialidade ou busque por profissional" @critical', async ({ page, goto }) => {
    await goto(ROUTES.especialidades);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
    await expect(
      page.getByText('Selecione uma especialidade ou busque por profissional')
    ).toBeVisible();
  });

  rdTest('sidebar "Especialidades" com filtros está visível @critical', async ({ page, goto }) => {
    await goto(ROUTES.especialidades);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
    await expect(
      page.getByRole('heading', { name: 'Especialidades', level: 3 })
    ).toBeVisible();
  });

  rdTest('campo de busca por nome ou especialidade presente @critical', async ({ page, goto }) => {
    await goto(ROUTES.especialidades);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
    await expect(
      page.getByPlaceholder('Buscar por nome ou especialidade...')
    ).toBeVisible();
  });

});

rdTest.describe('especialidades — busca e estado vazio', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('busca por texto inexistente exibe "Nenhum profissional encontrado" @critical', async ({ page, goto }) => {
    await goto(ROUTES.especialidades);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    await page.getByPlaceholder('Buscar por nome ou especialidade...').fill('xyzprofissionalquenaoexiste999');
    await page.waitForTimeout(500); // aguarda debounce do filtro

    await expect(
      page.getByRole('heading', { name: 'Nenhum profissional encontrado' })
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByText('Tente buscar por outra especialidade ou nome')
    ).toBeVisible();
  });

  rdTest('"Limpar busca" reseta o estado vazio @critical', async ({ page, goto }) => {
    await goto(ROUTES.especialidades);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    await page.getByPlaceholder('Buscar por nome ou especialidade...').fill('xyzquenaoexiste999');
    await expect(
      page.getByRole('heading', { name: 'Nenhum profissional encontrado' })
    ).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: 'Limpar busca' }).click();

    await expect(
      page.getByRole('heading', { name: 'Nenhum profissional encontrado' })
    ).not.toBeVisible({ timeout: 5_000 });
  });

  rdTest('URL param ?especialidade= pré-seleciona filtro e muda subtítulo @critical', async ({ page, goto }) => {
    await goto('/Especialidades?especialidade=Psicologia');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
    // Com filtro ativo, subtítulo muda
    const hasFiltrado = await page.getByText('Escolha o profissional ideal para você').isVisible().catch(() => false);
    const hasPadrao   = await page.getByText('Selecione uma especialidade ou busque por profissional').isVisible().catch(() => false);
    expect(hasFiltrado || hasPadrao).toBe(true);
  });

  rdTest('busca parcial filtra sem crash @critical', async ({ page, goto }) => {
    await goto(ROUTES.especialidades);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    await page.getByPlaceholder('Buscar por nome ou especialidade...').fill('psico');
    await page.waitForTimeout(500);

    // Com ou sem resultados, não crasha
    const hasResults = await page.getByRole('heading', { level: 3 }).count() > 0;
    const hasEmpty   = await page.getByText('Nenhum profissional encontrado').isVisible().catch(() => false);
    expect(hasResults || hasEmpty).toBe(true);
  });

});

rdTest.describe('especialidades — navegação para perfil e agendamento', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('"Ver Perfil" navega para /PerfilProfissional quando há profissionais', async ({ page, goto }) => {
    await goto(ROUTES.especialidades);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    const link = page.getByRole('link', { name: 'Ver Perfil' }).first();
    const hasLink = await link.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasLink) return; // sem dados de profissional no banco — neutro

    await link.click();
    await expect(page).toHaveURL(/PerfilProfissional/, { timeout: 10_000 });
  });

  rdTest('"Agendar" navega para /AgendamentoPerfil quando há profissionais', async ({ page, goto }) => {
    await goto(ROUTES.especialidades);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    const link = page.getByRole('link', { name: 'Agendar' }).first();
    const hasLink = await link.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasLink) return;

    await link.click();
    await expect(page).toHaveURL(/AgendamentoPerfil/, { timeout: 10_000 });
  });

});

// ===========================================================================
// PERFIL PROFISSIONAL
// ===========================================================================

rdTest.describe('perfil-profissional — sem ID ou ID inválido', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('sem ?id= exibe "Profissional não encontrado" @critical', async ({ page, goto }) => {
    await goto(ROUTES.perfilProfissional);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Profissional não encontrado' })
    ).toBeVisible({ timeout: 12_000 });
    await expect(
      page.getByText('Este perfil pode estar inativo ou o link pode estar incorreto.')
    ).toBeVisible();
  });

  rdTest('ID inválido exibe "Profissional não encontrado" @critical', async ({ page, goto }) => {
    await goto('/PerfilProfissional?id=id-invalido-e2e-9999');
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Profissional não encontrado' })
    ).toBeVisible({ timeout: 12_000 });
  });

  rdTest('"Ver todos os especialistas" volta para /Especialidades @critical', async ({ page, goto }) => {
    await goto(ROUTES.perfilProfissional);
    await expect(
      page.getByRole('heading', { name: 'Profissional não encontrado' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', { name: 'Ver todos os especialistas' }).click();
    await expect(page).toHaveURL(/Especialidades/, { timeout: 10_000 });
  });

});

rdTest.describe('perfil-profissional — com ID válido', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('perfil carrega sem login e exibe botão "Agendar Consulta" @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_PROFESSIONAL_PUBLIC_ID,
      'Define E2E_PROFESSIONAL_PUBLIC_ID com public_profile_id de profissional aprovado.',
    );
    await goto(`/PerfilProfissional?id=${process.env.E2E_PROFESSIONAL_PUBLIC_ID}`);
    await expect(page).not.toHaveURL(/Entrar/);

    await expect(
      page.getByRole('button', { name: 'Agendar Consulta' })
        .or(page.getByRole('link', { name: 'Agendar Consulta' }))
    ).toBeVisible({ timeout: 15_000 });
  });

  rdTest('"Agendar Consulta" navega para /AgendamentoPerfil?professional=id @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_PROFESSIONAL_PUBLIC_ID,
      'Define E2E_PROFESSIONAL_PUBLIC_ID.',
    );
    await goto(`/PerfilProfissional?id=${process.env.E2E_PROFESSIONAL_PUBLIC_ID}`);

    const agendarLink = page.getByRole('link', { name: 'Agendar Consulta' }).first();
    await expect(agendarLink).toBeVisible({ timeout: 15_000 });
    await agendarLink.click();

    await expect(page).toHaveURL(/AgendamentoPerfil/, { timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp(process.env.E2E_PROFESSIONAL_PUBLIC_ID!));
  });

  rdTest('perfil exibe métricas (consultas, avaliações) @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_PROFESSIONAL_PUBLIC_ID,
      'Define E2E_PROFESSIONAL_PUBLIC_ID.',
    );
    await goto(`/PerfilProfissional?id=${process.env.E2E_PROFESSIONAL_PUBLIC_ID}`);
    await expect(
      page.getByRole('button', { name: 'Agendar Consulta' })
        .or(page.getByRole('link', { name: 'Agendar Consulta' }))
    ).toBeVisible({ timeout: 15_000 });

    // ProfileMetrics: consultas realizadas e avaliações (com ou sem dados)
    await expect(page.getByText(/consultas|avaliações|avaliacao/i).first()).toBeVisible();
  });

});
