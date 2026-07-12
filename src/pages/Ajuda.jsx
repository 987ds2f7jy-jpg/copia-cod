import React from 'react';
import LegalPageLayout, { LegalSection } from '@/components/legal/LegalPageLayout';
import { legalConfig, legalRoutes } from '@/config/legal';

const SECTIONS = [
  { id: 'primeiros-passos', title: 'Primeiros passos' },
  { id: 'consultas', title: 'Consultas' },
  { id: 'telemedicina', title: 'Telemedicina' },
  { id: 'pagamentos', title: 'Pagamentos' },
  { id: 'documentos', title: 'Receitas, exames e laudos' },
  { id: 'privacidade-seguranca', title: 'Privacidade e segurança' },
  { id: 'profissionais', title: 'Profissionais de saúde' },
  { id: 'contato', title: 'Contato' },
];

const EM_BREVE = 'Conteúdo desta seção será publicado em breve.';

export default function Ajuda() {
  return (
    <LegalPageLayout
      pageTitle="Central de Ajuda"
      metaTitle="Central de Ajuda | Rápido Doutor"
      metaDescription="Informações sobre consultas, telemedicina, pagamentos, privacidade e uso do Rápido Doutor."
      intro="Encontre informações sobre consultas, telemedicina, pagamentos, documentos de saúde, privacidade e uso da plataforma Rápido Doutor."
      version={legalConfig.helpVersion}
      lastUpdated={legalConfig.lastUpdated}
      sections={SECTIONS}
      currentRoute={legalRoutes.ajuda}
    >
      <LegalSection id="primeiros-passos" title="Primeiros passos">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="consultas" title="Consultas">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="telemedicina" title="Telemedicina">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="pagamentos" title="Pagamentos">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="documentos" title="Receitas, exames e laudos">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="privacidade-seguranca" title="Privacidade e segurança">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="profissionais" title="Profissionais de saúde">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="contato" title="Contato">
        <p>
          Para dúvidas sobre a plataforma, utilize os canais de atendimento do{' '}
          {legalConfig.brandName}. As informações completas de contato serão
          publicadas em breve.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
