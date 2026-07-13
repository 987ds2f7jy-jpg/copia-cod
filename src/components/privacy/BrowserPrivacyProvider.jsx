import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ACTIVE_OPTIONAL_CATEGORIES,
  BROWSER_STORAGE_NOTICE,
  DEFAULT_BROWSER_PRIVACY_PREFERENCES,
  isBrowserTechnologyAllowed,
  readBrowserPrivacyPreferences,
  saveBrowserPrivacyPreferences,
  subscribeToBrowserPrivacyPreferences,
} from '@/config/browser-storage';
import { BrowserPrivacyContext, useBrowserPrivacy } from '@/components/privacy/BrowserPrivacyContext';

export function BrowserPrivacyProvider({ children }) {
  const [preferences, setPreferences] = useState(DEFAULT_BROWSER_PRIVACY_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setPreferences(readBrowserPrivacyPreferences());
    setReady(true);
    return subscribeToBrowserPrivacyPreferences(setPreferences);
  }, []);

  const value = useMemo(() => ({
    preferences,
    ready,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    isTechnologyAllowed: (id) => isBrowserTechnologyAllowed(id, preferences),
    save: (next) => setPreferences(saveBrowserPrivacyPreferences(next)),
  }), [preferences, ready]);

  const showNotice = ready && ACTIVE_OPTIONAL_CATEGORIES.length > 0 && !preferences.choiceMade;

  return (
    <BrowserPrivacyContext.Provider value={value}>
      {children}
      {showNotice ? <BrowserPrivacyNotice /> : null}
      <BrowserPrivacySettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </BrowserPrivacyContext.Provider>
  );
}

function BrowserPrivacyNotice() {
  const { save, openSettings } = useBrowserPrivacy();
  return (
    <aside className="fixed inset-x-3 bottom-20 z-[70] mx-auto max-w-3xl border border-border bg-background p-4 shadow-xl sm:bottom-5 sm:p-5 dark:bg-gray-950" aria-label="Preferencias de cookies e armazenamento">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Cookies e armazenamento no navegador</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Usamos armazenamento necessario para sessao e fluxos do atendimento. O mapa Mapbox e opcional e permanece bloqueado ate sua escolha.
            {' '}<Link className="underline underline-offset-2" to={BROWSER_STORAGE_NOTICE.route}>Ver detalhes</Link>.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Button type="button" variant="outline" onClick={() => save({ preferences: true })}>Aceitar opcionais</Button>
            <Button type="button" variant="outline" onClick={() => save({ preferences: false })}>Rejeitar opcionais</Button>
            <Button type="button" variant="outline" onClick={openSettings}>
              <Settings2 className="mr-2 h-4 w-4" /> Configurar
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function BrowserPrivacySettings({ open, onOpenChange }) {
  const { preferences, save } = useBrowserPrivacy();
  const [mapEnabled, setMapEnabled] = useState(false);

  useEffect(() => {
    if (open) setMapEnabled(preferences.preferences === true);
  }, [open, preferences.preferences]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preferencias de armazenamento</DialogTitle>
          <DialogDescription>Necessarios permanecem ativos. Nenhuma ferramenta de analytics ou marketing esta habilitada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div><Label htmlFor="necessary-storage">Estritamente necessarios</Label><p className="text-xs text-muted-foreground">Sessao, seguranca e continuidade dos fluxos.</p></div>
            <Switch id="necessary-storage" checked disabled aria-label="Armazenamento estritamente necessario sempre ativo" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><Label htmlFor="optional-maps">Mapa opcional</Label><p className="text-xs text-muted-foreground">Permite carregar Mapbox em perfis e enderecos profissionais.</p></div>
            <Switch id="optional-maps" checked={mapEnabled} onCheckedChange={setMapEnabled} />
          </div>
        </div>
        <DialogFooter className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => { save({ preferences: false }); onOpenChange(false); }}>Rejeitar opcionais</Button>
          <Button type="button" variant="outline" onClick={() => { save({ preferences: mapEnabled }); onOpenChange(false); }}>Salvar preferencias</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
