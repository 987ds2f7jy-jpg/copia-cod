import React from 'react';
import LegalPageLayout, { LegalEmail, LegalSection, LegalSubSection } from '@/components/legal/LegalPageLayout';
import { LEGAL_DOCUMENTS, legalConfig, legalRoutes } from '@/config/legal';
import { Link } from 'react-router-dom';

const DOCUMENT = LEGAL_DOCUMENTS.privacy_notice;

const SECTIONS = [
  { id: 'controlador', title: '1. Identificação do controlador' },
  { id: 'aplicacao', title: '2. A quem este Aviso se aplica' },
  { id: 'categorias', title: '3. Categorias de dados pessoais' },
  { id: 'fontes', title: '4. Como os dados são obtidos' },
  { id: 'finalidades', title: '5. Para que utilizamos os dados' },
  { id: 'bases-legais', title: '6. Bases legais' },
  { id: 'papeis', title: '7. Controlador, operador e responsabilidades' },
  { id: 'compartilhamentos', title: '8. Com quem os dados poderão ser compartilhados' },
  { id: 'fornecedores', title: '9. Fornecedores e suboperadores' },
  { id: 'internacional', title: '10. Transferência internacional' },
  { id: 'retencao', title: '11. Por quanto tempo os dados são mantidos' },
  { id: 'direitos', title: '12. Direitos dos titulares' },
  { id: 'menores', title: '13. Dados de crianças e adolescentes' },
  { id: 'cookies', title: '14. Cookies e tecnologias semelhantes' },
  { id: 'seguranca', title: '15. Segurança da informação' },
  { id: 'automatizadas', title: '16. Decisões automatizadas' },
  { id: 'marketing', title: '17. Comunicações promocionais' },
  { id: 'incidentes', title: '18. Incidentes de segurança' },
  { id: 'atualizacoes', title: '19. Atualizações deste Aviso' },
  { id: 'contato', title: '20. Fale com o Rápido Doutor' },
];

const SUPPLIERS = [
  {
    fornecedor: 'Supabase',
    finalidade: 'Banco de dados, autenticação e armazenamento',
    dados: 'Cadastro, registros, documentos e logs, conforme configuração',
    local: '(CONFIRMAR REGIÃO)',
    papel: 'Operador ou suboperador',
  },
  {
    fornecedor: 'Zoom Video SDK',
    finalidade: 'Videoconsulta',
    dados: 'Identificação e dados técnicos da sessão',
    local: '(CONFIRMAR LOCAL DE PROCESSAMENTO)',
    papel: 'Operador, suboperador ou controlador independente conforme contrato',
  },
  {
    fornecedor: 'Mercado Pago',
    finalidade: 'Pagamentos',
    dados: 'Identificação, transação, antifraude e estorno',
    local: '(CONFIRMAR)',
    papel: 'A confirmar conforme fluxo',
  },
  {
    fornecedor: 'Stripe',
    finalidade: 'Pagamentos',
    dados: 'Identificação, transação, antifraude e estorno',
    local: '(CONFIRMAR)',
    papel: 'A confirmar conforme fluxo',
  },
  {
    fornecedor: 'Serviço de e-mail',
    finalidade: 'Comunicações',
    dados: 'Nome, e-mail e conteúdo da mensagem',
    local: '(ADICIONAR FORNECEDOR)',
    papel: 'Operador',
  },
  {
    fornecedor: 'Monitoramento de erros',
    finalidade: 'Segurança técnica',
    dados: 'Logs, dispositivo e erros',
    local: '(ADICIONAR FORNECEDOR)',
    papel: 'Operador',
  },
];

function SupplierTable() {
  return (
    <div>
      {/* Tabela (desktop/tablet) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th scope="col" className="px-4 py-3 font-semibold text-foreground">Fornecedor ou categoria</th>
              <th scope="col" className="px-4 py-3 font-semibold text-foreground">Finalidade</th>
              <th scope="col" className="px-4 py-3 font-semibold text-foreground">Dados envolvidos</th>
              <th scope="col" className="px-4 py-3 font-semibold text-foreground">Local de processamento</th>
              <th scope="col" className="px-4 py-3 font-semibold text-foreground">Papel</th>
            </tr>
          </thead>
          <tbody>
            {SUPPLIERS.map((row) => (
              <tr key={row.fornecedor} className="border-t border-border align-top">
                <td className="px-4 py-3 font-medium text-foreground">{row.fornecedor}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.finalidade}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.dados}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.local}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.papel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartões (celular) */}
      <ul className="md:hidden space-y-4">
        {SUPPLIERS.map((row) => (
          <li key={row.fornecedor} className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-foreground">{row.fornecedor}</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div><dt className="inline font-medium text-foreground">Finalidade: </dt><dd className="inline text-muted-foreground">{row.finalidade}</dd></div>
              <div><dt className="inline font-medium text-foreground">Dados envolvidos: </dt><dd className="inline text-muted-foreground">{row.dados}</dd></div>
              <div><dt className="inline font-medium text-foreground">Local de processamento: </dt><dd className="inline text-muted-foreground">{row.local}</dd></div>
              <div><dt className="inline font-medium text-foreground">Papel: </dt><dd className="inline text-muted-foreground">{row.papel}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function Privacidade() {
  return (
    <LegalPageLayout
      pageTitle="Aviso de Privacidade do Rápido Doutor"
      metaTitle="Aviso de Privacidade | Rápido Doutor"
      metaDescription="Informações sobre como os dados pessoais são coletados, utilizados, compartilhados, armazenados e protegidos no Rápido Doutor."
      intro="Informações sobre como os dados pessoais são coletados, utilizados, compartilhados, armazenados e protegidos."
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

      <div className="space-y-3 text-base leading-relaxed text-muted-foreground">
        <p>O Rápido Doutor reconhece a importância da privacidade e da proteção de dados pessoais, especialmente quando o tratamento envolve informações relacionadas à saúde.</p>
        <p>Este Aviso explica de forma geral como os dados são tratados no site, nas aplicações, nos atendimentos e nas relações com pacientes, responsáveis legais, profissionais de saúde, clínicas, parceiros e visitantes.</p>
      </div>

      <LegalSection id="controlador" title="1. Identificação do controlador">
        <p>Rápido Doutor é a marca utilizada por {legalConfig.legalName}, inscrita no CNPJ sob o número {legalConfig.cnpj}, com endereço em {legalConfig.companyAddress}, {legalConfig.companyCityState}.</p>
        <p>Contato geral: <LegalEmail value={legalConfig.supportEmail} /></p>
        <p>Contato de privacidade: <LegalEmail value={legalConfig.privacyEmail} /></p>
        <p>Encarregado pelo tratamento de dados: {legalConfig.dpoName}</p>
        <p>Os papéis de controlador e operador poderão variar de acordo com a atividade de tratamento, conforme explicado neste Aviso.</p>
      </LegalSection>

      <LegalSection id="aplicacao" title="2. A quem este Aviso se aplica">
        <p>Este Aviso se aplica a:</p>
        <BulletList items={[
          'visitantes do site;',
          'pacientes;',
          'responsáveis legais;',
          'profissionais de saúde;',
          'representantes de clínicas;',
          'pessoas que entram em contato com o suporte;',
          'fornecedores e parceiros;',
          'candidatos a credenciamento;',
          'demais pessoas cujos dados sejam tratados nas atividades do Rápido Doutor.',
        ]} />
      </LegalSection>

      <LegalSection id="categorias" title="3. Categorias de dados pessoais">
        <LegalSubSection id="categorias-identificacao" title="3.1. Dados de identificação">
          <BulletList items={[
            'nome;',
            'CPF ou outro documento;',
            'data de nascimento;',
            'sexo ou informação necessária à assistência, quando aplicável;',
            'fotografia;',
            'assinatura;',
            'dados do responsável legal;',
            'documentos de identificação;',
            'registros profissionais.',
          ]} />
        </LegalSubSection>
        <LegalSubSection id="categorias-contato" title="3.2. Dados de contato">
          <BulletList items={[
            'e-mail;',
            'telefone;',
            'endereço;',
            'cidade;',
            'estado;',
            'país;',
            'preferências de comunicação.',
          ]} />
        </LegalSubSection>
        <LegalSubSection id="categorias-saude" title="3.3. Dados de saúde">
          <BulletList items={[
            'sintomas;',
            'queixas;',
            'antecedentes;',
            'alergias;',
            'medicamentos;',
            'diagnósticos;',
            'hipóteses diagnósticas;',
            'resultados de exames;',
            'imagens e documentos clínicos;',
            'prescrições;',
            'atestados;',
            'pedidos de exame;',
            'laudos;',
            'encaminhamentos;',
            'evoluções;',
            'informações do prontuário;',
            'informações fornecidas durante a teleconsulta.',
          ]} />
          <p>Dados de saúde são dados pessoais sensíveis e exigem proteção reforçada.</p>
        </LegalSubSection>
        <LegalSubSection id="categorias-profissionais" title="3.4. Dados profissionais">
          <BulletList items={[
            'formação;',
            'conselho profissional;',
            'número de registro;',
            'RQE;',
            'especialidades;',
            'currículo;',
            'experiência;',
            'fotografia profissional;',
            'disponibilidade;',
            'agenda;',
            'dados fiscais;',
            'dados bancários;',
            'informações de credenciamento;',
            'registros de atendimentos e repasses.',
          ]} />
        </LegalSubSection>
        <LegalSubSection id="categorias-financeiros" title="3.5. Dados financeiros e de pagamento">
          <BulletList items={[
            'valor do serviço;',
            'forma de pagamento;',
            'identificadores de transação;',
            'situação do pagamento;',
            'estornos;',
            'reembolsos;',
            'dados necessários à prevenção de fraude;',
            'informações fiscais.',
          ]} />
          <p>Dados completos de cartão poderão ser processados diretamente por fornecedores de pagamento, conforme a solução efetivamente contratada.</p>
        </LegalSubSection>
        <LegalSubSection id="categorias-tecnicos" title="3.6. Dados técnicos e de uso">
          <BulletList items={[
            'endereço IP;',
            'data e hora de acesso;',
            'navegador;',
            'sistema operacional;',
            'dispositivo;',
            'identificadores de sessão;',
            'páginas acessadas;',
            'eventos de segurança;',
            'registros de erro;',
            'logs de autenticação;',
            'registros de auditoria;',
            'preferências de cookies.',
          ]} />
        </LegalSubSection>
        <LegalSubSection id="categorias-comunicacao" title="3.7. Dados de comunicação">
          <BulletList items={[
            'mensagens ao suporte;',
            'comunicações por e-mail;',
            'comunicações por telefone;',
            'mensagens transacionais;',
            'reclamações;',
            'avaliações;',
            'documentos enviados;',
            'respostas a pesquisas.',
          ]} />
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="fontes" title="4. Como os dados são obtidos">
        <p>Os dados poderão ser obtidos:</p>
        <BulletList items={[
          'diretamente do titular;',
          'do responsável legal;',
          'do profissional de saúde;',
          'de clínicas;',
          'de planos ou operadoras de saúde, quando aplicável;',
          'de fornecedores de pagamento;',
          'de serviços de autenticação;',
          'de fontes públicas profissionais;',
          'do uso do site e da aplicação;',
          'de autoridades ou parceiros autorizados;',
          'de integrações expressamente utilizadas pelo usuário.',
        ]} />
      </LegalSection>

      <LegalSection id="finalidades" title="5. Para que utilizamos os dados">
        <LegalSubSection id="finalidades-cadastro" title="5.1. Cadastro e autenticação">
          <p>Criar e manter contas, verificar identidade, recuperar acesso, prevenir uso indevido e proteger a segurança.</p>
        </LegalSubSection>
        <LegalSubSection id="finalidades-servicos" title="5.2. Prestação e organização dos serviços">
          <p>Permitir busca, solicitação, distribuição, aceite, agendamento, realização e acompanhamento de atendimentos e serviços.</p>
        </LegalSubSection>
        <LegalSubSection id="finalidades-assistencia" title="5.3. Assistência à saúde">
          <p>Disponibilizar ao profissional informações necessárias à avaliação, atendimento, registro, prescrição, emissão de documentos, orientação e continuidade assistencial.</p>
        </LegalSubSection>
        <LegalSubSection id="finalidades-pagamentos" title="5.4. Pagamentos">
          <p>Processar cobranças, repasses, comissões, reembolsos, estornos, documentos fiscais, prevenção de fraude e conciliação financeira.</p>
        </LegalSubSection>
        <LegalSubSection id="finalidades-comunicacao" title="5.5. Comunicação">
          <p>Enviar confirmações, lembretes, avisos operacionais, alterações relevantes, mensagens de segurança e respostas de suporte.</p>
        </LegalSubSection>
        <LegalSubSection id="finalidades-seguranca" title="5.6. Segurança">
          <p>Detectar fraudes, acessos indevidos, abuso, falhas, vulnerabilidades e violações dos Termos.</p>
        </LegalSubSection>
        <LegalSubSection id="finalidades-legal" title="5.7. Cumprimento legal e regulatório">
          <p>Atender obrigações legais, regulatórias, profissionais, fiscais, judiciais e administrativas.</p>
        </LegalSubSection>
        <LegalSubSection id="finalidades-melhoria" title="5.8. Melhoria da Plataforma">
          <p>Analisar desempenho, corrigir erros, compreender o uso dos recursos e desenvolver melhorias, preferencialmente com minimização, agregação ou anonimização quando possível.</p>
        </LegalSubSection>
        <LegalSubSection id="finalidades-marketing" title="5.9. Marketing">
          <p>Enviar comunicações promocionais somente quando houver base jurídica adequada e possibilidade de cancelamento.</p>
          <p>Dados de saúde não serão utilizados para publicidade comportamental incompatível com a finalidade assistencial.</p>
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="bases-legais" title="6. Bases legais">
        <p>O tratamento poderá se apoiar, conforme a finalidade, em:</p>
        <BulletList items={[
          'execução de contrato ou procedimentos preliminares;',
          'cumprimento de obrigação legal ou regulatória;',
          'tutela da saúde;',
          'exercício regular de direitos;',
          'prevenção à fraude e segurança do titular;',
          'proteção do crédito;',
          'legítimo interesse, após avaliação de necessidade e equilíbrio;',
          'consentimento, quando exigido ou considerado adequado;',
          'outras hipóteses previstas na legislação.',
        ]} />
        <p>O consentimento não será utilizado como justificativa genérica para todo tratamento.</p>
        <p>Quando o tratamento for necessário à assistência, ao prontuário, ao cumprimento regulatório ou ao exercício de direitos, sua continuidade poderá não depender de consentimento.</p>
      </LegalSection>

      <LegalSection id="papeis" title="7. Controlador, operador e responsabilidades">
        <p>O Rápido Doutor poderá atuar como controlador nos tratamentos relacionados ao cadastro, funcionamento da Plataforma, segurança, pagamentos, suporte, credenciamento, comunicação e organização dos serviços.</p>
        <p>O profissional de saúde poderá atuar como controlador das decisões e dos registros essencialmente clínicos, incluindo avaliação, diagnóstico, prescrição, laudo, orientação e plano terapêutico.</p>
        <p>Quando o Rápido Doutor apenas armazenar ou processar informações clínicas conforme instruções legítimas do profissional ou da clínica, poderá atuar como operador.</p>
        <p>Alguns fornecedores, como empresas de pagamento, poderão atuar como controladores independentes em tratamentos necessários às próprias obrigações legais, regulatórias, antifraude ou financeiras.</p>
        <p>A qualificação dependerá das decisões e atividades efetivamente realizadas, e não apenas do nome utilizado em contrato.</p>
      </LegalSection>

      <LegalSection id="compartilhamentos" title="8. Com quem os dados poderão ser compartilhados">
        <p>O compartilhamento ocorrerá somente quando necessário e de acordo com a finalidade aplicável.</p>
        <LegalSubSection id="compartilhamentos-profissionais" title="Profissionais de saúde">
          <p>Para avaliação, atendimento, prontuário, documentos e continuidade assistencial.</p>
        </LegalSubSection>
        <LegalSubSection id="compartilhamentos-clinicas" title="Clínicas e equipes autorizadas">
          <p>Quando participarem legitimamente do atendimento ou da administração do serviço.</p>
        </LegalSubSection>
        <LegalSubSection id="compartilhamentos-infra" title="Fornecedores de infraestrutura">
          <p>Para hospedagem, banco de dados, armazenamento, autenticação, comunicação, videoconferência, monitoramento e segurança.</p>
        </LegalSubSection>
        <LegalSubSection id="compartilhamentos-pagamento" title="Fornecedores de pagamento">
          <p>Para cobrança, antifraude, estorno, reembolso e conciliação.</p>
        </LegalSubSection>
        <LegalSubSection id="compartilhamentos-planos" title="Planos e operadoras">
          <p>Quando o paciente solicitar utilização de cobertura e o compartilhamento for necessário.</p>
        </LegalSubSection>
        <LegalSubSection id="compartilhamentos-suporte" title="Prestadores de suporte">
          <p>Quando precisarem tratar dados para solucionar uma solicitação.</p>
        </LegalSubSection>
        <LegalSubSection id="compartilhamentos-autoridades" title="Autoridades">
          <p>Quando houver obrigação legal, ordem válida, proteção de direitos ou situação de emergência admitida.</p>
        </LegalSubSection>
        <LegalSubSection id="compartilhamentos-societarias" title="Operações societárias">
          <p>Em eventual reorganização, fusão, aquisição ou transferência, com salvaguardas apropriadas.</p>
        </LegalSubSection>
        <p>O Rápido Doutor não comercializa prontuários ou dados de saúde como produto.</p>
      </LegalSection>

      <LegalSection id="fornecedores" title="9. Fornecedores e suboperadores">
        <SupplierTable />
        <p>Esta relação será atualizada quando os fornecedores definitivos forem contratados ou substituídos.</p>
      </LegalSection>

      <LegalSection id="internacional" title="10. Transferência internacional">
        <p>Alguns fornecedores poderão armazenar ou processar dados fora do Brasil.</p>
        <p>Quando houver transferência internacional, o Rápido Doutor deverá avaliar o país, o fornecedor, a finalidade, a necessidade e o mecanismo jurídico aplicável.</p>
        <p>Serão adotadas salvaguardas contratuais, técnicas e organizacionais compatíveis com a legislação brasileira.</p>
      </LegalSection>

      <LegalSection id="retencao" title="11. Por quanto tempo os dados são mantidos">
        <p>Os dados serão mantidos pelo período necessário para:</p>
        <BulletList items={[
          'prestar o serviço;',
          'manter o prontuário e a continuidade assistencial;',
          'cumprir obrigações legais e regulatórias;',
          'atender prazos fiscais;',
          'prevenir fraude;',
          'exercer ou defender direitos;',
          'preservar segurança e auditoria;',
          'cumprir determinações válidas.',
        ]} />
        <p><span className="font-medium text-foreground">Tabela definitiva de retenção:</span> (ADICIONAR TABELA E PRAZOS DE RETENÇÃO)</p>
        <p>O encerramento da conta não implica eliminação automática de prontuários ou dados cuja conservação seja necessária.</p>
        <p>Após o término do prazo aplicável, os dados poderão ser eliminados, anonimizados ou mantidos de forma bloqueada, conforme a finalidade e a legislação.</p>
      </LegalSection>

      <LegalSection id="direitos" title="12. Direitos dos titulares">
        <p>O titular poderá solicitar, conforme a legislação e a situação aplicável:</p>
        <BulletList items={[
          'confirmação da existência de tratamento;',
          'acesso aos dados;',
          'correção de dados incompletos ou inexatos;',
          'informação sobre compartilhamentos;',
          'anonimização, bloqueio ou eliminação quando cabível;',
          'portabilidade, quando regulamentada e aplicável;',
          'eliminação de dados tratados com consentimento, ressalvadas hipóteses de conservação;',
          'informação sobre a possibilidade de não consentir;',
          'revogação do consentimento;',
          'oposição a tratamento irregular;',
          'revisão de decisões exclusivamente automatizadas, quando aplicável;',
          'peticionamento perante a autoridade competente.',
        ]} />
        <p>As solicitações poderão exigir verificação de identidade para evitar entrega de dados a terceiros.</p>
        <p>Determinados pedidos poderão ser limitados quando houver obrigação legal, prontuário, sigilo de terceiros, segurança, prevenção de fraude ou exercício de direitos.</p>
        <p>Canal para solicitações: <LegalEmail value={legalConfig.privacyEmail} /></p>
        <p>Prazo interno estimado: {legalConfig.privacyResponseDeadline}</p>
      </LegalSection>

      <LegalSection id="menores" title="13. Dados de crianças e adolescentes">
        <p>O tratamento de dados de menores deverá considerar seu melhor interesse.</p>
        <p>Quando necessário, a Plataforma solicitará participação e identificação do responsável legal.</p>
        <p>O responsável deverá evitar criar conta autônoma em nome do menor quando existir fluxo específico de dependente ou representado.</p>
        <p>O profissional poderá exigir presença do responsável, documentação ou atendimento presencial conforme o caso.</p>
      </LegalSection>

      <LegalSection id="cookies" title="14. Cookies e tecnologias semelhantes">
        <p>O site poderá utilizar cookies necessários ao funcionamento, segurança, autenticação e preferências.</p>
        <p>Cookies de análise, funcionalidade adicional ou publicidade somente deverão ser utilizados de acordo com a configuração efetiva do site e a base jurídica aplicável.</p>
        <p>As categorias previstas são:</p>
        <BulletList items={[
          'necessários;',
          'funcionais;',
          'análise;',
          'publicidade;',
          'terceiros.',
        ]} />
        <p>Quando cookies não necessários forem utilizados, a Plataforma deverá disponibilizar mecanismo adequado de escolha e gerenciamento.</p>
        <p>Neste momento, a implementação técnica do banner e do centro de preferências será realizada em fase separada após auditoria dos cookies efetivamente existentes.</p>
      </LegalSection>

      <LegalSection id="seguranca" title="15. Segurança da informação">
        <p>O Rápido Doutor adotará medidas técnicas e administrativas proporcionais aos riscos, incluindo controles de acesso, autenticação, criptografia, registros de auditoria, backups, monitoramento e gestão de fornecedores, conforme aplicável.</p>
        <p>Nenhum sistema conectado é completamente imune a riscos.</p>
        <p>Usuários e profissionais também devem proteger suas credenciais, dispositivos, redes e ambientes de atendimento.</p>
        <p>Suspeitas de incidente poderão ser comunicadas para: <LegalEmail value={legalConfig.privacyEmail} /></p>
      </LegalSection>

      <LegalSection id="automatizadas" title="16. Decisões automatizadas">
        <p>A Plataforma poderá utilizar regras automatizadas para segurança, prevenção de fraude, elegibilidade técnica, ordenação de resultados e distribuição de solicitações.</p>
        <p>Decisões que produzam efeitos relevantes deverão possuir critérios compatíveis com a finalidade e mecanismos de revisão quando exigidos.</p>
        <p>O Rápido Doutor não deverá utilizar algoritmo para substituir a autonomia clínica do profissional.</p>
      </LegalSection>

      <LegalSection id="marketing" title="17. Comunicações promocionais">
        <p>O usuário poderá receber mensagens operacionais necessárias ao serviço.</p>
        <p>Mensagens promocionais serão tratadas separadamente e deverão oferecer meio de cancelamento.</p>
        <p>A revogação de marketing não impede mensagens essenciais sobre consultas, segurança, pagamentos ou mudanças contratuais.</p>
      </LegalSection>

      <LegalSection id="incidentes" title="18. Incidentes de segurança">
        <p>Suspeitas de acesso, perda, alteração, divulgação ou uso indevido serão avaliadas de acordo com o plano de resposta a incidentes.</p>
        <p>Quando aplicável, poderão ser adotadas medidas de contenção, investigação, comunicação a titulares, comunicação a autoridades e prevenção de recorrência.</p>
        <p>O usuário deverá comunicar rapidamente qualquer uso indevido de sua conta.</p>
      </LegalSection>

      <LegalSection id="atualizacoes" title="19. Atualizações deste Aviso">
        <p>Este Aviso poderá ser atualizado diante de alterações legais, regulatórias, tecnológicas ou operacionais.</p>
        <p>A versão e a data serão apresentadas nesta página.</p>
        <p>Mudanças relevantes poderão ser comunicadas por meio da Plataforma ou dos canais cadastrados.</p>
      </LegalSection>

      <LegalSection id="contato" title="20. Fale com o Rápido Doutor">
        <p>Razão social: {legalConfig.legalName}</p>
        <p>CNPJ: {legalConfig.cnpj}</p>
        <p>Endereço: {legalConfig.companyAddress}, {legalConfig.companyCityState}</p>
        <p>Suporte: <LegalEmail value={legalConfig.supportEmail} /></p>
        <p>Privacidade: <LegalEmail value={legalConfig.privacyEmail} /></p>
        <p>Encarregado: {legalConfig.dpoName}</p>
        <p>Telefone: {legalConfig.phone}</p>
        <p className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
          <Link to={legalRoutes.termos} className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
            Termos de Uso
          </Link>
          <Link to={legalRoutes.ajuda} className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
            Central de Ajuda
          </Link>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
