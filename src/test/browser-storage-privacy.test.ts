import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BROWSER_PRIVACY_PREFERENCES_KEY,
  BROWSER_STORAGE_INVENTORY,
  DEFAULT_BROWSER_PRIVACY_PREFERENCES,
  isBrowserTechnologyAllowed,
  readBrowserPrivacyPreferences,
  saveBrowserPrivacyPreferences,
} from '@/config/browser-storage';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('canonical browser storage inventory', () => {
  beforeEach(() => window.localStorage.clear());

  it('matches confirmed application keys and contains no invented cookie', () => {
    const keys = BROWSER_STORAGE_INVENTORY.map((item) => item.key);
    expect(keys).toEqual(expect.arrayContaining([
      'rd.auth.session.v1',
      'rd.auth.recovery.v1',
      'rapido-doutor-theme',
      'rd.payment.return_context.v1',
      'rd.laudosMedicos.wizard',
      'mapbox.eventData*',
    ]));
    expect(BROWSER_STORAGE_INVENTORY.some((item) => item.type === 'cookie')).toBe(false);
    expect(read('src/client-api/session.js')).toContain("'rd.auth.session.v1'");
    expect(read('src/integrations/supabase/recoveryClient.ts')).toContain("'rd.auth.recovery.v1'");
    expect(read('src/App.tsx')).toContain('storageKey="rapido-doutor-theme"');
    expect(read('src/components/ui/sidebar.tsx')).not.toContain('document.cookie');
  });

  it('confirms there is no direct analytics, marketing or external script in index', () => {
    const index = read('index.html');
    const source = [index, read('src/main.tsx'), read('src/App.tsx')].join('\n');
    expect(index.match(/<script/g)).toHaveLength(1);
    expect(index).toContain('src="/src/main.tsx"');
    expect(source).not.toMatch(/googletagmanager|gtag\(|GTM-|fbq\(|hotjar|clarity\(|meta pixel|sentry/i);
  });
});

describe('local privacy preferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('fails safely for invalid JSON and keeps optional categories disabled', () => {
    window.localStorage.setItem(BROWSER_PRIVACY_PREFERENCES_KEY, '{invalid');
    expect(readBrowserPrivacyPreferences()).toEqual(DEFAULT_BROWSER_PRIVACY_PREFERENCES);
    expect(readBrowserPrivacyPreferences().necessary).toBe(true);
    expect(readBrowserPrivacyPreferences().preferences).toBe(false);
    expect(readBrowserPrivacyPreferences().analytics).toBe(false);
    expect(readBrowserPrivacyPreferences().marketing).toBe(false);
  });

  it('does not accept stale versions as consent', () => {
    window.localStorage.setItem(BROWSER_PRIVACY_PREFERENCES_KEY, JSON.stringify({
      version: '0.9.0', necessary: true, preferences: true, choiceMade: true,
    }));
    expect(readBrowserPrivacyPreferences()).toEqual(DEFAULT_BROWSER_PRIVACY_PREFERENCES);
  });

  it('allows Mapbox only after an explicit choice', () => {
    expect(isBrowserTechnologyAllowed('mapbox')).toBe(false);
    const accepted = saveBrowserPrivacyPreferences({ preferences: true });
    expect(accepted.necessary).toBe(true);
    expect(accepted.analytics).toBe(false);
    expect(accepted.marketing).toBe(false);
    expect(isBrowserTechnologyAllowed('mapbox', accepted)).toBe(true);
  });

  it('revokes Mapbox storage without clearing session or theme', () => {
    window.localStorage.setItem('rd.auth.session.v1', 'session-must-remain');
    window.localStorage.setItem('rapido-doutor-theme', 'dark');
    window.localStorage.setItem('mapbox.eventData.uuid:test', 'optional');
    saveBrowserPrivacyPreferences({ preferences: false });
    expect(window.localStorage.getItem('mapbox.eventData.uuid:test')).toBeNull();
    expect(window.localStorage.getItem('rd.auth.session.v1')).toBe('session-must-remain');
    expect(window.localStorage.getItem('rapido-doutor-theme')).toBe('dark');
  });

  it('stores no identity, token or medical content in the preference record', () => {
    saveBrowserPrivacyPreferences({ preferences: true });
    const stored = window.localStorage.getItem(BROWSER_PRIVACY_PREFERENCES_KEY) || '';
    expect(stored).not.toMatch(/user|email|token|prontuario|diagnostico|patient/i);
  });
});

describe('optional technology guard', () => {
  it('keeps Mapbox behind a dynamic import and explicit authorization', () => {
    const map = read('src/components/map/MapboxMap.tsx');
    expect(map).toContain("isTechnologyAllowed('mapbox')");
    expect(map).toContain("await import('mapbox-gl')");
    expect(map).not.toContain("import mapboxgl from 'mapbox-gl'");
    expect(map.indexOf("if (!canRenderMap) return")).toBeLessThan(map.indexOf("await import('mapbox-gl')"));
  });
});
