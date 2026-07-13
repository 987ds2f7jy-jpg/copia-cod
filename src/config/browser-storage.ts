export type BrowserStorageCategory = 'necessary' | 'preferences' | 'analytics' | 'marketing';
export type BrowserStorageType = 'cookie' | 'localStorage' | 'sessionStorage' | 'IndexedDB';

export const BROWSER_PRIVACY_PREFERENCES_VERSION = '1.0.0';
export const BROWSER_PRIVACY_PREFERENCES_KEY = 'rapido_doutor_privacy_preferences_v1';
export const BROWSER_STORAGE_NOTICE = {
  version: '1.0.0',
  effectiveDate: '12/07/2026',
  lastUpdated: '12/07/2026',
  route: '/cookies-e-armazenamento',
} as const;

export const BROWSER_STORAGE_INVENTORY = [
  {
    key: 'rd.auth.session.v1',
    type: 'localStorage',
    category: 'necessary',
    purpose: 'Manter a sessao autenticada e permitir renovacao segura.',
    origin: 'Rapido Doutor / Supabase Auth',
    duration: 'Ate logout, desativacao ou invalidacao da sessao.',
    required: true,
    requiresConsent: false,
    containsPersonalData: true,
    flow: 'Login e areas autenticadas.',
  },
  {
    key: 'rd.auth.recovery.v1',
    type: 'localStorage',
    category: 'necessary',
    purpose: 'Concluir recuperacao de senha no mesmo projeto Supabase.',
    origin: 'Rapido Doutor / Supabase Auth',
    duration: 'Durante o fluxo de recuperacao, ate logout ou expiracao.',
    required: true,
    requiresConsent: false,
    containsPersonalData: true,
    flow: 'Recuperacao de senha.',
  },
  {
    key: 'rapido-doutor-theme',
    type: 'localStorage',
    category: 'preferences',
    purpose: 'Lembrar tema claro, escuro ou do sistema neste navegador.',
    origin: 'Rapido Doutor',
    duration: 'Ate alteracao ou limpeza pelo usuario.',
    required: false,
    requiresConsent: false,
    containsPersonalData: false,
    flow: 'Aparencia da interface.',
  },
  {
    key: BROWSER_PRIVACY_PREFERENCES_KEY,
    type: 'localStorage',
    category: 'necessary',
    purpose: 'Registrar localmente a escolha sobre tecnologias opcionais.',
    origin: 'Rapido Doutor',
    duration: 'Ate mudanca da versao ou limpeza pelo usuario.',
    required: true,
    requiresConsent: false,
    containsPersonalData: false,
    flow: 'Aviso e preferencias de armazenamento.',
  },
  {
    key: 'mapbox.eventData*',
    type: 'localStorage',
    category: 'preferences',
    purpose: 'Identificador e eventos tecnicos gerados pelo SDK ao exibir mapas.',
    origin: 'Mapbox GL JS',
    duration: 'Ate limpeza; o identificador tecnico e renovado periodicamente pelo SDK.',
    required: false,
    requiresConsent: true,
    containsPersonalData: true,
    flow: 'Mapa do perfil e local de atendimento profissional.',
  },
  {
    key: 'rd_login_next',
    type: 'sessionStorage',
    category: 'necessary',
    purpose: 'Retornar o usuario ao fluxo solicitado depois do login.',
    origin: 'Rapido Doutor',
    duration: 'Ate uso ou fechamento da aba.',
    required: true,
    requiresConsent: false,
    containsPersonalData: false,
    flow: 'Login e navegacao protegida.',
  },
  {
    key: 'rd_last_active_consultation',
    type: 'sessionStorage',
    category: 'necessary',
    purpose: 'Retomar a consulta ativa na mesma aba.',
    origin: 'Rapido Doutor',
    duration: 'Durante a sessao da aba ou ate finalizar a consulta.',
    required: true,
    requiresConsent: false,
    containsPersonalData: true,
    flow: 'Teleconsulta.',
  },
  {
    key: 'rd_consulta_agora_auto_resume',
    type: 'sessionStorage',
    category: 'necessary',
    purpose: 'Retomar de forma limitada o fluxo de Consulta Agora.',
    origin: 'Rapido Doutor',
    duration: 'Ate duas horas, conclusao do fluxo ou fechamento da aba.',
    required: true,
    requiresConsent: false,
    containsPersonalData: true,
    flow: 'Consulta Agora.',
  },
  {
    key: 'rd.payment.return_context.v1',
    type: 'sessionStorage',
    category: 'necessary',
    purpose: 'Relacionar o retorno do gateway a cobranca interna correta.',
    origin: 'Rapido Doutor',
    duration: 'Ate validar o retorno ou fechar a aba.',
    required: true,
    requiresConsent: false,
    containsPersonalData: true,
    flow: 'Checkout e retorno de pagamento.',
  },
  {
    key: 'rd.solicitacaoExames.plantao',
    type: 'sessionStorage',
    category: 'necessary',
    purpose: 'Preservar a transicao de uma solicitacao de exame para o plantao.',
    origin: 'Rapido Doutor',
    duration: 'Ate concluir o redirecionamento ou fechar a aba.',
    required: true,
    requiresConsent: false,
    containsPersonalData: true,
    flow: 'Servicos extras e plantao.',
  },
  {
    key: 'rd.laudosMedicos.wizard',
    type: 'sessionStorage',
    category: 'necessary',
    purpose: 'Manter temporariamente as etapas do pedido de laudo na mesma aba.',
    origin: 'Rapido Doutor',
    duration: 'Ate enviar, cancelar ou fechar a aba.',
    required: true,
    requiresConsent: false,
    containsPersonalData: true,
    flow: 'Solicitacao de laudo medico.',
  },
] as const satisfies ReadonlyArray<{
  key: string;
  type: BrowserStorageType;
  category: BrowserStorageCategory;
  purpose: string;
  origin: string;
  duration: string;
  required: boolean;
  requiresConsent: boolean;
  containsPersonalData: boolean;
  flow: string;
}>;

export const BROWSER_TECHNOLOGIES = [
  { id: 'supabase_auth', label: 'Supabase Auth', location: 'browser', category: 'necessary', requiresConsent: false, storageKeys: ['rd.auth.session.v1', 'rd.auth.recovery.v1'] },
  { id: 'zoom_video_sdk', label: 'Zoom Video SDK', location: 'browser', category: 'necessary', requiresConsent: false, storageKeys: [], note: 'Carregado apenas na teleconsulta autorizada.' },
  { id: 'mapbox', label: 'Mapbox GL JS', location: 'browser', category: 'preferences', requiresConsent: true, storageKeys: ['mapbox.eventData*'], note: 'Bloqueado ate autorizacao de tecnologias opcionais.' },
  { id: 'deepgram', label: 'Deepgram', location: 'browser_and_backend', category: 'necessary', requiresConsent: false, storageKeys: [], note: 'Usado apenas apos consentimento especifico de transcricao; nao integra esta preferencia.' },
  { id: 'groq', label: 'Groq', location: 'backend', category: 'necessary', requiresConsent: false, storageKeys: [], note: 'Somente Edge Function; nao cria armazenamento local.' },
  { id: 'plans_service', label: 'API de planos', location: 'backend', category: 'necessary', requiresConsent: false, storageKeys: [], note: 'Somente backend; nao cria armazenamento local.' },
  { id: 'stripe', label: 'Stripe', location: 'redirect', category: 'necessary', requiresConsent: false, storageKeys: [], note: 'Sem SDK no React; o dominio do gateway pode aplicar tecnologias proprias durante o checkout.' },
  { id: 'mercado_pago', label: 'Mercado Pago', location: 'redirect', category: 'necessary', requiresConsent: false, storageKeys: [], note: 'Sem SDK no React; o dominio do gateway pode aplicar tecnologias proprias durante o checkout.' },
] as const;

export const ACTIVE_OPTIONAL_CATEGORIES: BrowserStorageCategory[] = ['preferences'];
export const ACTIVE_OPTIONAL_TECHNOLOGIES = ['mapbox'] as const;

export type BrowserPrivacyPreferences = {
  version: typeof BROWSER_PRIVACY_PREFERENCES_VERSION;
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  choiceMade: boolean;
  updatedAt: string | null;
};

export const DEFAULT_BROWSER_PRIVACY_PREFERENCES: BrowserPrivacyPreferences = {
  version: BROWSER_PRIVACY_PREFERENCES_VERSION,
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
  choiceMade: false,
  updatedAt: null,
};

const PREFERENCES_EVENT = 'rapido-doutor:privacy-preferences-changed';

function isStoredPreferences(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function readBrowserPrivacyPreferences(): BrowserPrivacyPreferences {
  if (typeof window === 'undefined') return DEFAULT_BROWSER_PRIVACY_PREFERENCES;
  const raw = window.localStorage.getItem(BROWSER_PRIVACY_PREFERENCES_KEY);
  if (!raw) return DEFAULT_BROWSER_PRIVACY_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredPreferences(parsed) || parsed.version !== BROWSER_PRIVACY_PREFERENCES_VERSION) {
      return DEFAULT_BROWSER_PRIVACY_PREFERENCES;
    }
    return {
      version: BROWSER_PRIVACY_PREFERENCES_VERSION,
      necessary: true,
      preferences: parsed.preferences === true,
      analytics: false,
      marketing: false,
      choiceMade: parsed.choiceMade === true,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return DEFAULT_BROWSER_PRIVACY_PREFERENCES;
  }
}

function clearMapboxStorage() {
  if (typeof window === 'undefined') return;
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith('mapbox.eventData')) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
}

export function saveBrowserPrivacyPreferences(input: Partial<BrowserPrivacyPreferences>) {
  const normalized: BrowserPrivacyPreferences = {
    version: BROWSER_PRIVACY_PREFERENCES_VERSION,
    necessary: true,
    preferences: input.preferences === true,
    analytics: false,
    marketing: false,
    choiceMade: true,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(BROWSER_PRIVACY_PREFERENCES_KEY, JSON.stringify(normalized));
    if (!normalized.preferences) clearMapboxStorage();
    window.dispatchEvent(new CustomEvent(PREFERENCES_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function isBrowserTechnologyAllowed(technologyId: string, preferences = readBrowserPrivacyPreferences()) {
  const technology = BROWSER_TECHNOLOGIES.find((item) => item.id === technologyId);
  if (!technology) return false;
  if (!technology.requiresConsent) return true;
  return preferences.choiceMade && preferences[technology.category] === true;
}

export function subscribeToBrowserPrivacyPreferences(listener: (preferences: BrowserPrivacyPreferences) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handleChange = () => listener(readBrowserPrivacyPreferences());
  window.addEventListener(PREFERENCES_EVENT, handleChange);
  window.addEventListener('storage', handleChange);
  return () => {
    window.removeEventListener(PREFERENCES_EVENT, handleChange);
    window.removeEventListener('storage', handleChange);
  };
}
