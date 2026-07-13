import React from 'react';
import LegalPageLayout, { LegalEmail, LegalSection, LegalSubSection } from '@/components/legal/LegalPageLayout';
import { LEGAL_DOCUMENTS, legalConfig, legalRoutes } from '@/config/legal';

const DOCUMENT = LEGAL_DOCUMENTS.privacy_notice;

const SECTIONS = [
  { id: 'controlador-escopo', title: '1. Controlador e escopo' },
  { id: 'categorias', title: '2. Categorias de dados' },
  { id: 'finalidades', title: '3. Finalidades e bases legais' },
  { id: 'fornecedores', title: '4. Compartilhamentos e fornecedores' },
  { id: 'internacional', title: '5. Transferências internacionais' },
  { id: 'retencao', title: '6. Armazenamento e retenção' },
  { id: 'seguranca', title: '7. Segurança e incidentes' },
  { id: 'ia', title: '8. Telemedicina, transcrição e IA' },
  { id: 'direitos', title: '9. Direitos dos titulares' },
  { id: 'exclusao', title: '10. Exclusão e limitações' },
  { id: 'menores', title: '11. Menores e dependentes' },
  { id: 'alteracoes', title: '12. Alterações deste Aviso' },
  { id: 'contato-privacidade', title: '13. Contato de privacidade' },
];

export default function Privacidade() {
  return (
    <LegalPageLayout
      pageTitle="Aviso de Privacidade"
      metaTitle="Aviso de Privacidade | Rápido Doutor"
      metaDescription="Informações sobre o tratamento de dados pessoais e dados de saúde no Rápido Doutor."
      intro="Este Aviso apresenta, de forma transparente, como dados pessoais são tratados no Rápido Doutor. A ciência deste documento não constitui consentimento geral nem autorização ilimitada para tratamento de dados."
      version={DOCUMENT.version}
      effectiveDate={DOCUMENT.effectiveDate}
      lastUpdated={DOCUMENT.lastUpdated}
      contactChannel={legalConfig.privacyEmail}
      sections={SECTIONS}
      currentRoute={legalRoutes.privacidade}
    >
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        Este documento contém dados empresariais pendentes e deve passar por revisão jurídica antes da produção.
      </div>

      <LegalSection id="controlador-escopo" title="1. Identificação do controlador e escopo">
        <p>Controlador: {legalConfig.legalName}, CNPJ {legalConfig.cnpj}, endereço {legalConfig.companyAddress}.</p>
        <p>Responsável técnico: {legalConfig.medicalDirectorName}. CRM da empresa ou registro aplicável: {legalConfig.companyCrm}.</p>
        <p>Este Aviso se aplica a pacientes, responsáveis, dependentes, profissionais de saúde e visitantes que utilizam a plataforma, os atendimentos remotos e os canais relacionados.</p>
        <p>Os papéis de controlador e operador podem variar conforme a atividade. Profissionais de saúde mantêm responsabilidade própria pelas decisões assistenciais e registros produzidos no exercício profissional.</p>
      </LegalSection>

      <LegalSection id="categorias" title="2. Categorias de dados tratados">
        <LegalSubSection id="categorias-pacientes" title="2.1. Pacientes e responsáveis">
          <p>Dados cadastrais e de contato, identificação, data de nascimento, informações de conta, agendamentos, solicitações, histórico de uso, avaliações e comunicações necessárias ao serviço.</p>
        </LegalSubSection>
        <LegalSubSection id="categorias-profissionais" title="2.2. Profissionais">
          <p>Dados cadastrais, registro profissional, formação, especialidade, documentos de validação, agenda, perfil público, informações fiscais, bancárias e de repasse quando necessárias.</p>
        </LegalSubSection>
        <LegalSubSection id="categorias-saude" title="2.3. Dados pessoais sensíveis de saúde">
          <p>Queixas, sintomas, antecedentes, medicamentos, alergias, registros de atendimento, prontuários, prescrições, atestados, exames, laudos e documentos fornecidos ou produzidos durante a assistência.</p>
        </LegalSubSection>
        <LegalSubSection id="categorias-financeiros" title="2.4. Dados financeiros">
          <p>Valores, cobranças, status e referências de transação. Dados completos de cartão são tratados pelos gateways de pagamento conforme a integração aplicável, e não devem ser armazenados pela interface do Rápido Doutor.</p>
        </LegalSubSection>
        <LegalSubSection id="categorias-tecnicos" title="2.5. Dados técnicos e de segurança">
          <p>Identificadores de sessão e dispositivo, eventos técnicos, endereço de rede quando necessário, tentativas de acesso, registros de segurança e auditoria. A observabilidade deve usar contexto técnico mínimo e não registrar prontuários, diagnósticos ou documentos.</p>
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="finalidades" title="3. Finalidades e bases legais">
        <p>Os dados podem ser usados para criar e proteger contas; verificar profissionais; organizar consultas e serviços; permitir comunicação e telemedicina; manter registros assistenciais; processar pagamentos, planos e créditos; prevenir fraude; prestar suporte; cumprir obrigações legais, regulatórias e médicas; proteger direitos; e melhorar segurança e confiabilidade.</p>
        <p>As bases legais são definidas conforme cada finalidade e podem incluir execução de contrato e procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, proteção da vida e da saúde, tutela da saúde, legítimo interesse quando aplicável e consentimento apenas nas situações em que ele for juridicamente adequado.</p>
        <p>O consentimento não é usado como justificativa universal. Telemedicina, transcrição, gravação, IA, marketing e outras escolhas específicas exigem avaliação e controles próprios.</p>
      </LegalSection>

      <LegalSection id="fornecedores" title="4. Compartilhamentos e fornecedores">
        <p>O acesso é limitado ao necessário para a finalidade e pode envolver profissionais vinculados ao atendimento, autoridades quando exigido e fornecedores contratados para infraestrutura ou operação.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Supabase:</strong> autenticação, banco de dados, funções server-side e armazenamento.</li>
          <li><strong>Zoom:</strong> infraestrutura de videoconferência para teleconsulta.</li>
          <li><strong>Mercado Pago e Stripe:</strong> processamento de pagamentos, conforme o provedor selecionado pelo backend.</li>
          <li><strong>API externa de planos:</strong> ativação de assinaturas, consulta de cobertura e gestão de créditos.</li>
          <li><strong>Mapbox:</strong> mapas e recursos de localização quando utilizados.</li>
          <li><strong>Deepgram:</strong> recursos de transcrição quando ativados e autorizados no fluxo específico.</li>
          <li><strong>Groq:</strong> processamento por IA quando ativado para funcionalidade específica e sujeito aos controles aplicáveis.</li>
        </ul>
        <p>Os fornecedores recebem somente os dados necessários ao funcionamento de cada integração e podem possuir avisos próprios para tratamentos realizados sob sua responsabilidade.</p>
      </LegalSection>

      <LegalSection id="internacional" title="5. Transferências internacionais">
        <p>Alguns fornecedores de infraestrutura podem armazenar ou processar dados fora do Brasil. Essas operações deverão observar requisitos legais, medidas contratuais e avaliação dos países e fornecedores envolvidos. Os instrumentos aplicáveis devem ser validados antes da produção.</p>
      </LegalSection>

      <LegalSection id="retencao" title="6. Armazenamento, retenção e prontuários">
        <p>Os dados serão conservados pelo período necessário ao cumprimento das finalidades, obrigações legais, regulatórias, médicas e defesa de direitos, conforme matriz de retenção a ser formalizada antes da produção.</p>
        <p>Prontuários e documentos assistenciais podem estar sujeitos a deveres específicos de integridade, guarda e disponibilidade. A desativação da conta não significa necessariamente a eliminação desses registros.</p>
        <p>Quando a conservação deixar de ser necessária, os dados serão eliminados ou anonimizados de forma compatível com as obrigações aplicáveis e as possibilidades técnicas.</p>
      </LegalSection>

      <LegalSection id="seguranca" title="7. Segurança e incidentes">
        <p>São adotadas medidas técnicas e organizacionais proporcionais aos riscos, incluindo autenticação, autorização por papel e vínculo, segregação de dados, armazenamento privado, trilhas de auditoria e proteção de integrações server-side.</p>
        <p>Nenhum sistema é isento de riscos. Incidentes confirmados serão avaliados, contidos e comunicados aos titulares e à autoridade competente quando a legislação exigir.</p>
      </LegalSection>

      <LegalSection id="ia" title="8. Telemedicina, transcrição, gravação e IA">
        <p>A prestação de telemedicina envolve tratamento de dados necessário ao atendimento e terá consentimento informado próprio em fase específica.</p>
        <p>Transcrição, gravação e recursos de IA não são abrangidos pelo aceite dos Termos nem pela ciência deste Aviso. Quando aplicáveis, terão informação clara, finalidade delimitada e escolha separada, inclusive possibilidade de revogação quando a base legal for consentimento.</p>
        <p>Recursos automatizados podem apoiar tarefas operacionais ou clínicas, mas não devem substituir indevidamente o julgamento do profissional. Eventuais decisões automatizadas relevantes e mecanismos de revisão serão informados no contexto da funcionalidade.</p>
      </LegalSection>

      <LegalSection id="direitos" title="9. Direitos dos titulares">
        <p>Nos limites legais, o titular pode solicitar confirmação e acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade quando regulamentada; informação sobre compartilhamentos; revisão de decisões automatizadas; e revogação de consentimento quando essa for a base aplicável.</p>
        <p>A identidade e a legitimidade do solicitante poderão ser verificadas. Restrições legais ou profissionais serão explicadas quando impedirem o atendimento integral do pedido.</p>
      </LegalSection>

      <LegalSection id="exclusao" title="10. Exclusão, desativação e limitações legais">
        <p>O usuário pode solicitar desativação da conta e exercer seus direitos pelos canais indicados. Desativar a conta interrompe o uso ordinário, mas não elimina automaticamente prontuários, registros financeiros, auditorias ou informações cuja retenção seja obrigatória ou necessária à defesa de direitos.</p>
        <p>O fluxo técnico completo de exportação, exclusão e anonimização será tratado em fase própria.</p>
      </LegalSection>

      <LegalSection id="menores" title="11. Menores e dependentes">
        <p>Dados de menores e dependentes devem ser fornecidos e geridos por responsável legítimo, observadas as regras assistenciais e o melhor interesse do paciente. A plataforma poderá solicitar comprovação de identidade, vínculo e representação.</p>
      </LegalSection>

      <LegalSection id="alteracoes" title="12. Alterações deste Aviso">
        <p>Este Aviso pode ser atualizado para refletir mudanças legais, operacionais ou tecnológicas. A versão, vigência e última atualização permanecerão visíveis. Uma nova ciência poderá ser solicitada quando houver alteração relevante.</p>
      </LegalSection>

      <LegalSection id="contato-privacidade" title="13. Contato de privacidade e encarregado">
        <p>Contato de privacidade/encarregado: <LegalEmail value={legalConfig.privacyEmail} />.</p>
        <p>Razão social: {legalConfig.legalName}. CNPJ: {legalConfig.cnpj}. Endereço: {legalConfig.companyAddress}.</p>
        <p>Prazo e procedimento interno de resposta: {legalConfig.privacyResponseDeadline}.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
