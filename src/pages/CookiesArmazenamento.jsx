import React from 'react';
import { useTheme } from 'next-themes';
import LegalPageLayout, { LegalEmail, LegalSection } from '@/components/legal/LegalPageLayout';
import { Button } from '@/components/ui/button';
import { useBrowserPrivacy } from '@/components/privacy/BrowserPrivacyContext';
import { legalConfig } from '@/config/legal';
import {
  BROWSER_STORAGE_INVENTORY,
  BROWSER_STORAGE_NOTICE,
  BROWSER_TECHNOLOGIES,
} from '@/config/browser-storage';

const sections = [
  { id: 'diferencas', title: 'Cookies e armazenamento local' },
  { id: 'inventario', title: 'Tecnologias utilizadas' },
  { id: 'terceiros', title: 'Servicos externos' },
  { id: 'preferencias', title: 'Como alterar preferencias' },
  { id: 'contato', title: 'Contato' },
];

const categoryLabels = {
  necessary: 'Estritamente necessario',
  preferences: 'Preferencia',
  analytics: 'Analytics',
  marketing: 'Marketing',
};

export default function CookiesArmazenamento() {
  const { openSettings } = useBrowserPrivacy();
  const { setTheme } = useTheme();

  return (
    <LegalPageLayout
      pageTitle="Cookies e armazenamento"
      metaTitle="Cookies e armazenamento | Rapido Doutor"
      metaDescription="Inventario das tecnologias armazenadas pelo Rapido Doutor no navegador."
      intro="Esta pagina descreve o que o sistema realmente armazena no navegador e diferencia recursos necessarios de tecnologias opcionais."
      version={BROWSER_STORAGE_NOTICE.version}
      effectiveDate={BROWSER_STORAGE_NOTICE.effectiveDate}
      lastUpdated={BROWSER_STORAGE_NOTICE.lastUpdated}
      contactChannel={legalConfig.privacyEmail}
      sections={sections}
      currentRoute={BROWSER_STORAGE_NOTICE.route}
    >
      <LegalSection id="diferencas" title="Cookies e armazenamento local">
        <p>Cookies sao pequenos registros enviados ou lidos junto ao navegador. O codigo ativo do Rapido Doutor nao define cookie proprio neste momento.</p>
        <p>O sistema utiliza <code>localStorage</code> para sessao, recuperacao de senha, tema e a escolha sobre tecnologias opcionais. Tambem utiliza <code>sessionStorage</code> para estados temporarios da aba, como retorno de pagamento e retomada de consulta.</p>
        <p>Nao foram encontrados IndexedDB, Service Worker, analytics ou marketing ativos.</p>
      </LegalSection>

      <LegalSection id="inventario" title="Tecnologias utilizadas">
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/60 text-foreground"><tr><th className="p-3">Chave</th><th className="p-3">Tipo</th><th className="p-3">Categoria</th><th className="p-3">Finalidade e duracao</th></tr></thead>
            <tbody className="divide-y divide-border">
              {BROWSER_STORAGE_INVENTORY.map((item) => (
                <tr key={`${item.type}:${item.key}`}>
                  <td className="p-3 font-mono text-xs text-foreground">{item.key}</td>
                  <td className="p-3">{item.type}</td>
                  <td className="p-3">{categoryLabels[item.category]}</td>
                  <td className="p-3"><p>{item.purpose}</p><p className="mt-1 text-xs">{item.duration}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="terceiros" title="Servicos externos">
        <ul className="space-y-3">
          {BROWSER_TECHNOLOGIES.map((technology) => (
            <li key={technology.id}><strong className="text-foreground">{technology.label}:</strong> {technology.note || 'Utilizado no fluxo indicado pelo produto.'}</li>
          ))}
        </ul>
        <p>Deepgram, Groq e API de planos nao sao classificados como cookies locais quando operam por Edge Functions. Deepgram no navegador depende do consentimento especifico de transcricao.</p>
      </LegalSection>

      <LegalSection id="preferencias" title="Como alterar preferencias">
        <p>Rejeitar opcionais nao encerra a sessao, nao apaga o tema e nao remove estados necessarios de consulta ou pagamento. O mapa deixa de carregar e as chaves conhecidas do Mapbox sao removidas.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={openSettings}>Configurar armazenamento opcional</Button>
          <Button type="button" variant="outline" onClick={() => setTheme('system')}>Usar tema do sistema</Button>
        </div>
      </LegalSection>

      <LegalSection id="contato" title="Contato">
        <p>Contato de privacidade: <LegalEmail value={legalConfig.privacyEmail} />.</p>
        <p>{legalConfig.legalName} | CNPJ: {legalConfig.cnpj} | Endereco: {legalConfig.companyAddress}.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
