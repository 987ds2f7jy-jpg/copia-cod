import React from 'react';
import { ArrowRight, Clock3, Video } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function buildResumeCopy(activeConsultation) {
  const status = String(activeConsultation?.consultation?.status || '').trim();
  const consultationType = String(activeConsultation?.consultation?.consultationType || '').trim();
  const counterpartName = activeConsultation?.counterpartName || 'o outro participante';
  const counterpartLabel = activeConsultation?.participantRole === 'professional'
    ? counterpartName
    : `Dr(a). ${counterpartName}`;

  if (status === 'em_atendimento' || status === 'in_progress') {
    return {
      title: 'Sua consulta continua em andamento',
      description: `A sala com ${counterpartLabel} continua disponivel para voce retomar agora.`,
    };
  }

  if (consultationType === 'plantao' && status === 'aguardando') {
    return {
      title: 'Seu atendimento imediato continua reservado',
      description: `O plantao com ${counterpartLabel} ainda esta aberto e pode ser retomado sem entrar em outra fila.`,
    };
  }

  if (activeConsultation?.roomReady) {
    return {
      title: 'Sua sala segura ja esta pronta',
      description: `A consulta com ${counterpartLabel} ja pode ser retomada na teleconsulta.`,
    };
  }

  if (activeConsultation?.needsProfessionalStart) {
    return {
      title: 'A consulta ainda aguarda o profissional',
      description: `Seu atendimento com ${counterpartLabel} ja existe, mas a sala segura ainda depende do inicio pelo profissional.`,
    };
  }

  return {
    title: 'Existe uma consulta aberta para retomada',
    description: `Voce pode voltar para a consulta com ${counterpartLabel} sem recriar o fluxo.`,
  };
}

export default function ResumeConsultationCard({
  activeConsultation,
  onResume,
  className = '',
}) {
  if (!activeConsultation?.hasActiveConsultation || !activeConsultation?.consultation?.id) {
    return null;
  }

  const copy = buildResumeCopy(activeConsultation);

  return (
    <Card className={`border-emerald-200 bg-emerald-50/90 shadow-sm ${className}`.trim()}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-emerald-700">
            <Clock3 className="h-3.5 w-3.5" />
            Consulta ativa detectada
          </div>
          <h3 className="text-base font-semibold text-emerald-950">{copy.title}</h3>
          <p className="mt-1 text-sm text-emerald-800">{copy.description}</p>
        </div>

        <Button
          onClick={onResume}
          className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Video className="mr-2 h-4 w-4" />
          Retomar consulta
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
