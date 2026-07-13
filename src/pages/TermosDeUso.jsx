import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import LegalPageLayout, {
  LegalSection,
  LegalSubSection,
  LegalEmail,
} from '@/components/legal/LegalPageLayout';
import { LEGAL_DOCUMENTS, legalConfig, legalRoutes } from '@/config/legal';

const DOCUMENT = LEGAL_DOCUMENTS.terms_of_use;

const SECTIONS = [
  { id: 's1', title: '1. Identificação e objeto' },
  { id: 's2', title: '2. Definições' },
  { id: 's3', title: '3. Natureza da Plataforma' },
  { id: 's4', title: '4. Cadastro e segurança da conta' },
  { id: 's5', title: '5. Menores de idade e representação legal' },
  { id: 's6', title: '6. Modalidades de serviço' },
  { id: 's7', title: '7. Atendimento por telemedicina' },
  { id: 's8', title: '8. Situações de urgência e emergência' },
  { id: 's9', title: '9. Autonomia do profissional de saúde' },
  { id: 's10', title: '10. Preços e pagamentos' },
  { id: 's11', title: '11. Cancelamentos, atrasos e reembolsos' },
  { id: 's12', title: '12. Planos da Plataforma, créditos e coberturas' },
  { id: 's13', title: '13. Receitas, atestados, pedidos de exame e laudos' },
  { id: 's14', title: '14. Condutas proibidas' },
  { id: 's15', title: '15. Avaliações, comentários e conteúdos enviados' },
  { id: 's16', title: '16. Disponibilidade e manutenção' },
  { id: 's17', title: '17. Propriedade intelectual' },
  { id: 's18', title: '18. Privacidade e proteção de dados' },
  { id: 's19', title: '19. Suspensão e encerramento de conta' },
  { id: 's20', title: '20. Alterações destes Termos' },
  { id: 's21', title: '21. Contato' },
  { id: 's22', title: '22. Legislação aplicável' },
  { id: 'profissionais', title: 'Condições específicas para profissionais' },
];

const GROUPS = [
  { id: 's1', label: 'Termos dos Pacientes' },
  { id: 'profissionais', label: 'Termos dos Profissionais' },
  { id: 's7', label: 'Telemedicina' },
  { id: 's10', label: 'Pagamentos e Cancelamentos' },
  { id: 's14', label: 'Regras Gerais' },
];

export default function TermosDeUso() {
  return (
    <LegalPageLayout
      pageTitle="Termos de Uso do Rápido Doutor"
      metaTitle="Termos de Uso | Rápido Doutor"
      metaDescription="Termos aplicáveis ao uso da plataforma Rápido Doutor por pacientes e profissionais de saúde."
      intro="Regras aplicáveis ao acesso e à utilização da plataforma por pacientes, profissionais de saúde e demais usuários."
      version={DOCUMENT.version}
      effectiveDate={DOCUMENT.effectiveDate}
      lastUpdated={DOCUMENT.lastUpdated}
      contactChannel={legalConfig.supportEmail}
      sections={SECTIONS}
      currentRoute={legalRoutes.termos}
    >
      {/* Navegação por grupos (adaptável em telas pequenas, sem rolagem horizontal problemática) */}
      <nav aria-label="Categorias" className="-mt-2">
        <ul className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <li key={g.id}>
              <a
                href={`#${g.id}`}
                className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {g.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Nota visual discreta */}
      <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
        Leia estes Termos com atenção. As regras específicas de preço, horário,
        cancelamento e reembolso apresentadas antes da contratação de cada
        serviço também integram estes Termos. Esta versão precisa de revisão
        jurídica antes da entrada em produção.
      </div>

      <LegalSection id="s1" title="1. Identificação e objeto">
        <p>
          O Rápido Doutor é uma plataforma digital operada por {legalConfig.legalName},
          inscrita no CNPJ sob o número {legalConfig.cnpj}, com endereço em{' '}
          {legalConfig.companyAddress}, {legalConfig.companyCityState}, doravante
          denominada “Rápido Doutor” ou “Plataforma”.
        </p>
        <p>
          Estes Termos regulam o acesso e o uso do site, das aplicações e dos
          serviços digitais do Rápido Doutor por pacientes, responsáveis legais,
          profissionais de saúde, clínicas e demais usuários.
        </p>
        <p>
          Ao criar uma conta, solicitar um serviço, aceitar um atendimento ou
          utilizar uma funcionalidade da Plataforma, o usuário declara que leu e
          compreendeu estes Termos, sem prejuízo da necessidade de aceites
          específicos que poderão ser apresentados durante determinados fluxos.
        </p>
      </LegalSection>

      <LegalSection id="s2" title="2. Definições">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Paciente:</strong> pessoa que utiliza a Plataforma para buscar, solicitar, agendar ou receber um atendimento ou serviço de saúde.</li>
          <li><strong>Responsável legal:</strong> pessoa autorizada a representar paciente menor de idade ou pessoa legalmente incapaz.</li>
          <li><strong>Profissional:</strong> médico, psicólogo ou outro profissional de saúde regularmente habilitado e autorizado a prestar os serviços disponibilizados na Plataforma.</li>
          <li><strong>Consulta Agora:</strong> modalidade em que uma solicitação de atendimento é disponibilizada a profissionais elegíveis e poderá ser aceita por um deles.</li>
          <li><strong>Agendamento por especialidade:</strong> modalidade em que o paciente solicita um horário ou período para determinada especialidade, e um profissional elegível poderá aceitar a solicitação.</li>
          <li><strong>Consulta pelo perfil:</strong> modalidade em que o paciente escolhe diretamente um profissional e um horário disponibilizado por ele.</li>
          <li><strong>Teleconsulta:</strong> atendimento remoto mediado por tecnologias digitais de comunicação.</li>
          <li><strong>Serviços adicionais:</strong> serviços como análise de solicitação de renovação de receita, solicitação de exames, check-up, avaliação de documentos e emissão de laudos, sempre sujeitos à avaliação de profissional habilitado.</li>
        </ul>
      </LegalSection>

      <LegalSection id="s3" title="3. Natureza da Plataforma">
        <p>O Rápido Doutor fornece infraestrutura tecnológica para cadastro, busca, comunicação, agendamento, pagamento, atendimento remoto, organização de solicitações e disponibilização segura de informações e documentos.</p>
        <p>A participação da Plataforma na organização, intermediação ou cobrança dos serviços não substitui a autonomia técnica do profissional de saúde.</p>
        <p>O profissional é responsável pelas decisões clínicas que adotar, incluindo avaliação, diagnóstico, prescrição, solicitação de exames, emissão de documentos, orientação terapêutica, encaminhamento e definição da necessidade de atendimento presencial.</p>
        <p>O Rápido Doutor permanece responsável pelas obrigações que lhe cabem como fornecedor da infraestrutura tecnológica e dos serviços administrativos e comerciais que efetivamente prestar.</p>
        <p>Nenhuma disposição destes Termos deve ser interpretada como exclusão de direitos obrigatórios previstos na legislação aplicável.</p>
      </LegalSection>

      <LegalSection id="s4" title="4. Cadastro e segurança da conta">
        <p>O usuário deverá fornecer informações verdadeiras, completas e atualizadas.</p>
        <p>É proibido criar conta em nome de terceiro sem autorização, utilizar identidade falsa, omitir informações relevantes ou fornecer documentos adulterados.</p>
        <p>As credenciais de acesso são pessoais e não devem ser compartilhadas.</p>
        <p>O usuário deverá comunicar ao Rápido Doutor qualquer suspeita de acesso indevido, perda de senha, fraude ou comprometimento de sua conta.</p>
        <p>O usuário é responsável por manter seus dados atualizados, especialmente nome, documento de identificação, data de nascimento, telefone, e-mail, endereço e informações necessárias ao atendimento.</p>
        <p>A Plataforma poderá solicitar validação adicional de identidade ou documentação quando isso for necessário para segurança, prevenção de fraude, cumprimento regulatório ou proteção do paciente.</p>
      </LegalSection>

      <LegalSection id="s5" title="5. Menores de idade e representação legal">
        <p>O atendimento de pacientes menores de idade deverá ser solicitado e acompanhado por responsável legal, salvo hipóteses legalmente admitidas e avaliadas pelo profissional responsável.</p>
        <p>O responsável declara possuir legitimidade para representar o menor e deverá fornecer informações verdadeiras.</p>
        <p>A Plataforma poderá solicitar documentos que comprovem identidade, vínculo ou responsabilidade legal.</p>
        <p>O profissional poderá interromper ou recusar o atendimento quando não for possível confirmar a representação, obter informações necessárias ou garantir condições adequadas para o atendimento.</p>
      </LegalSection>

      <LegalSection id="s6" title="6. Modalidades de serviço">
        <LegalSubSection id="s6-1" title="6.1. Consulta Agora">
          <p>Na modalidade Consulta Agora, a solicitação poderá ser disponibilizada a profissionais compatíveis com a especialidade, disponibilidade, habilitação e demais critérios da Plataforma.</p>
          <p>A criação da solicitação não garante atendimento imediato nem aceitação por profissional.</p>
          <p>Antes de um profissional aceitar o atendimento, deverão ser utilizados apenas os dados necessários para avaliar a disponibilidade e a elegibilidade da solicitação.</p>
          <p>Após o aceite, o profissional selecionado poderá acessar as informações necessárias à prestação do atendimento.</p>
          <p>Se nenhum profissional aceitar, a solicitação poderá expirar ou ser cancelada, com tratamento do pagamento conforme as regras apresentadas antes da contratação.</p>
        </LegalSubSection>
        <LegalSubSection id="s6-2" title="6.2. Agendamento por especialidade">
          <p>O paciente poderá solicitar atendimento em uma especialidade, data, horário ou período disponibilizado.</p>
          <p>A solicitação poderá ser oferecida a profissionais elegíveis, e o primeiro profissional que a aceitar poderá assumir o atendimento.</p>
          <p>A confirmação somente ocorrerá após o aceite do profissional e a conclusão das etapas informadas no fluxo.</p>
          <p>A Plataforma poderá apresentar alternativas quando o horário solicitado não estiver disponível.</p>
        </LegalSubSection>
        <LegalSubSection id="s6-3" title="6.3. Consulta pelo perfil do profissional">
          <p>O paciente poderá escolher diretamente um profissional e um horário disponível em seu perfil.</p>
          <p>Nessa modalidade, o preço poderá ser definido pelo próprio profissional, conforme indicado antes da contratação.</p>
          <p>A consulta contratada pelo perfil do profissional, padrão ou prioritária, não é coberta pelos planos da Plataforma e utiliza o preço individual informado no perfil.</p>
        </LegalSubSection>
        <LegalSubSection id="s6-4" title="6.4. Serviços adicionais">
          <p>Serviços como renovação de receita, solicitação de exames, check-up e emissão de laudos não constituem venda automática de documentos.</p>
          <p>Toda solicitação deverá ser analisada por profissional habilitado.</p>
          <p>O profissional poderá solicitar informações adicionais, realizar atendimento, exigir avaliação presencial ou recusar a emissão de documento quando não houver fundamento técnico, ético ou legal.</p>
          <p>A contratação não garante a emissão de receita, atestado, exame, laudo ou qualquer outro documento clínico.</p>
          <p>Quando o serviço não puder ser concluído, o pagamento será tratado conforme a política apresentada antes da contratação.</p>
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="s7" title="7. Atendimento por telemedicina">
        <p>A telemedicina é uma modalidade de atendimento realizada por meio de tecnologias digitais de comunicação.</p>
        <p>O paciente reconhece que o atendimento remoto pode apresentar limitações, especialmente quanto ao exame físico, aferição de sinais, avaliação do ambiente e realização de procedimentos.</p>
        <p>O profissional possui autonomia para concluir que a teleconsulta não é adequada, interromper o atendimento, solicitar avaliação presencial, encaminhar o paciente ou recomendar atendimento de urgência ou emergência.</p>
        <p>Antes da teleconsulta, o paciente poderá ser solicitado a confirmar sua identidade, localização, condições de privacidade, recursos técnicos e ciência das limitações do atendimento remoto.</p>
        <p>O paciente deverá utilizar ambiente reservado, conexão adequada e dispositivo com câmera e microfone, quando esses recursos forem necessários.</p>
        <p>O paciente não deverá gravar, fotografar, transmitir ou divulgar a consulta sem autorização expressa das pessoas envolvidas e sem observância da legislação aplicável.</p>
        <p>A Plataforma não gravará a consulta por padrão. Qualquer futura funcionalidade de gravação deverá possuir informação prévia, finalidade definida e controle específico.</p>
        <p>Problemas técnicos poderão exigir reconexão, reagendamento, mudança de canal ou encaminhamento para outra modalidade, conforme a situação clínica e as regras comerciais apresentadas ao paciente.</p>
        <p>O atendimento será registrado pelo profissional no prontuário ou sistema de registro aplicável.</p>
      </LegalSection>

      <LegalSection id="s8" title="8. Situações de urgência e emergência">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="space-y-3">
              <p className="font-medium text-foreground">O Rápido Doutor não substitui serviços de emergência.</p>
              <p>Em caso de dor intensa no peito, dificuldade importante para respirar, perda de consciência, sinais de acidente vascular cerebral, sangramento intenso, convulsão prolongada, risco de suicídio, reação alérgica grave ou qualquer situação potencialmente fatal, procure imediatamente um serviço presencial de emergência ou contate o SAMU pelo número 192.</p>
            </div>
          </div>
        </div>
        <p>O profissional poderá recomendar a interrupção da teleconsulta e o encaminhamento imediato para atendimento presencial.</p>
      </LegalSection>

      <LegalSection id="s9" title="9. Autonomia do profissional de saúde">
        <p>O profissional possui autonomia técnica, científica e ética.</p>
        <p>O paciente não poderá exigir diagnóstico, prescrição, atestado, afastamento, exame, laudo, encaminhamento ou tratamento específico.</p>
        <p>A emissão de qualquer documento dependerá da avaliação do profissional e do cumprimento das normas aplicáveis.</p>
        <p>A recusa tecnicamente fundamentada não caracteriza falha da Plataforma ou do profissional.</p>
        <p>O paciente deverá informar corretamente sintomas, medicamentos, alergias, antecedentes, resultados de exames e outras informações relevantes.</p>
      </LegalSection>

      <LegalSection id="s10" title="10. Preços e pagamentos">
        <p>O preço, a modalidade, as condições de pagamento e eventuais taxas deverão ser apresentados antes da confirmação da contratação.</p>
        <p>Os preços poderão variar de acordo com a modalidade do serviço, especialidade, profissional, prioridade, horário, cobertura por plano ou outras condições claramente informadas.</p>
        <p>Os pagamentos poderão ser processados por empresas especializadas.</p>
        <p>Os fornecedores de pagamento poderão realizar tratamentos próprios para processamento, segurança, prevenção de fraude, análise de risco, cumprimento de obrigações legais e atendimento ao usuário.</p>
        <p>A Plataforma poderá suspender ou cancelar uma transação diante de indícios de fraude, inconsistência cadastral, falha de pagamento ou determinação legal.</p>
        <p>A conclusão do pagamento não garante emissão de documento clínico ou conduta específica.</p>
      </LegalSection>

      <LegalSection id="s11" title="11. Cancelamentos, atrasos e reembolsos">
        <p>As condições específicas aplicáveis a cada contratação deverão ser apresentadas ao paciente antes da confirmação do pagamento.</p>
        <dl className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div>
            <dt className="text-sm font-medium text-foreground">Prazo de cancelamento sem custo</dt>
            <dd>{legalConfig.cancellationDeadline}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-foreground">Tolerância para atraso do paciente</dt>
            <dd>{legalConfig.patientDelayTolerance}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-foreground">Tolerância para atraso do profissional</dt>
            <dd>{legalConfig.professionalDelayTolerance}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-foreground">Prazo estimado para processamento de estorno</dt>
            <dd>{legalConfig.refundDeadline}</dd>
          </div>
        </dl>
        <p>Quando nenhum profissional aceitar uma solicitação paga, ou quando o atendimento for cancelado exclusivamente pela Plataforma sem prestação do serviço, o paciente terá direito ao tratamento adequado do valor pago, conforme o meio de pagamento e a legislação aplicável.</p>
        <p>O não comparecimento, atraso excessivo ou abandono do atendimento pelo paciente poderá resultar em cobrança total ou parcial, desde que a regra tenha sido apresentada previamente.</p>
        <p>Atraso excessivo ou ausência do profissional poderá gerar reagendamento ou restituição, conforme a escolha disponibilizada ao paciente e as características do serviço.</p>
        <p>O prazo de visualização do crédito dependerá também da instituição financeira, da bandeira do cartão ou do provedor de pagamento.</p>
        <p>O exercício de direitos legalmente assegurados ao consumidor não será limitado por estes Termos.</p>
      </LegalSection>

      <LegalSection id="s12" title="12. Planos da Plataforma, créditos e coberturas">
        <p>Os planos comercializados na Plataforma podem conceder créditos para modalidades e especialidades elegíveis. Eles não devem ser confundidos com seguro-saúde ou plano de saúde regulado, salvo se uma oferta futura for identificada expressamente dessa forma após validação jurídica e regulatória.</p>
        <p>A utilização depende de assinatura ativa, elegibilidade, modalidade, especialidade e crédito disponível. A indicação de um plano não garante cobertura para todos os serviços.</p>
        <p>Consulta Agora e Agendamento por Especialidade podem utilizar cobertura quando o backend confirmar os requisitos e o consumo do crédito.</p>
        <p>O paciente deverá conferir as condições apresentadas antes da contratação.</p>
        <p>A negativa de cobertura poderá resultar na oferta de atendimento particular, caso o paciente concorde.</p>
        <p>Na consulta contratada diretamente pelo perfil do profissional, padrão ou prioritária, não haverá cobertura pelos planos da Plataforma.</p>
      </LegalSection>

      <LegalSection id="s13" title="13. Receitas, atestados, pedidos de exame e laudos">
        <p>Documentos de saúde somente serão emitidos quando o profissional considerar que existem elementos clínicos suficientes.</p>
        <p>Os documentos poderão utilizar assinatura eletrônica ou digital e outros mecanismos de validação admitidos pela regulamentação aplicável.</p>
        <p>O paciente deverá conferir seus dados pessoais antes de utilizar o documento.</p>
        <p>O profissional poderá corrigir erros materiais, mantendo o histórico adequado da alteração.</p>
        <p>A Plataforma poderá disponibilizar documentos em área autenticada ou canal seguro.</p>
        <p>É proibido adulterar, reproduzir fraudulentamente, comercializar ou utilizar documento emitido para finalidade ilícita.</p>
      </LegalSection>

      <LegalSection id="s14" title="14. Condutas proibidas">
        <p>É proibido utilizar o Rápido Doutor para:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>praticar fraude ou falsidade;</li>
          <li>compartilhar conta ou credenciais;</li>
          <li>fornecer informações clínicas deliberadamente falsas;</li>
          <li>assediar, ameaçar ou discriminar profissionais, pacientes ou colaboradores;</li>
          <li>tentar acessar dados de terceiros;</li>
          <li>explorar vulnerabilidades;</li>
          <li>realizar engenharia reversa não autorizada;</li>
          <li>inserir códigos maliciosos;</li>
          <li>interferir no funcionamento da Plataforma;</li>
          <li>gravar ou divulgar atendimento sem autorização;</li>
          <li>solicitar documentos fraudulentos;</li>
          <li>comercializar receitas, atestados ou laudos;</li>
          <li>utilizar o serviço para atividade ilegal;</li>
          <li>copiar ou explorar comercialmente conteúdos protegidos;</li>
          <li>criar avaliações falsas ou manipuladas.</li>
        </ul>
      </LegalSection>

      <LegalSection id="s15" title="15. Avaliações, comentários e conteúdos enviados">
        <p>Quando a Plataforma permitir avaliações, o usuário deverá relatar experiências reais, utilizando linguagem respeitosa e evitando divulgar dados pessoais ou informações de saúde desnecessárias.</p>
        <p>A Plataforma poderá moderar, ocultar ou remover conteúdo que viole estes Termos, direitos de terceiros, sigilo, normas profissionais ou legislação aplicável.</p>
        <p>A moderação não implica obrigação de revisar previamente todo conteúdo publicado.</p>
        <p>O usuário permanece responsável pelo conteúdo que enviar.</p>
      </LegalSection>

      <LegalSection id="s16" title="16. Disponibilidade e manutenção">
        <p>A Plataforma poderá passar por manutenção, atualização ou indisponibilidade temporária.</p>
        <p>O Rápido Doutor adotará medidas razoáveis para preservar a continuidade, mas não garante disponibilidade ininterrupta.</p>
        <p>Quando possível, manutenções programadas relevantes poderão ser comunicadas previamente.</p>
        <p>Falhas de internet, energia, dispositivo, navegador ou serviços de terceiros poderão afetar o atendimento.</p>
      </LegalSection>

      <LegalSection id="s17" title="17. Propriedade intelectual">
        <p>A marca, identidade visual, software, interfaces, textos institucionais, elementos gráficos e demais conteúdos do Rápido Doutor são protegidos pela legislação aplicável.</p>
        <p>O acesso à Plataforma não transfere direitos de propriedade intelectual ao usuário.</p>
        <p>É proibida a reprodução, distribuição, modificação ou exploração não autorizada, sem prejuízo das utilizações permitidas por lei.</p>
      </LegalSection>

      <LegalSection id="s18" title="18. Privacidade e proteção de dados">
        <p>O tratamento de dados pessoais é explicado no Aviso de Privacidade do Rápido Doutor.</p>
        <p>Dados de saúde possuem natureza sensível e receberão tratamento compatível com as finalidades assistenciais, operacionais, legais e de segurança aplicáveis.</p>
        <p>Os papéis de controlador e operador poderão variar conforme a atividade realizada.</p>
        <p>Consulte a página de Privacidade para conhecer categorias de dados, finalidades, compartilhamentos, retenção e direitos dos titulares.</p>
        <p>
          <Link
            to={legalRoutes.privacidade}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-primary hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ShieldCheck className="h-4 w-4" />
            Consultar Aviso de Privacidade
          </Link>
        </p>
      </LegalSection>

      <LegalSection id="s19" title="19. Suspensão e encerramento de conta">
        <p>O usuário poderá solicitar o encerramento de sua conta pelos canais disponibilizados.</p>
        <p>O encerramento da conta não implica eliminação automática de todos os dados, especialmente quando a conservação for necessária para prontuário, cumprimento de obrigação legal, exercício de direitos, prevenção de fraude ou outras hipóteses permitidas.</p>
        <p>A Plataforma poderá restringir ou suspender uma conta diante de indícios de fraude, risco à segurança, violação destes Termos, irregularidade profissional, uso abusivo ou determinação legal.</p>
        <p>Sempre que possível e adequado, o usuário será informado sobre a medida adotada.</p>
      </LegalSection>

      <LegalSection id="s20" title="20. Alterações destes Termos">
        <p>Estes Termos poderão ser atualizados para refletir alterações legais, regulatórias, tecnológicas, operacionais ou comerciais.</p>
        <p>A versão e a data de atualização serão exibidas nesta página.</p>
        <p>Quando uma alteração relevante exigir novo aceite, a Plataforma deverá apresentar a versão atualizada no fluxo apropriado.</p>
      </LegalSection>

      <LegalSection id="s21" title="21. Contato">
        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-medium text-foreground">Suporte geral</dt>
            <dd><LegalEmail value={legalConfig.supportEmail} /></dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-foreground">Suporte para profissionais</dt>
            <dd><LegalEmail value={legalConfig.professionalSupportEmail} /></dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-foreground">Privacidade e proteção de dados</dt>
            <dd><LegalEmail value={legalConfig.privacyEmail} /></dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-foreground">Telefone</dt>
            <dd>{legalConfig.phone}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-foreground">Endereço</dt>
            <dd>{legalConfig.companyAddress}, {legalConfig.companyCityState}</dd>
          </div>
        </dl>
      </LegalSection>

      <LegalSection id="s22" title="22. Legislação aplicável">
        <p>Estes Termos são regidos pela legislação brasileira.</p>
        <p>Nada nestes Termos restringe direitos assegurados ao consumidor ou ao titular de dados pessoais.</p>
        <p>Quando aplicável uma relação de consumo, fica resguardado ao consumidor o direito de utilizar o foro de seu domicílio e os canais administrativos legalmente disponíveis.</p>
        <p>Foro contratual adicional: (VALIDAR COM ASSESSORIA JURÍDICA).</p>
      </LegalSection>

      {/* Bloco de condições específicas para profissionais */}
      <LegalSection id="profissionais" title="Condições específicas para profissionais de saúde">
        <p>Estas condições complementam as regras gerais e se aplicam aos profissionais que utilizam o Rápido Doutor para divulgar perfil, administrar agenda, aceitar solicitações, prestar atendimentos, produzir registros clínicos ou receber pagamentos.</p>

        <LegalSubSection id="prof-1" title="1. Habilitação e credenciamento">
          <p>O profissional declara possuir formação, inscrição e autorizações necessárias para exercer sua atividade.</p>
          <p>O profissional deverá manter atualizados CRM, RQE ou registro em conselho, especialidade, documentos, dados fiscais e informações bancárias.</p>
          <p>A Plataforma poderá verificar documentos, solicitar informações adicionais, suspender cadastros incompletos ou rejeitar credenciamentos que não atendam aos critérios aplicáveis.</p>
          <p>A aprovação na Plataforma não substitui deveres profissionais, éticos, sanitários, fiscais ou regulatórios.</p>
        </LegalSubSection>
        <LegalSubSection id="prof-2" title="2. Perfil profissional">
          <p>O profissional é responsável pela exatidão das informações publicadas em seu perfil.</p>
          <p>É proibido divulgar título, especialidade, experiência, qualificação ou serviço que não possa ser comprovado.</p>
          <p>A fotografia, descrição e demais conteúdos devem respeitar direitos de terceiros e normas do respectivo conselho.</p>
        </LegalSubSection>
        <LegalSubSection id="prof-3" title="3. Agenda e aceite de atendimentos">
          <p>O profissional deverá manter sua disponibilidade atualizada.</p>
          <p>Ao aceitar uma solicitação, compromete-se a realizar o atendimento no horário e nas condições apresentadas, salvo motivo relevante.</p>
          <p>Cancelamentos recorrentes, atrasos injustificados ou ausência poderão resultar em restrição de disponibilidade, revisão cadastral ou suspensão.</p>
          <p>O profissional não deverá acessar dados clínicos além do necessário ao atendimento assumido.</p>
        </LegalSubSection>
        <LegalSubSection id="prof-4" title="4. Responsabilidade assistencial">
          <p>O profissional é responsável pela condução clínica, registro, diagnóstico, prescrição, solicitação de exames, emissão de documentos, orientações e encaminhamentos.</p>
          <p>O profissional deverá respeitar autonomia, sigilo, consentimento, segurança do paciente e normas do respectivo conselho.</p>
          <p>A Plataforma não poderá obrigar o profissional a emitir documento ou adotar conduta contrária à sua avaliação técnica.</p>
        </LegalSubSection>
        <LegalSubSection id="prof-5" title="5. Prontuário e registros">
          <p>O profissional deverá registrar de forma clara, suficiente e tempestiva as informações do atendimento.</p>
          <p>É proibido apagar ou alterar registros clínicos de maneira que comprometa sua integridade.</p>
          <p>Correções deverão preservar histórico e rastreabilidade.</p>
          <p>O profissional deverá acessar prontuários somente quando possuir vínculo assistencial ou autorização legítima.</p>
        </LegalSubSection>
        <LegalSubSection id="prof-6" title="6. Telemedicina">
          <p>O profissional deverá avaliar se a telemedicina é adequada ao caso.</p>
          <p>Quando necessário, deverá recomendar atendimento presencial, urgência ou emergência.</p>
          <p>O profissional deverá utilizar ambiente reservado, dispositivo protegido e conexão compatível.</p>
          <p>É proibido utilizar conta compartilhada ou permitir acesso não autorizado à consulta ou ao prontuário.</p>
        </LegalSubSection>
        <LegalSubSection id="prof-7" title="7. Preços, comissões e repasses">
          <p>Os preços poderão ser definidos pela Plataforma ou pelo profissional, conforme a modalidade.</p>
          <dl className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div>
              <dt className="text-sm font-medium text-foreground">Comissão da Plataforma</dt>
              <dd>(VALIDAR REGRA COMERCIAL)</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground">Prazo de repasse</dt>
              <dd>(VALIDAR REGRA COMERCIAL)</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground">Regras fiscais e emissão de documentos</dt>
              <dd>(VALIDAR REGRA COMERCIAL)</dd>
            </div>
          </dl>
          <p>As condições comerciais específicas deverão ser exibidas ou formalizadas no credenciamento.</p>
        </LegalSubSection>
        <LegalSubSection id="prof-8" title="8. Proteção de dados">
          <p>O profissional deverá tratar dados pessoais exclusivamente para finalidades legítimas relacionadas ao atendimento e às obrigações aplicáveis.</p>
          <p>Quando o profissional determinar as finalidades e decisões clínicas, poderá atuar como controlador dos dados correspondentes.</p>
          <p>Quando a Plataforma processar dados clínicos apenas segundo instruções legítimas do profissional, poderá atuar como operadora.</p>
          <p>As condições aplicáveis a esses tratamentos deverão constar do Acordo de Tratamento de Dados disponível em: {legalConfig.dpaUrl}</p>
          <p>O profissional deverá comunicar imediatamente qualquer suspeita de acesso indevido, perda, divulgação ou incidente envolvendo dados.</p>
        </LegalSubSection>
        <LegalSubSection id="prof-9" title="9. Confidencialidade">
          <p>O dever de confidencialidade permanece mesmo após o encerramento da relação com a Plataforma.</p>
          <p>O profissional não poderá utilizar dados de pacientes para marketing, prospecção, venda, discriminação ou finalidade incompatível sem fundamento jurídico apropriado.</p>
        </LegalSubSection>
        <LegalSubSection id="prof-10" title="10. Suspensão e encerramento">
          <p>A Plataforma poderá suspender o profissional diante de irregularidade cadastral, risco ao paciente, indício de fraude, violação de sigilo, uso indevido, sanção profissional ou descumprimento contratual.</p>
          <p>O encerramento deverá preservar continuidade assistencial, acesso legítimo a registros, obrigações de guarda e direitos dos pacientes.</p>
          <p>Os procedimentos de exportação, transição ou retenção serão definidos conforme a natureza dos dados e as obrigações aplicáveis.</p>
        </LegalSubSection>
      </LegalSection>

      {/* Link para a Central de Ajuda */}
      <p className="text-sm text-muted-foreground">
        Precisa de ajuda para usar a plataforma? Acesse a{' '}
        <Link
          to={legalRoutes.ajuda}
          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          Central de Ajuda
        </Link>
        .
      </p>
    </LegalPageLayout>
  );
}
