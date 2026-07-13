import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import LegalPageLayout, { LegalEmail, LegalSection } from '@/components/legal/LegalPageLayout';
import { LEGAL_DOCUMENTS, legalConfig, legalRoutes } from '@/config/legal';

const DOCUMENT = LEGAL_DOCUMENTS.help_center;

const SECTIONS = [
  { id: 'suporte', title: 'Suporte técnico' },
  { id: 'login', title: 'Login e conta' },
  { id: 'pagamentos', title: 'Pagamentos' },
  { id: 'planos', title: 'Planos' },
  { id: 'agendamentos', title: 'Agendamentos' },
  { id: 'teleconsulta', title: 'Teleconsulta' },
  { id: 'documentos', title: 'Documentos médicos' },
  { id: 'privacidade', title: 'Privacidade e direitos' },
  { id: 'reclamacoes', title: 'Reclamações' },
  { id: 'emergencia', title: 'Urgência e emergência' },
];

export default function Ajuda() {
  return (
    <LegalPageLayout
      pageTitle="Central de Ajuda"
      metaTitle="Central de Ajuda | Rápido Doutor"
      metaDescription="Orientações sobre conta, consultas, pagamentos, planos, documentos e privacidade no Rápido Doutor."
      intro="Encontre orientações sobre o uso da plataforma. Dúvidas clínicas devem ser tratadas diretamente com um profissional de saúde."
      version={DOCUMENT.version}
      effectiveDate={DOCUMENT.effectiveDate}
      lastUpdated={DOCUMENT.lastUpdated}
      contactChannel={legalConfig.supportEmail}
      sections={SECTIONS}
      currentRoute={legalRoutes.ajuda}
    >
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">A Central de Ajuda não presta atendimento de emergência.</p>
            <p>Em caso de urgência ou risco à vida, procure imediatamente um serviço presencial adequado ou ligue para o SAMU 192.</p>
          </div>
        </div>
      </div>

      <LegalSection id="suporte" title="Suporte técnico">
        <p>Para falhas de carregamento, erro de tela ou indisponibilidade, informe o horário aproximado, a página utilizada e uma descrição objetiva do problema. Não envie senha, token, prontuário ou documento médico por canais não autorizados.</p>
        <p>Canal de suporte: <LegalEmail value={legalConfig.supportEmail} />. Telefone: {legalConfig.phone}.</p>
      </LegalSection>

      <LegalSection id="login" title="Login, senha e conta">
        <p>Use a opção de recuperação de senha na página de login. Se suspeitar de acesso indevido, altere a senha e procure o suporte.</p>
        <p>Para atualizar cadastro ou desativar a conta, utilize as opções disponíveis no perfil. A desativação não elimina automaticamente registros médicos ou financeiros sujeitos a retenção.</p>
      </LegalSection>

      <LegalSection id="pagamentos" title="Pagamentos">
        <p>Consulte cobranças e respectivos status em “Meus Pagamentos”. O retorno visual do gateway não é prova isolada de pagamento; a liberação depende da confirmação processada pelo backend.</p>
        <p>Para divergência, informe apenas a referência interna exibida na plataforma. Não envie número completo de cartão ou credenciais bancárias.</p>
      </LegalSection>

      <LegalSection id="planos" title="Planos e créditos">
        <p>Planos ativos e créditos disponíveis aparecem em “Meus Planos”. Planos podem cobrir Consulta Agora e Agendamento por Especialidade conforme elegibilidade e saldo.</p>
        <p>Agendamentos feitos diretamente pelo perfil do profissional, padrão ou prioritário, não são cobertos e usam o preço individual do profissional.</p>
      </LegalSection>

      <LegalSection id="agendamentos" title="Agendamentos e Consulta Agora">
        <p>Confira especialidade, profissional, data, horário, modalidade e eventual necessidade de pagamento antes de confirmar.</p>
        <p>Uma solicitação pode depender de aceite profissional. A sala de atendimento somente fica disponível após as confirmações operacionais realizadas pelo backend.</p>
      </LegalSection>

      <LegalSection id="teleconsulta" title="Teleconsulta">
        <p>Antes do horário, teste conexão, câmera e microfone e escolha ambiente reservado. O profissional pode orientar atendimento presencial quando a avaliação remota não for suficiente.</p>
        <p>Não grave nem compartilhe o atendimento sem autorização e fundamento aplicável. Em dificuldade técnica, tente reconectar e consulte o status da consulta na plataforma.</p>
      </LegalSection>

      <LegalSection id="documentos" title="Receitas, exames, atestados e laudos">
        <p>A emissão depende da avaliação e decisão do profissional habilitado. A contratação de um serviço não garante emissão automática de documento.</p>
        <p>Documentos disponíveis devem ser acessados na área autenticada correspondente. Não compartilhe links ou arquivos com pessoas não autorizadas.</p>
      </LegalSection>

      <LegalSection id="privacidade" title="Privacidade e direitos do titular">
        <p>Leia o <Link to={legalRoutes.privacidade} className="text-primary underline">Aviso de Privacidade</Link> para entender categorias de dados, finalidades, fornecedores e direitos.</p>
        <p>Contato de privacidade/encarregado: <LegalEmail value={legalConfig.privacyEmail} />. Solicitações podem exigir verificação de identidade e estão sujeitas a limitações legais e médicas.</p>
      </LegalSection>

      <LegalSection id="reclamacoes" title="Reclamações e contato">
        <p>Reclamações sobre a plataforma podem ser enviadas ao suporte: <LegalEmail value={legalConfig.supportEmail} />.</p>
        <p>Dúvidas sobre conduta ou decisão clínica devem ser discutidas com o profissional responsável, sem prejuízo dos canais institucionais e profissionais aplicáveis.</p>
      </LegalSection>

      <LegalSection id="emergencia" title="Urgência e emergência">
        <p>Não aguarde resposta do suporte, agendamento ou teleconsulta diante de sinais de emergência. Procure serviço de urgência presencial ou ligue para o SAMU 192.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
