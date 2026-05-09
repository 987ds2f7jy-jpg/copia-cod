/**
 * support/auth-harness.ts
 *
 * PROPÓSITO
 *   Harness de autenticação de nível de teste: detecta sessão ausente/vazia
 *   e evita falso negativo (teste passando deslogado ou falhando por motivo
 *   errado). Não altera infra — age apenas dentro dos specs.
 *
 * PROBLEMA QUE RESOLVE
 *   Os arquivos .auth/*.json podem estar vazios ({"cookies":[],"origins":[]})
 *   quando o global-setup não conseguiu fazer login (credenciais não configuradas).
 *   Sem este harness, o teste com storageState vazio roda deslogado, encontra
 *   a tela de /Entrar e falha com "elemento não encontrado" — um falso negativo
 *   que esconde a causa real.
 *
 * USO
 *   Chame requireAuth() logo no início de qualquer describe que usa storageState.
 *   Se a sessão estiver vazia, o teste faz skip com mensagem clara.
 *
 *   import { requireAuth, requireRole } from '../support/auth-harness';
 *
 *   rdTest.describe('minha área', () => {
 *     rdTest.use({ storageState: AUTH_STATE.patient });
 *
 *     rdTest.beforeEach(async ({ page }) => {
 *       await requireAuth(page, 'patient');
 *     });
 *   });
 */

import { type Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const AUTH_DIR = path.join(__dirname, '../.auth');

/**
 * Retorna true se o arquivo de storageState para o role dado contém
 * ao menos um item de localStorage (sessão real), false se vazio.
 */
function hasStoredSession(role: 'patient' | 'professional' | 'admin'): boolean {
  const filePath = path.join(AUTH_DIR, `${role}.json`);
  if (!fs.existsSync(filePath)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const origins: { localStorage?: { name: string }[] }[] = data?.origins ?? [];
    return origins.some((o) => (o.localStorage ?? []).length > 0);
  } catch {
    return false;
  }
}

/**
 * Chame dentro de um beforeEach (ou no início do teste) para qualquer
 * describe que dependa de storageState autenticado.
 *
 * Se a sessão estiver ausente, salta o teste com mensagem descritiva
 * em vez de falhar por motivo errado.
 *
 * Se a sessão existir mas o app ainda assim redirecionar para /Entrar
 * (token expirado, backend reiniciado, etc.), também faz skip.
 */
export async function requireAuth(
  page: Page,
  role: 'patient' | 'professional' | 'admin',
  targetRoute?: string,
) {
  // 1. Verificação estática: arquivo de storageState tem dados?
  if (!hasStoredSession(role)) {
    const envHint: Record<string, string> = {
      patient:      'E2E_PATIENT_EMAIL + E2E_PATIENT_PASSWORD',
      professional: 'E2E_PROFESSIONAL_EMAIL + E2E_PROFESSIONAL_PASSWORD',
      admin:        'E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD',
    };
    // O Playwright não tem skip() fora de test() — lançamos erro com tag especial
    // que o afterEach pode detectar. Na prática, usamos test.skip via annotation.
    throw new Error(
      `[auth-harness] storageState vazio para role="${role}". ` +
      `Configure ${envHint[role]} e rode npx playwright test --config=tests/e2e/playwright.config.ts ` +
      `para que o global-setup gere o storageState. Pulando este teste.`,
    );
  }

  // 2. Verificação dinâmica: se a página atual for /Entrar, o token expirou
  if (targetRoute) {
    const url = page.url();
    if (url.includes('/Entrar')) {
      throw new Error(
        `[auth-harness] Sessão de "${role}" expirou ou foi invalidada. ` +
        `Rode global-setup novamente para renovar o storageState.`,
      );
    }
  }
}

/**
 * Versão simples para beforeEach: faz skip do teste inteiro se o storageState
 * estiver vazio, sem precisar lançar erro.
 * Use em conjunto com test.beforeEach em um describe.
 *
 * Exemplo:
 *   rdTest.beforeEach(async ({}, testInfo) => {
 *     skipIfNoAuth(testInfo, 'patient');
 *   });
 */
export function skipIfNoAuth(
  testInfo: { skip: (condition: boolean, reason: string) => void },
  role: 'patient' | 'professional' | 'admin',
) {
  const has = hasStoredSession(role);
  const envHint: Record<string, string> = {
    patient:      'E2E_PATIENT_EMAIL + E2E_PATIENT_PASSWORD',
    professional: 'E2E_PROFESSIONAL_EMAIL + E2E_PROFESSIONAL_PASSWORD',
    admin:        'E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD',
  };
  testInfo.skip(
    !has,
    `storageState vazio para role="${role}". Configure ${envHint[role]} e rode o global-setup.`,
  );
}

/**
 * Aguarda a página carregar e valida que o usuário está autenticado
 * (não foi redirecionado para /Entrar). Use após goto() em testes autenticados.
 */
export async function assertAuthenticated(page: Page, route: string) {
  // Se a URL contiver /Entrar após a navegação, a sessão foi rejeitada
  const currentUrl = page.url();
  if (currentUrl.includes('/Entrar') || currentUrl.includes('/entrar')) {
    throw new Error(
      `[auth-harness] Esperado "${route}" mas app redirecionou para /Entrar. ` +
      `Sessão ausente ou expirada — storageState precisa ser regenerado.`,
    );
  }
}
