import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Calendar, DollarSign, Shield } from 'lucide-react';

const fmt = (v) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

export default function ProfileSidebar({ professional }) {
  return (
    <div className="space-y-4 sticky top-24">
      {/* Booking */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          Agendar Consulta
        </h3>

        {professional.price_standard && (
          <div className="p-3 rounded-xl bg-gray-50 mb-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Padrão</span>
              <span className="font-bold text-emerald-700">{fmt(professional.price_standard)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Agendamento para data futura</p>
          </div>
        )}

        {professional.price_priority && (
          <div className="p-3 rounded-xl bg-amber-50 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Prioritária</span>
              <span className="font-bold text-amber-700">{fmt(professional.price_priority)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Atendimento em até 24h</p>
          </div>
        )}

        <Link to={createPageUrl(`AgendamentoPerfil?professional=${professional.id}`)}>
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 gap-2">
            Agendar Consulta
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>

        {professional.is_on_duty && (
          <Link to={createPageUrl('ConsultaAgora')} className="block mt-2">
            <Button variant="outline" className="w-full h-11 border-amber-200 text-amber-700 hover:bg-amber-50 gap-2">
              <Zap className="w-4 h-4" />
              Entrar na Fila (Plantão)
            </Button>
          </Link>
        )}
      </div>

      {/* Trust badges */}
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Shield className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>Profissional verificado pela plataforma</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <DollarSign className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>Pagamento seguro e criptografado</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Calendar className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>Cancele sem taxa com 24h de antecedência</span>
        </div>
      </div>
    </div>
  );
}