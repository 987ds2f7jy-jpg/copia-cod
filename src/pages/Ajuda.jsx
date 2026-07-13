import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Search, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';
import LegalPageLayout, { LegalEmail } from '@/components/legal/LegalPageLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { LEGAL_DOCUMENTS, legalConfig, legalRoutes } from '@/config/legal';

const DOCUMENT = LEGAL_DOCUMENTS.help_center;

const c = legalConfig;

/**
 * Categorias e perguntas da Central de Ajuda.
 * `a` pode ser string (texto simples) ou JSX (quando há e-mail/placeholder).
 * `text` é usado apenas para o filtro local (nunca enviado a servidores).
 */
const CATEGORIES = [
  {
    id: 'primeiros-passos',
    title: '1. Primeiros passos',
    items: [
      {
        id: 'o-que-e',
        q: 'O que é o Rápido Doutor?',
        a: 'O Rápido Doutor é uma plataforma digital que conecta pacientes e profissionais de saúde, permitindo solicitar, agendar, pagar e realizar atendimentos e serviços de forma remota, conforme a modalidade disponível.',
      },
      {
        id: 'preciso-conta',
        q: 'Preciso criar uma conta?',
        a: 'Algumas informações públicas podem ser consultadas sem conta. Para solicitar atendimento, enviar informações, efetuar pagamento, acessar documentos ou utilizar áreas protegidas, será necessário criar e validar uma conta.',
      },
      {
        id: 'conta-segura',
        q: 'Como mantenho minha conta segura?',
        a: 'Utilize senha exclusiva, não compartilhe códigos de acesso, mantenha seu e-mail e telefone atualizados e comunique qualquer atividade suspeita ao suporte.',
      },
      {
        id: 'conta-terceiro',
        q: 'Posso criar uma conta para outra pessoa?',
        a: 'O atendimento de menor ou pessoa representada deverá utilizar o fluxo apropriado de responsável legal ou dependente. Não utilize identidade de terceiro sem autorização.',
      },
    ],
  },
  {
    id: 'modalidades',
    title: '2. Modalidades de consulta',
    items: [
      {
        id: 'consulta-agora',
        q: 'Como funciona a Consulta Agora?',
        a: 'A solicitação é apresentada a profissionais elegíveis e disponíveis. Um profissional poderá aceitar o atendimento. A criação da solicitação não garante atendimento imediato. Se ninguém aceitar, a solicitação poderá expirar e o valor será tratado conforme as regras apresentadas antes do pagamento.',
      },
      {
        id: 'agendamento-especialidade',
        q: 'Como funciona o agendamento por especialidade?',
        a: 'O paciente escolhe a especialidade e uma opção de horário ou período. A solicitação poderá ser aceita por um profissional elegível. A consulta será confirmada após o aceite e as demais etapas indicadas no fluxo.',
      },
      {
        id: 'consulta-perfil',
        q: 'Como funciona a consulta pelo perfil?',
        a: 'O paciente escolhe diretamente um profissional e um horário disponível. Nessa modalidade, o preço poderá ser definido pelo profissional. A consulta pelo perfil não terá cobertura por plano, salvo quando informado expressamente.',
      },
      {
        id: 'quem-escolhe',
        q: 'Quem escolhe o profissional na Consulta Agora?',
        a: 'A solicitação poderá ser disponibilizada a profissionais que atendam aos critérios de especialidade, habilitação e disponibilidade. Um profissional elegível poderá aceitar o caso.',
      },
      {
        id: 'quem-ve-dados',
        q: 'Todos os profissionais veem meus dados de saúde?',
        a: 'Antes do aceite, devem ser utilizados apenas os dados mínimos necessários para avaliar a solicitação. As informações clínicas completas devem ser disponibilizadas ao profissional que assumir legitimamente o atendimento.',
      },
    ],
  },
  {
    id: 'telemedicina',
    title: '3. Telemedicina',
    items: [
      {
        id: 'o-que-preciso',
        q: 'O que preciso para uma teleconsulta?',
        a: 'Você precisará de dispositivo compatível, conexão de internet, câmera e microfone quando exigidos, além de ambiente reservado e iluminado.',
      },
      {
        id: 'substitui-presencial',
        q: 'A teleconsulta substitui qualquer consulta presencial?',
        a: 'Não. O profissional poderá concluir que o atendimento remoto não é suficiente e recomendar avaliação presencial, realização de exame físico, urgência ou emergência.',
      },
      {
        id: 'sera-gravada',
        q: 'A consulta será gravada?',
        a: 'O Rápido Doutor não prevê gravação por padrão. Qualquer funcionalidade futura de gravação deverá ser informada previamente e possuir finalidade e controle específicos.',
      },
      {
        id: 'posso-gravar',
        q: 'Posso gravar a consulta?',
        a: 'Não grave, fotografe ou divulgue a consulta sem autorização e sem observar a legislação e os direitos das pessoas envolvidas.',
      },
      {
        id: 'conexao-cair',
        q: 'O que acontece se a conexão cair?',
        a: 'O profissional e o paciente poderão tentar reconectar. Dependendo da situação, poderá ocorrer mudança de canal, reagendamento, continuidade por meio adequado ou recomendação presencial.',
      },
      {
        id: 'outro-local',
        q: 'Posso receber atendimento estando em outro local?',
        a: 'Informe corretamente sua localização no momento da consulta. A localização pode ser relevante para emergência, regras profissionais, prescrição e encaminhamento.',
      },
    ],
  },
  {
    id: 'urgencia',
    title: '4. Urgência e emergência',
    items: [
      {
        id: 'usar-em-emergencia',
        q: 'Posso usar o Rápido Doutor em uma emergência?',
        a: 'O Rápido Doutor não deve ser utilizado como substituto de emergência. Diante de sintomas graves, procure atendimento presencial imediato ou ligue para o SAMU 192.',
      },
      {
        id: 'sintomas-imediato',
        q: 'Quais sintomas podem exigir atendimento imediato?',
        a: 'Dor intensa no peito, falta de ar importante, desmaio, convulsão prolongada, sangramento intenso, sinais de AVC, reação alérgica grave, trauma importante, confusão intensa ou risco de suicídio exigem avaliação emergencial.',
      },
    ],
  },
  {
    id: 'documentos',
    title: '5. Receitas, exames e laudos',
    items: [
      {
        id: 'garante-receita',
        q: 'A contratação garante uma receita?',
        a: 'Não. A emissão depende da avaliação do profissional e das regras clínicas, éticas e legais.',
      },
      {
        id: 'renovacao-receita',
        q: 'Posso solicitar renovação de receita?',
        a: 'Você poderá enviar uma solicitação quando a modalidade estiver disponível. O profissional poderá pedir informações, realizar consulta, recusar a renovação ou recomendar avaliação presencial.',
      },
      {
        id: 'comprar-atestado',
        q: 'Posso comprar somente um atestado ou laudo?',
        a: 'Não. Documentos de saúde não são vendidos automaticamente. Sua emissão depende de avaliação profissional e fundamento técnico.',
      },
      {
        id: 'receber-documentos',
        q: 'Como receberei meus documentos?',
        a: 'Quando emitidos, os documentos poderão ser disponibilizados na área autenticada ou por outro canal seguro informado no atendimento.',
      },
      {
        id: 'recusar-documento',
        q: 'O profissional pode recusar um documento?',
        a: 'Sim. O profissional possui autonomia e deverá recusar quando não houver elementos clínicos ou fundamento técnico, ético ou legal.',
      },
    ],
  },
  {
    id: 'pagamentos',
    title: '6. Pagamentos',
    items: [
      {
        id: 'quando-preco',
        q: 'Quando vejo o preço?',
        a: 'O preço e as principais condições deverão ser apresentados antes da confirmação do pagamento.',
      },
      {
        id: 'formas-pagamento',
        q: 'Quais formas de pagamento são aceitas?',
        a: '(ADICIONAR FORMAS DE PAGAMENTO DISPONÍVEIS)',
      },
      {
        id: 'pagamento-garante',
        q: 'O pagamento garante a emissão de receita ou atestado?',
        a: 'Não. O pagamento garante o processamento da solicitação ou atendimento contratado, conforme as condições apresentadas, mas não uma conduta clínica específica.',
      },
      {
        id: 'tempo-estorno',
        q: 'Quanto tempo demora um estorno?',
        a: (
          <p>
            O prazo interno estimado é {c.refundDeadline}, mas a visualização do crédito também
            depende da instituição financeira e do meio de pagamento.
          </p>
        ),
        text: `O prazo interno estimado é ${c.refundDeadline}, mas a visualização do crédito também depende da instituição financeira e do meio de pagamento.`,
      },
      {
        id: 'plano-cobre-tudo',
        q: 'O plano de saúde cobre todos os atendimentos?',
        a: 'Não. A cobertura poderá depender do serviço, elegibilidade, autorização e rede. A consulta diretamente pelo perfil do profissional não será coberta, salvo informação expressa em contrário.',
      },
    ],
  },
  {
    id: 'cancelamentos',
    title: '7. Cancelamentos e atrasos',
    items: [
      {
        id: 'cancelar-sem-custo',
        q: 'Até quando posso cancelar sem custo?',
        a: (
          <p>
            O prazo previsto é {c.cancellationDeadline}. A regra específica deverá ser apresentada
            antes da contratação.
          </p>
        ),
        text: `O prazo previsto é ${c.cancellationDeadline}. A regra específica deverá ser apresentada antes da contratação.`,
      },
      {
        id: 'tolerancia-atraso',
        q: 'Qual é a tolerância para atraso?',
        a: (
          <div className="space-y-1">
            <p>Paciente: {c.patientDelayTolerance}</p>
            <p>Profissional: {c.professionalDelayTolerance}</p>
          </div>
        ),
        text: `Paciente: ${c.patientDelayTolerance} Profissional: ${c.professionalDelayTolerance}`,
      },
      {
        id: 'profissional-nao-comparece',
        q: 'O que acontece se o profissional não comparecer?',
        a: 'Poderá ser oferecido reagendamento ou tratamento adequado do valor pago, conforme o serviço e a escolha disponibilizada.',
      },
      {
        id: 'eu-nao-comparecer',
        q: 'O que acontece se eu não comparecer?',
        a: 'O não comparecimento poderá gerar cobrança total ou parcial quando essa condição tiver sido apresentada previamente.',
      },
    ],
  },
  {
    id: 'privacidade',
    title: '8. Privacidade',
    items: [
      {
        id: 'quem-acessa-dados',
        q: 'Quem pode acessar meus dados de saúde?',
        a: 'Somente pessoas e sistemas autorizados e com necessidade legítima, como o profissional responsável pelo atendimento e fornecedores necessários à operação, dentro de suas funções.',
      },
      {
        id: 'funcionarios-prontuario',
        q: 'Todos os funcionários podem ver meu prontuário?',
        a: 'O acesso deve ser limitado de acordo com função, necessidade e autorização. A Plataforma deverá manter controles e registros de acesso adequados.',
      },
      {
        id: 'copia-dados',
        q: 'Posso pedir uma cópia dos meus dados?',
        a: (
          <p>
            Sim. Solicitações poderão ser encaminhadas para <LegalEmail value={c.privacyEmail} />.
            Poderá ser necessário confirmar sua identidade.
          </p>
        ),
        text: `Sim. Solicitações poderão ser encaminhadas para ${c.privacyEmail}. Poderá ser necessário confirmar sua identidade.`,
      },
      {
        id: 'excluir-conta',
        q: 'Excluir minha conta apaga meu prontuário?',
        a: 'Não necessariamente. Dados clínicos, fiscais, de segurança ou necessários ao exercício de direitos poderão precisar ser conservados conforme a legislação.',
      },
      {
        id: 'vende-dados',
        q: 'O Rápido Doutor vende meus dados?',
        a: 'O Rápido Doutor não comercializa prontuários ou dados de saúde como produto. Alguns dados poderão ser compartilhados com fornecedores e participantes necessários à prestação dos serviços, conforme o Aviso de Privacidade.',
      },
      {
        id: 'problema-seguranca',
        q: 'Como comunico um problema de segurança?',
        a: (
          <p>
            Envie uma mensagem para <LegalEmail value={c.privacyEmail} />, informando o ocorrido sem
            incluir publicamente dados clínicos desnecessários.
          </p>
        ),
        text: `Envie uma mensagem para ${c.privacyEmail}, informando o ocorrido sem incluir publicamente dados clínicos desnecessários.`,
      },
    ],
  },
  {
    id: 'profissionais',
    title: '9. Profissionais',
    items: [
      {
        id: 'cadastro-profissional',
        q: 'Como faço meu cadastro profissional?',
        a: 'O credenciamento exigirá informações pessoais, profissionais, fiscais e bancárias, além dos documentos indicados no fluxo.',
      },
      {
        id: 'documentos-solicitados',
        q: 'Quais documentos serão solicitados?',
        a: 'Poderão ser solicitados documento de identificação, registro no conselho, CRM, RQE, comprovantes profissionais, dados fiscais, dados bancários e outros documentos necessários.',
      },
      {
        id: 'compartilhar-conta',
        q: 'Posso compartilhar minha conta com secretária ou equipe?',
        a: 'Não compartilhe credenciais. Quando houver funcionalidade de equipe, cada pessoa deverá possuir acesso próprio e permissões compatíveis com sua função.',
      },
      {
        id: 'quem-define-preco',
        q: 'Quem define o preço?',
        a: 'Na Consulta Agora e no agendamento por especialidade, o preço poderá ser tabelado pela Plataforma. Na consulta pelo perfil, o profissional poderá definir os valores disponibilizados.',
      },
      {
        id: 'repasses',
        q: 'Como funcionam os repasses?',
        a: (
          <div className="space-y-1">
            <p>Prazo de repasse: (ADICIONAR PRAZO DE REPASSE)</p>
            <p>Comissão: (ADICIONAR REGRA DE COMISSÃO)</p>
            <p>As condições completas deverão ser informadas no credenciamento.</p>
          </div>
        ),
        text: 'Prazo de repasse: (ADICIONAR PRAZO DE REPASSE) Comissão: (ADICIONAR REGRA DE COMISSÃO) As condições completas deverão ser informadas no credenciamento.',
      },
      {
        id: 'obrigado-emitir',
        q: 'Sou obrigado a emitir receita ou atestado?',
        a: 'Não. O profissional mantém autonomia técnica e deve emitir documentos somente quando houver fundamento.',
      },
    ],
  },
];

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function itemSearchText(item) {
  const answerText = typeof item.a === 'string' ? item.a : item.text || '';
  return normalize(`${item.q} ${answerText}`);
}

function ContactCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export default function Ajuda() {
  const [query, setQuery] = useState('');

  const normalizedQuery = normalize(query.trim());

  const filtered = useMemo(() => {
    if (!normalizedQuery) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => itemSearchText(item).includes(normalizedQuery)),
    })).filter((cat) => cat.items.length > 0);
  }, [normalizedQuery]);

  const hasResults = filtered.length > 0;

  // Abertura por âncora: se a URL tiver #id de uma pergunta, abrir a categoria correspondente.
  const initialOpen = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const hash = window.location.hash.replace('#', '');
    if (!hash) return {};
    const cat = CATEGORIES.find((cc) => cc.items.some((i) => i.id === hash));
    return cat ? { [cat.id]: [hash] } : {};
  }, []);

  const [openByCat, setOpenByCat] = useState(initialOpen);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const sectionsForNav = CATEGORIES.map((cat) => ({ id: cat.id, title: cat.title }));

  return (
    <LegalPageLayout
      pageTitle="Central de Ajuda"
      metaTitle="Central de Ajuda | Rápido Doutor"
      metaDescription="Encontre respostas sobre consultas, telemedicina, pagamentos, documentos de saúde, privacidade e uso da plataforma."
      intro="Encontre respostas sobre consultas, telemedicina, pagamentos, documentos de saúde, privacidade e uso da plataforma."
      version={DOCUMENT.version}
      effectiveDate={DOCUMENT.effectiveDate}
      lastUpdated={DOCUMENT.lastUpdated}
      contactChannel={legalConfig.supportEmail}
      sections={sectionsForNav}
      currentRoute={legalRoutes.ajuda}
    >
      {/* Alerta de emergência */}
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Precisa de atendimento de emergência?</p>
            <p>
              O Rápido Doutor não substitui serviços de emergência. Em situação potencialmente grave,
              procure uma unidade presencial ou contate o SAMU pelo número 192.
            </p>
          </div>
        </div>
      </div>

      {/* Filtro local (apenas estado local, sem envio a servidores) */}
      <div>
        <label htmlFor="ajuda-busca" className="text-sm font-medium text-foreground">
          Buscar nas perguntas
        </label>
        <div className="relative mt-2">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="ajuda-busca"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite uma palavra, ex.: pagamento, receita, privacidade"
            className="pl-9"
            autoComplete="off"
          />
        </div>
      </div>

      {!hasResults && (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Nenhuma resposta encontrada para esta pesquisa.
        </p>
      )}

      {filtered.map((cat) => (
        <section key={cat.id} id={cat.id} aria-labelledby={`${cat.id}-title`} className="scroll-mt-24">
          <h2
            id={`${cat.id}-title`}
            className="text-xl sm:text-2xl font-semibold text-foreground"
          >
            {cat.title}
          </h2>
          <Accordion
            type="multiple"
            value={openByCat[cat.id] || []}
            onValueChange={(val) => setOpenByCat((prev) => ({ ...prev, [cat.id]: val }))}
            className="mt-3"
          >
            {cat.items.map((item) => (
              <AccordionItem key={item.id} value={item.id} id={item.id} className="scroll-mt-24">
                <AccordionTrigger className="text-left text-base font-medium text-foreground">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                  {typeof item.a === 'string' ? <p>{item.a}</p> : item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}

      {/* Categoria 10 — Contato */}
      <section id="contato" aria-labelledby="contato-title" className="scroll-mt-24">
        <h2 id="contato-title" className="text-xl sm:text-2xl font-semibold text-foreground">
          10. Contato
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ContactCard icon={Mail} title="Suporte ao paciente">
            <p><LegalEmail value={c.supportEmail} /></p>
            <p>{c.phone}</p>
          </ContactCard>
          <ContactCard icon={Mail} title="Suporte ao profissional">
            <p><LegalEmail value={c.professionalSupportEmail} /></p>
          </ContactCard>
          <ContactCard icon={ShieldCheck} title="Privacidade e LGPD">
            <p><LegalEmail value={c.privacyEmail} /></p>
          </ContactCard>
          <ContactCard icon={MapPin} title="Endereço">
            <p>{c.companyAddress}, {c.companyCityState}</p>
          </ContactCard>
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold text-foreground">Consulte também:</p>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link
                to={legalRoutes.termos}
                className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              >
                Termos de Uso
              </Link>
            </li>
            <li>
              <Link
                to={legalRoutes.privacidade}
                className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              >
                Aviso de Privacidade
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </LegalPageLayout>
  );
}
