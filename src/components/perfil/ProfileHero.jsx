import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Award, ArrowRight, Zap, Shield, Calendar, Instagram } from 'lucide-react';
import ProfileShare from './ProfileShare';

const REGISTER_LABEL = {
  Medicina: 'CRM', Psicologia: 'CRP', Nutrição: 'CRN', Fonoaudiologia: 'CREFONO',
};

export default function ProfileHero({ professional }) {
  const rating = professional.rating || 0;
  const totalReviews = professional.total_reviews || 0;
  const regLabel = REGISTER_LABEL[professional.profession] || 'Registro';
  const prefix = professional.profession === 'Medicina' ? 'Dr(a). ' : '';

  return (
    <div className="relative">
      {/* Banner */}
      <div className="h-40 sm:h-52 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 w-32 h-32 rounded-full bg-white" />
          <div className="absolute bottom-0 right-12 w-48 h-48 rounded-full bg-white" />
          <div className="absolute top-8 right-40 w-20 h-20 rounded-full bg-white" />
        </div>
        {professional.is_verified && (
          <div className="absolute top-4 left-4 flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium">
            <Shield className="w-3.5 h-3.5" />
            Verificado
          </div>
        )}
        {/* Share button top right */}
        <div className="absolute top-4 right-4">
          <ProfileShare professional={professional} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="relative -mt-16 sm:-mt-20 pb-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Avatar */}
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-white shadow-xl border-4 border-white shrink-0">
              {professional.photo_url ? (
                <img src={professional.photo_url} alt={professional.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-emerald-50 text-emerald-300 text-4xl font-bold">
                  {professional.full_name?.[0] || '?'}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 pt-2 sm:pt-16 w-full">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {prefix}{professional.full_name}
                    </h1>
                    {professional.is_on_duty && (
                      <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-medium animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Online agora
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge className="bg-emerald-100 text-emerald-700 border-0">{professional.profession}</Badge>
                    <Badge variant="outline" className="text-gray-600">{professional.specialty}</Badge>
                    {professional.register_state && (
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="w-3.5 h-3.5" />
                        {professional.office_state || professional.register_state}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    {professional.register_number && (
                      <span className="font-medium">
                        {regLabel}: {professional.register_number}
                        {professional.register_state ? `/${professional.register_state}` : ''}
                      </span>
                    )}
                    {professional.rqe && (
                      <span className="text-gray-500">RQE: {professional.rqe}</span>
                    )}
                    {professional.graduation_year > 0 && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <Award className="w-4 h-4 text-amber-500" />
                        {new Date().getFullYear() - professional.graduation_year}+ anos de experiência
                      </span>
                    )}
                    {professional.instagram_url && (
                      <a
                        href={professional.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-pink-600 hover:text-pink-700 transition-colors"
                      >
                        <Instagram className="w-4 h-4" />
                        <span className="text-sm">Instagram</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Rating + CTA */}
                <div className="flex flex-col gap-3 lg:items-end">
                  {totalReviews > 0 && (
                    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 px-4 py-2 rounded-xl">
                      <div className="flex">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                        ))}
                      </div>
                      <span className="text-lg font-bold text-gray-900">{rating.toFixed(1)}</span>
                      <span className="text-sm text-gray-500">({totalReviews})</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {professional.is_on_duty && (
                      <Link to={createPageUrl('ConsultaAgora')}>
                        <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0 h-10">
                          <Zap className="w-4 h-4" />
                          Plantão
                        </Button>
                      </Link>
                    )}
                    <Link to={createPageUrl(`AgendamentoPerfil?professional=${professional.id}`)}>
                      <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-0 h-10">
                        <Calendar className="w-4 h-4" />
                        Agendar Consulta
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}