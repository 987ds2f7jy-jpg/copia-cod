import React from 'react';
import LegalPageLayout, { LegalSection } from '@/components/legal/LegalPageLayout';
import { legalConfig, legalRoutes } from '@/config/legal';

const SECTIONS = [
  { id: 'pacientes', title: 'Termos aplicáveis aos pacientes' },
  { id: 'profissionais', title: 'Termos aplicáveis aos profissionais' },
  { id: 'servicos', title: 'Serviços oferecidos' },
  { id: 'telemedicina', title: 'Telemedicina' },
  { id: 'pagamentos', title: 'Pagamentos, cancelamentos e reembolsos' },
  { id: 'responsabilidades', title: 'Responsabilidades' },
  { id: 'privacidade', title: 'Privacidade' },
  { id: 'contato', title: 'Contato' },
];

const EM_BREVE = 'Conteúdo desta seção será publicado em breve.';

export default function TermosDeUso() {
  return (
    <LegalPageLayout
      pageTitle="Termos de Uso"
      metaTitle="Termos de Uso | Rápido Doutor"
      metaDescription="Termos aplicáveis ao uso da plataforma Rápido Doutor por pacientes e profissionais de saúde."
      intro="Estes termos estabelecem as regras aplicáveis ao acesso e à utilização da plataforma Rápido Doutor por pacientes, profissionais de saúde e demais usuários."
      version={legalConfig.termsVersion}
      lastUpdated={legalConfig.lastUpdated}
      sections={SECTIONS}
      currentRoute={legalRoutes.termos}
    >
      <LegalSection id="pacientes" title="Termos aplicáveis aos pacientes">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="profissionais" title="Termos aplicáveis aos profissionais">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="servicos" title="Serviços oferecidos">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="telemedicina" title="Telemedicina">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="pagamentos" title="Pagamentos, cancelamentos e reembolsos">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="responsabilidades" title="Responsabilidades">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="privacidade" title="Privacidade">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="contato" title="Contato">
        <p>
          As informações completas de contato do {legalConfig.brandName} serão
          publicadas em breve.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
