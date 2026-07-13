import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_FRONTEND_VARIABLES = [
  'VITE_APP_ENV',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SITE_URL',
  'VITE_MAPBOX_TOKEN',
  'VITE_ENABLE_PAYMENT_SIMULATION',
];

const REQUIRED_SERVER_VARIABLES = [
  'APP_ENV',
  'APP_BASE_URL',
  'EDGE_ALLOWED_ORIGINS',
  'PAYMENT_PROVIDER',
  'ENABLE_PAYMENT_SIMULATION',
  'PLANS_SERVICE_BASE_URL',
  'PLANS_SERVICE_INTERNAL_API_KEY',
  'PLANS_SERVICE_TIMEOUT_MS',
  'ZOOM_VIDEO_SDK_KEY',
  'ZOOM_VIDEO_SDK_SECRET',
  'ZOOM_WEBHOOK_SECRET_TOKEN',
  'DEEPGRAM_API_KEY',
  'DEEPGRAM_TIMEOUT_MS',
  'GROQ_API_KEY',
  'GROQ_TIMEOUT_MS',
  'GROQ_MAX_TRANSCRIPT_CHARS',
];

const PLATFORM_PROVIDED_SERVER_VARIABLES = new Set([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]);

const REQUIRED_BASE_VARIABLES = [
  ...REQUIRED_FRONTEND_VARIABLES,
  ...REQUIRED_SERVER_VARIABLES,
];

const PRIVATE_VITE_NAME = /(?:SECRET|PRIVATE|SERVICE_ROLE|INTERNAL_API|PASSWORD|ACCESS_TOKEN|WEBHOOK|KEY|TOKEN)/i;
const ALLOWED_PUBLIC_VITE_KEYS = new Set([
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_BACKEND_PUBLISHABLE_KEY',
  'VITE_MAPBOX_TOKEN',
]);
const PLACEHOLDER_VALUE = /(?:\(ADICIONAR|\(CONFIGURAR|\(FORNECIDA|CHANGE_ME|CHANGEME|PLACEHOLDER|YOUR[_-]|EXAMPLE\.INVALID)/i;
const LOCALHOST_VALUE = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i;
const STAGING_HOST_MARKER = /(?:^|[.-])(?:staging|stage|stg|homolog|preview|sandbox|test)(?:[.-]|$)/i;
const PRODUCTION_HOST_MARKER = /(?:^|[.-])(?:prod|production)(?:[.-]|$)/i;
const OPTIONAL_PROJECT_VARIABLES = new Set([
  'MERCADO_PAGO_ACCESS_TOKEN',
  'MERCADO_PAGO_WEBHOOK_SECRET',
  'MERCADO_PAGO_WEBHOOK_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PAYMENT_METHOD_MODE',
  'STRIPE_ENABLE_PIX',
  'STRIPE_PIX_EXPIRES_AFTER_SECONDS',
  'STRIPE_ENABLE_BOLETO',
  'STRIPE_BOLETO_EXPIRES_AFTER_DAYS',
  'PAYMENT_SUCCESS_URL',
  'PAYMENT_FAILURE_URL',
  'PAYMENT_PENDING_URL',
  'PLANS_SERVICE_URL',
  'VITE_BACKEND_FUNCTIONS_URL',
  'VITE_BACKEND_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'ZOOM_SDK_KEY',
  'ZOOM_SDK_SECRET',
]);

function diagnostic(code, variable, message) {
  return { code, variable, message };
}

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function cleanValue(value) {
  return String(value ?? '').trim().replace(/^(['"])(.*)\1$/, '$2');
}

export function parseEnvText(text) {
  const result = {};

  String(text || '').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = trimmed.indexOf('=');
    if (separator < 1) return;
    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
    result[key] = cleanValue(trimmed.slice(separator + 1));
  });

  return result;
}

function parseHttpsUrl(value) {
  try {
    const url = new URL(cleanValue(value));
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function checkFunctionConfig(root, errors) {
  const functionsDir = join(root, 'supabase', 'functions');
  const configPath = join(root, 'supabase', 'config.toml');
  if (!existsSync(functionsDir) || !existsSync(configPath)) {
    errors.push(diagnostic('FUNCTION_CONFIG_UNAVAILABLE', 'supabase/config.toml', 'Configuracao local de Functions ausente.'));
    return;
  }

  const deployable = readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .filter((entry) => existsSync(join(functionsDir, entry.name, 'index.ts')))
    .map((entry) => entry.name);
  const configured = new Set(Array.from(
    readFileSync(configPath, 'utf8').matchAll(/^\[functions\.([^\]]+)\]\s*$/gm),
    (match) => match[1],
  ));
  const missing = deployable.filter((name) => !configured.has(name));
  if (missing.length > 0) {
    errors.push(diagnostic('FUNCTION_CONFIG_MISMATCH', 'supabase/config.toml', `Functions sem bloco: ${missing.join(', ')}`));
  }
}

function checkOperationalGeneratorResidue(root, errors) {
  const files = ['package.json', 'vite.config.ts', 'playwright-fixture.ts', 'index.html'];
  const srcRoot = join(root, 'src');
  const sourceFiles = listFiles(srcRoot)
    .filter((path) => !/[\\/]test[\\/]|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path));

  for (const relativePath of files) {
    const path = join(root, relativePath);
    if (!existsSync(path)) continue;
    if (/lovable|base44/i.test(readFileSync(path, 'utf8'))) {
      errors.push(diagnostic('GENERATOR_RUNTIME_DEPENDENCY', relativePath, 'Referencia operacional a Lovable/Base44.'));
    }
  }

  for (const path of sourceFiles) {
    if (/lovable|base44/i.test(readFileSync(path, 'utf8'))) {
      errors.push(diagnostic('GENERATOR_RUNTIME_DEPENDENCY', path.replace(`${root}\\`, ''), 'Referencia operacional a Lovable/Base44.'));
    }
  }
}

export function evaluateStagingReadiness(input, { root = process.cwd() } = {}) {
  const env = Object.fromEntries(Object.entries(input || {}).map(([key, value]) => [key, cleanValue(value)]));
  const errors = [];
  const warnings = [];

  for (const name of REQUIRED_BASE_VARIABLES) {
    if (!env[name]) errors.push(diagnostic('MISSING_VARIABLE', name, 'Variavel obrigatoria ausente.'));
  }

  for (const [name, value] of Object.entries(env)) {
    const isProjectVariable = REQUIRED_BASE_VARIABLES.includes(name)
      || PLATFORM_PROVIDED_SERVER_VARIABLES.has(name)
      || OPTIONAL_PROJECT_VARIABLES.has(name)
      || name.startsWith('VITE_');
    if (!isProjectVariable) continue;
    if (value && PLACEHOLDER_VALUE.test(value)) {
      errors.push(diagnostic('PLACEHOLDER_VALUE', name, 'Variavel ainda contem placeholder.'));
    }
    if (name.startsWith('VITE_') && PRIVATE_VITE_NAME.test(name) && !ALLOWED_PUBLIC_VITE_KEYS.has(name)) {
      errors.push(diagnostic('PRIVATE_VALUE_IN_FRONTEND', name, 'Nome indica secret privado exposto ao bundle.'));
    }
    if (value && LOCALHOST_VALUE.test(value)) {
      errors.push(diagnostic('LOCALHOST_IN_STAGING', name, 'Referencia local nao permitida em staging.'));
    }
  }

  if (env.APP_ENV !== 'staging') errors.push(diagnostic('APP_ENV_NOT_STAGING', 'APP_ENV', 'Deve ser staging.'));
  if (env.VITE_APP_ENV !== 'staging') errors.push(diagnostic('VITE_APP_ENV_NOT_STAGING', 'VITE_APP_ENV', 'Deve ser staging.'));
  if (env.PAYMENT_PROVIDER?.toLowerCase() === 'mock' || env.PAYMENT_PROVIDER?.toLowerCase() === 'internal_simulated') {
    errors.push(diagnostic('PAYMENT_MOCK_FORBIDDEN', 'PAYMENT_PROVIDER', 'Provider simulado e proibido em staging.'));
  }
  if (env.ENABLE_PAYMENT_SIMULATION !== 'false') {
    errors.push(diagnostic('PAYMENT_SIMULATION_ENABLED', 'ENABLE_PAYMENT_SIMULATION', 'Deve ser false.'));
  }
  if (env.VITE_ENABLE_PAYMENT_SIMULATION !== 'false') {
    errors.push(diagnostic('FRONTEND_PAYMENT_SIMULATION_ENABLED', 'VITE_ENABLE_PAYMENT_SIMULATION', 'Deve ser false.'));
  }

  const provider = env.PAYMENT_PROVIDER?.toLowerCase();
  const providerRequired = provider === 'stripe'
    ? ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
    : provider === 'mercadopago' || provider === 'mercado_pago'
      ? ['MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET']
      : [];
  if (provider && providerRequired.length === 0) {
    errors.push(diagnostic('PAYMENT_PROVIDER_UNSUPPORTED', 'PAYMENT_PROVIDER', 'Use stripe ou mercadopago em staging.'));
  }
  providerRequired.forEach((name) => {
    if (!env[name]) errors.push(diagnostic('MISSING_PROVIDER_SECRET', name, 'Secret obrigatorio para o provider selecionado.'));
  });

  const urlNames = ['VITE_SUPABASE_URL', 'SUPABASE_URL', 'VITE_SITE_URL', 'APP_BASE_URL', 'PLANS_SERVICE_BASE_URL'];
  const parsedUrls = {};
  urlNames.forEach((name) => {
    if (!env[name]) return;
    const parsed = parseHttpsUrl(env[name]);
    if (!parsed) errors.push(diagnostic('INVALID_STAGING_URL', name, 'URL HTTPS valida obrigatoria.'));
    else parsedUrls[name] = parsed;
  });

  const allowedOrigins = String(env.EDGE_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (allowedOrigins.length !== 1) {
    errors.push(diagnostic('CORS_CANONICAL_ORIGIN_REQUIRED', 'EDGE_ALLOWED_ORIGINS', 'Configure exatamente uma origem canonica no staging.'));
  } else {
    const allowedUrl = parseHttpsUrl(allowedOrigins[0]);
    if (!allowedUrl || allowedUrl.origin !== allowedOrigins[0].replace(/\/+$/, '')) {
      errors.push(diagnostic('INVALID_CORS_ORIGIN', 'EDGE_ALLOWED_ORIGINS', 'Informe somente uma origem HTTPS, sem path.'));
    } else if (parsedUrls.VITE_SITE_URL && allowedUrl.origin !== parsedUrls.VITE_SITE_URL.origin) {
      errors.push(diagnostic('CORS_SITE_MISMATCH', 'EDGE_ALLOWED_ORIGINS', 'Origem deve corresponder a VITE_SITE_URL.'));
    }
  }

  if (parsedUrls.APP_BASE_URL && parsedUrls.VITE_SITE_URL && parsedUrls.APP_BASE_URL.origin !== parsedUrls.VITE_SITE_URL.origin) {
    errors.push(diagnostic('APP_BASE_URL_MISMATCH', 'APP_BASE_URL', 'Deve corresponder ao frontend de staging.'));
  }
  for (const name of ['VITE_SITE_URL', 'APP_BASE_URL']) {
    const hostname = parsedUrls[name]?.hostname || '';
    if (PRODUCTION_HOST_MARKER.test(hostname)) {
      errors.push(diagnostic('PRODUCTION_ENDPOINT_IN_STAGING', name, 'Hostname indica ambiente de producao.'));
    } else if (hostname && !STAGING_HOST_MARKER.test(hostname)) {
      warnings.push(diagnostic('STAGING_ENDPOINT_REVIEW', name, 'Confirme manualmente que o dominio e exclusivo de staging.'));
    }
  }
  if (parsedUrls.PLANS_SERVICE_BASE_URL?.hostname && PRODUCTION_HOST_MARKER.test(parsedUrls.PLANS_SERVICE_BASE_URL.hostname)) {
    errors.push(diagnostic('PRODUCTION_ENDPOINT_IN_STAGING', 'PLANS_SERVICE_BASE_URL', 'Hostname indica ambiente de producao.'));
  } else if (parsedUrls.PLANS_SERVICE_BASE_URL?.hostname && !STAGING_HOST_MARKER.test(parsedUrls.PLANS_SERVICE_BASE_URL.hostname)) {
    warnings.push(diagnostic('STAGING_ENDPOINT_REVIEW', 'PLANS_SERVICE_BASE_URL', 'Confirme manualmente que a URL nao aponta para producao.'));
  }

  const timeout = Number(env.PLANS_SERVICE_TIMEOUT_MS);
  if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 30000) {
    errors.push(diagnostic('INVALID_PLANS_TIMEOUT', 'PLANS_SERVICE_TIMEOUT_MS', 'Use valor entre 1000 e 30000 ms.'));
  }

  for (const name of ['DEEPGRAM_TIMEOUT_MS', 'GROQ_TIMEOUT_MS', 'GROQ_MAX_TRANSCRIPT_CHARS']) {
    const value = Number(env[name]);
    if (!Number.isInteger(value) || value <= 0) {
      errors.push(diagnostic('INVALID_NUMERIC_LIMIT', name, 'Configure um inteiro positivo.'));
    }
  }

  if (env.PLANS_SERVICE_URL) warnings.push(diagnostic('DEPRECATED_ALIAS', 'PLANS_SERVICE_URL', 'Use PLANS_SERVICE_BASE_URL.'));
  if (env.VITE_BACKEND_FUNCTIONS_URL) warnings.push(diagnostic('DEPRECATED_ALIAS', 'VITE_BACKEND_FUNCTIONS_URL', 'Use VITE_SUPABASE_URL.'));
  if (env.VITE_BACKEND_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    warnings.push(diagnostic('DEPRECATED_ALIAS', 'VITE_SUPABASE_ANON_KEY', 'Use somente o nome canonico VITE_SUPABASE_ANON_KEY.'));
  }
  if (env.ZOOM_SDK_KEY || env.ZOOM_SDK_SECRET) {
    warnings.push(diagnostic('DEPRECATED_ALIAS', 'ZOOM_VIDEO_SDK_KEY', 'Use os nomes ZOOM_VIDEO_SDK_KEY e ZOOM_VIDEO_SDK_SECRET.'));
  }

  checkFunctionConfig(root, errors);
  checkOperationalGeneratorResidue(root, errors);

  return { errors, warnings };
}

function parseArguments(argv) {
  const result = {
    envFile: null,
    frontendFile: '.env.staging',
    secretsFile: '.env.staging.secrets',
    linked: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--config') result.envFile = argv[index + 1] || result.envFile;
    if (argv[index] === '--frontend') result.frontendFile = argv[index + 1] || result.frontendFile;
    if (argv[index] === '--secrets') result.secretsFile = argv[index + 1] || result.secretsFile;
    if (argv[index] === '--linked') result.linked = true;
  }
  return result;
}

function loadEnvFile(root, relativePath, missingCode, warnings) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) {
    warnings.push(diagnostic(missingCode, relativePath, 'Arquivo nao encontrado; usando variaveis do processo quando existirem.'));
    return {};
  }
  return parseEnvText(readFileSync(path, 'utf8'));
}

function validateSplitFileScopes(frontendEnv, secretsEnv, errors) {
  for (const name of Object.keys(frontendEnv)) {
    if (!name.startsWith('VITE_')) {
      errors.push(diagnostic('SERVER_VARIABLE_IN_FRONTEND_FILE', name, 'Arquivo publico de staging deve conter somente VITE_*.'));
    }
  }
  for (const name of Object.keys(secretsEnv)) {
    if (name.startsWith('VITE_')) {
      errors.push(diagnostic('FRONTEND_VARIABLE_IN_SECRETS_FILE', name, 'Arquivo de secrets server-side nao deve conter variaveis VITE_*.'));
    }
  }
}

function runLinkedMigrationCheck() {
  const result = spawnSync('npx', ['supabase', 'db', 'push', '--linked', '--dry-run'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'pipe',
  });
  return result.status === 0;
}

export function runCli(argv = process.argv.slice(2), processEnv = process.env) {
  const options = parseArguments(argv);
  const root = process.cwd();
  const startupWarnings = [];
  const startupErrors = [];
  let fileEnv = {};

  if (options.envFile) {
    fileEnv = loadEnvFile(root, options.envFile, 'ENV_FILE_NOT_FOUND', startupWarnings);
  } else {
    const frontendEnv = loadEnvFile(root, options.frontendFile, 'FRONTEND_ENV_FILE_NOT_FOUND', startupWarnings);
    const secretsEnv = loadEnvFile(root, options.secretsFile, 'SECRETS_ENV_FILE_NOT_FOUND', startupWarnings);
    validateSplitFileScopes(frontendEnv, secretsEnv, startupErrors);
    fileEnv = { ...frontendEnv, ...secretsEnv };
  }

  const env = { ...fileEnv, ...processEnv };
  const result = evaluateStagingReadiness(env, { root });
  result.errors.unshift(...startupErrors);
  result.warnings.unshift(...startupWarnings);
  if (options.linked && result.errors.length === 0 && !runLinkedMigrationCheck()) {
    result.errors.push(diagnostic('LINKED_MIGRATION_CHECK_FAILED', 'supabase migrations', 'Dry-run vinculado falhou ou encontrou bloqueio.'));
  } else if (options.linked && result.errors.length > 0) {
    result.warnings.push(diagnostic('LINKED_MIGRATION_CHECK_SKIPPED', 'supabase migrations', 'Corrija os erros locais antes do dry-run vinculado.'));
  } else if (!options.linked) {
    result.warnings.push(diagnostic('LINKED_MIGRATION_CHECK_SKIPPED', 'supabase migrations', 'Execute novamente com --linked antes do deploy.'));
  }

  result.errors.forEach((item) => console.error(`ERROR [${item.code}] ${item.variable}`));
  result.warnings.forEach((item) => console.warn(`WARN [${item.code}] ${item.variable}`));
  console.log(`Staging readiness: ${result.errors.length} error(s), ${result.warnings.length} warning(s).`);
  return result.errors.length === 0 ? 0 : 1;
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMainModule) process.exitCode = runCli();
