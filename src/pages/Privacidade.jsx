import React from 'react';
import LegalPageLayout, { LegalSection } from '@/components/legal/LegalPageLayout';
import { legalConfig, legalRoutes } from '@/config/legal';

const SECTIONS = [
  { id: 'controlador', title: 'Identificação do controlador' },
  { id: 'dados-pacientes', title: 'Dados dos pacientes' },
  { id: 'dados-profissionais', title: 'Dados dos profissionais' },
  { id: 'dados-saude', title: 'Dados de saúde' },
  { id: 'finalidades', title: 'Finalidades e bases legais' },
  { id: 'compartilhamentos', title: 'Compartilhamentos' },
  { id: 'direitos', title: 'Direitos dos titulares' },
  { id: 'cookies', title: 'Cookies' },
  { id: 'seguranca', title: 'Segurança' },
  { id: 'contato-privacidade', title: 'Contato de privacidade' },
];

const EM_BREVE = 'Conteúdo desta seção será publicado em breve.';

export default function Privacidade() {
  return (
    <LegalPageLayout
      pageTitle="Privacidade"
      metaTitle="Privacidade | Rápido Doutor"
      metaDescription="Informações sobre o tratamento e a proteção de dados pessoais no Rápido Doutor."
      intro="Este Aviso de Privacidade explica como o Rápido Doutor coleta, utiliza, protege e compartilha dados pessoais em suas atividades."
      version={legalConfig.privacyVersion}
      lastUpdated={legalConfig.lastUpdated}
      sections={SECTIONS}
      currentRoute={legalRoutes.privacidade}
    >
      <LegalSection id="controlador" title="Identificação do controlador">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="dados-pacientes" title="Dados dos pacientes">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="dados-profissionais" title="Dados dos profissionais">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="dados-saude" title="Dados de saúde">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="finalidades" title="Finalidades e bases legais">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="compartilhamentos" title="Compartilhamentos">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="direitos" title="Direitos dos titulares">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="cookies" title="Cookies">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="seguranca" title="Segurança">
        <p>{EM_BREVE}</p>
      </LegalSection>
      <LegalSection id="contato-privacidade" title="Contato de privacidade">
        <p>
          O canal de privacidade do {legalConfig.brandName} será publicado em
          breve.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
