import { type Page, type Route } from '@playwright/test';

export type MockRole = 'patient' | 'professional' | 'admin';

type MockAppUser = {
  id: string;
  full_name: string;
  email: string;
  role: MockRole;
  is_active?: boolean;
};

const DEFAULT_USERS: Record<MockRole, MockAppUser> = {
  patient: {
    id: 'patient-app-user-e2e',
    full_name: 'Wesley Paciente Teste',
    email: 'paciente-e2e@rapidodoutor.test',
    role: 'patient',
    is_active: true,
  },
  professional: {
    id: 'professional-app-user-e2e',
    full_name: 'Dr. Profissional E2E',
    email: 'profissional-e2e@rapidodoutor.test',
    role: 'professional',
    is_active: true,
  },
  admin: {
    id: 'admin-app-user-e2e',
    full_name: 'Admin E2E',
    email: 'admin-e2e@rapidodoutor.test',
    role: 'admin',
    is_active: true,
  },
};

export function edgeOk(data: unknown) {
  return {
    data,
    meta: {
      requestId: 'e2e-request',
    },
  };
}

export function edgeError(code: string, message: string, details: unknown = null) {
  return {
    error: {
      code,
      message,
      details,
      requestId: 'e2e-request',
    },
  };
}

export async function fulfillJson(route: Route, status: number, payload: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

export async function installMockSession(page: Page, role: MockRole) {
  await page.addInitScript((currentRole) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    window.localStorage.setItem('rd.auth.session.v1', JSON.stringify({
      accessToken: `e2e-${currentRole}-access-token`,
      refreshToken: `e2e-${currentRole}-refresh-token`,
      expiresAt: nowSeconds + 60 * 60,
      expiresIn: 60 * 60,
      tokenType: 'bearer',
    }));
  }, role);
}

export async function mockBootstrapAppUser(
  page: Page,
  roleOrResolver: MockRole | (() => MockRole),
  overrides: Partial<MockAppUser> = {},
) {
  await page.route('**/functions/v1/bootstrap-app-user', async (route) => {
    const role = typeof roleOrResolver === 'function' ? roleOrResolver() : roleOrResolver;
    await fulfillJson(route, 200, edgeOk({
      appUser: {
        ...DEFAULT_USERS[role],
        ...overrides,
        role,
      },
    }));
  });
}

export async function mockNoActiveConsultation(page: Page) {
  await page.route('**/functions/v1/get-my-active-consultation', async (route) => {
    await fulfillJson(route, 200, edgeOk({
      hasActiveConsultation: false,
      consultation: null,
      participantRole: null,
      resumeUrl: null,
      roomReady: false,
      needsProfessionalStart: false,
      counterpartName: null,
    }));
  });
}

export async function mockAuthForRole(
  page: Page,
  role: MockRole | (() => MockRole),
  overrides: Partial<MockAppUser> = {},
) {
  const initialRole = typeof role === 'function' ? role() : role;
  await installMockSession(page, initialRole);
  await mockBootstrapAppUser(page, role, overrides);
  await mockNoActiveConsultation(page);
}

