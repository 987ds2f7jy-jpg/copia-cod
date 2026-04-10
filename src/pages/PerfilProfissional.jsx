import React, { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { entities } from '@/client-api/readModels';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Stethoscope, ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

import ProfileHero from '@/components/perfil/ProfileHero';
import ProfileMetrics from '@/components/perfil/ProfileMetrics';
import ProfileAbout from '@/components/perfil/ProfileAbout';
import ProfileReviews from '@/components/perfil/ProfileReviews';
import ProfileQuestions from '@/components/perfil/ProfileQuestions';
import ProfileCalendar from '@/components/perfil/ProfileCalendar';
import ProfileGallery from '@/components/perfil/ProfileGallery';
import ProfileSidebar from '@/components/perfil/ProfileSidebar';
import { normalizeQuestions } from '@/lib/questions';

export default function PerfilProfissional() {
  const [searchParams] = useSearchParams();
  const professionalId = searchParams.get('id');

  // Public profile: only approved professionals are visible
  const { data: professional, isLoading: loadingProf } = useQuery({
    queryKey: ['perfil-professional', professionalId],
    queryFn: async () => {
      if (!professionalId) return null;
      let list = await entities.ProfessionalPublicProfile.filter({ id: professionalId, status: 'approved' });
      if (list && list.length > 0) return list[0];
      list = await entities.ProfessionalPublicProfile.filter({ professional_profile_id: professionalId, status: 'approved' });
      if (list && list.length > 0) return list[0];
      return null;
    },
    enabled: !!professionalId,
    staleTime: 60_000,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['perfil-appts', professionalId],
    queryFn: () => entities.Appointment.filter(
      { professional_id: professional?.professional_profile_id || professionalId, status: 'CONCLUIDO' },
      '-scheduled_datetime', 200
    ),
    enabled: !!professional,
    staleTime: 60_000,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['perfil-reviews', professionalId],
    queryFn: () => entities.Review.filter(
      { professional_id: professional?.professional_profile_id || professionalId },
      '-created_date', 100
    ),
    enabled: !!professional,
    staleTime: 30_000,
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['perfil-questions', professionalId],
    queryFn: () => entities.Question.filter({
      public_profile_id: professionalId,
      status: 'RESPONDIDA',
    }, '-answered_at', 50),
    enabled: !!professionalId,
    staleTime: 60_000,
  });

  const normalizedQuestions = useMemo(
    () => normalizeQuestions(questions, professional ? { [professional.id]: professional } : {}),
    [questions, professional]
  );

  // SEO: set document title dynamically
  useEffect(() => {
    if (professional) {
      const prefix = professional.profession === 'Medicina' ? 'Dr(a). ' : '';
      document.title = `${prefix}${professional.full_name} – ${professional.specialty} | Rápido Doutor`;
    }
    return () => { document.title = 'Rápido Doutor'; };
  }, [professional]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingProf) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // ── Not found / inactive ─────────────────────────────────────────────────
  if (!professional) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Stethoscope className="w-14 h-14 text-gray-200" />
        <h2 className="text-xl font-semibold text-gray-900">Profissional não encontrado</h2>
        <p className="text-gray-400 max-w-xs">Este perfil pode estar inativo ou o link pode estar incorreto.</p>
        <Link to={createPageUrl('Especialidades')}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Ver todos os especialistas
          </Button>
        </Link>
      </div>
    );
  }

  // The professional_profile_id is used for AvailabilitySlot queries
  const profPrivateId = professional.professional_profile_id || professional.id;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-10">
      {/* Hero */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ProfileHero professional={professional} />
      </motion.div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 space-y-5">

        {/* Metrics strip */}
        <ProfileMetrics appointments={appointments} reviews={reviews} />

        {/* Main 2-col layout */}
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <ProfileAbout professional={professional} />
            </motion.div>

            {/* Gallery — shows only if has photos */}
            {professional.gallery_urls?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                <ProfileGallery gallery_urls={professional.gallery_urls} />
              </motion.div>
            )}

            {/* Calendar availability */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <ProfileCalendar professional={{ ...professional, id: profPrivateId }} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <ProfileReviews reviews={reviews} />
            </motion.div>

            {normalizedQuestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <ProfileQuestions questions={normalizedQuestions} />
              </motion.div>
            )}
          </div>

          {/* Right sidebar */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <ProfileSidebar professional={professional} />
          </motion.div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
        <Link to={createPageUrl(`AgendamentoPerfil?professional=${professional.id}`)}>
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 shadow-lg shadow-emerald-200 text-base font-semibold gap-2">
            Agendar Consulta
          </Button>
        </Link>
      </div>
    </div>
  );
}
