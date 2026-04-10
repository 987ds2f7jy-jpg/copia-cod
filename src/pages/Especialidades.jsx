import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { entities } from '@/client-api/readModels';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import PullToRefresh from '@/components/PullToRefresh';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Star, Clock, ArrowRight,
  Stethoscope, Heart, Brain, Bone, Eye, Baby,
  Activity, Pill, Filter, Users, Leaf, Mic
} from 'lucide-react';

// ── All specialties shown in sidebar ─────────────────────────────────────────
// "name" must match EXACTLY the value saved in the specialty field of ProfessionalPublicProfile
const ALL_SPECIALTIES = [
  // Medicina
  { id: 'Clínico Geral',          name: 'Clínico Geral',          icon: Stethoscope, color: 'bg-emerald-500',  group: 'Medicina' },
  { id: 'Cardiologia',            name: 'Cardiologia',            icon: Heart,       color: 'bg-red-500',     group: 'Medicina' },
  { id: 'Neurologia',             name: 'Neurologia',             icon: Brain,       color: 'bg-purple-500',  group: 'Medicina' },
  { id: 'Ortopedia',              name: 'Ortopedia',              icon: Bone,        color: 'bg-blue-500',    group: 'Medicina' },
  { id: 'Oftalmologia',           name: 'Oftalmologia',           icon: Eye,         color: 'bg-amber-500',   group: 'Medicina' },
  { id: 'Pediatria',              name: 'Pediatria',              icon: Baby,        color: 'bg-pink-500',    group: 'Medicina' },
  { id: 'Dermatologia',           name: 'Dermatologia',           icon: Activity,    color: 'bg-orange-500',  group: 'Medicina' },
  { id: 'Ginecologia',            name: 'Ginecologia',            icon: Heart,       color: 'bg-rose-500',    group: 'Medicina' },
  { id: 'Urologia',               name: 'Urologia',               icon: Activity,    color: 'bg-cyan-500',    group: 'Medicina' },
  { id: 'Psiquiatria',            name: 'Psiquiatria',            icon: Brain,       color: 'bg-indigo-500',  group: 'Medicina' },
  { id: 'Endocrinologia',         name: 'Endocrinologia',         icon: Pill,        color: 'bg-teal-500',    group: 'Medicina' },
  { id: 'Medicina Integrativa',   name: 'Medicina Integrativa',   icon: Leaf,        color: 'bg-green-500',   group: 'Medicina' },
  { id: 'Otorrinolaringologia',   name: 'Otorrinolaringologia',   icon: Mic,         color: 'bg-sky-500',     group: 'Medicina' },
  // Outras profissões
  { id: 'Psicologia Clínica',     name: 'Psicologia Clínica',     icon: Brain,       color: 'bg-violet-500',  group: 'Psicologia' },
  { id: 'Nutrição Clínica',       name: 'Nutrição Clínica',       icon: Leaf,        color: 'bg-lime-500',    group: 'Nutrição' },
  { id: 'Fonoaudiologia Clínica', name: 'Fonoaudiologia Clínica', icon: Mic,         color: 'bg-fuchsia-500', group: 'Fonoaudiologia' },
];

const getSpecData = (specialty) =>
  ALL_SPECIALTIES.find(s => s.id === specialty) || { color: 'bg-gray-400', name: specialty, icon: Stethoscope };

export default function Especialidades() {
  const [searchParams] = useSearchParams();
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // Apply specialty filter from URL param on mount
  useEffect(() => {
    const param = searchParams.get('specialty') || searchParams.get('especialidade');
    if (param) {
      // Find matching specialty (case-insensitive, trim)
      const match = ALL_SPECIALTIES.find(
        s => s.id.toLowerCase() === param.toLowerCase() || s.name.toLowerCase() === param.toLowerCase()
      );
      setSelectedSpecialty(match ? match.id : param);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Only visible professionals: status = 'approved' AND perfil_ativo = true
  const { data: professionals = [], isLoading } = useQuery({
    queryKey: ['professionals', selectedSpecialty],
    queryFn: async () => {
      const filters = { status: 'approved', perfil_ativo: true };
      if (selectedSpecialty) filters.specialty = selectedSpecialty;
      return entities.ProfessionalPublicProfile.filter(filters);
    },
  });

  const filteredProfessionals = professionals.filter(prof =>
    prof.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['professionals'] });
  };

  // Group specialties for sidebar display
  const groups = [
    { label: 'Medicina', items: ALL_SPECIALTIES.filter(s => s.group === 'Medicina') },
    { label: 'Outras Profissões', items: ALL_SPECIALTIES.filter(s => s.group !== 'Medicina') },
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {selectedSpecialty ? `Especialistas em ${selectedSpecialty}` : 'Todos os Profissionais'}
            </h1>
            <p className="text-muted-foreground">
              {selectedSpecialty ? 'Escolha o profissional ideal para você' : 'Selecione uma especialidade ou busque por profissional'}
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24 border-0 shadow-sm bg-card">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Especialidades
                  </h3>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedSpecialty(null)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        !selectedSpecialty ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      Todos
                    </button>
                    {groups.map(group => (
                      <div key={group.label} className="pt-2">
                        <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</p>
                        {group.items.map((spec) => {
                          const Icon = spec.icon;
                          return (
                            <button
                              key={spec.id}
                              onClick={() => setSelectedSpecialty(spec.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                                selectedSpecialty === spec.id
                                  ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600'
                                  : 'hover:bg-muted text-foreground'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{spec.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main */}
            <div className="lg:col-span-3">
              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Buscar por nome ou especialidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 border-0 shadow-sm"
                />
              </div>

              {isLoading ? (
                <div className="grid gap-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="border-0 shadow-sm animate-pulse">
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          <div className="w-20 h-20 bg-gray-200 rounded-xl" />
                          <div className="flex-1 space-y-3">
                            <div className="h-5 bg-gray-200 rounded w-1/3" />
                            <div className="h-4 bg-gray-200 rounded w-1/4" />
                            <div className="h-4 bg-gray-200 rounded w-1/2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredProfessionals.length === 0 ? (
                <Card className="border-0 shadow-sm bg-card">
                  <CardContent className="p-12 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Stethoscope className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">Nenhum profissional encontrado</h3>
                    <p className="text-muted-foreground mb-4">Tente buscar por outra especialidade ou nome</p>
                    <Button onClick={() => { setSelectedSpecialty(null); setSearchTerm(''); }}>
                      Ver todos os profissionais
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredProfessionals.map((professional, index) => {
                    const specData = getSpecData(professional.specialty);
                    const Icon = specData.icon;
                    return (
                      <motion.div
                        key={professional.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-card">
                          <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row gap-4">
                              {/* Photo */}
                              <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                                {professional.photo_url ? (
                                  <img src={professional.photo_url} alt={professional.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Icon className="w-8 h-8 text-muted-foreground" />
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                  <div>
                                    <h3 className="font-semibold text-foreground">
                                      {professional.profession === 'Medicina' ? 'Dr(a). ' : ''}{professional.full_name}
                                    </h3>
                                    <Badge className={`${specData.color} text-white mt-1 text-xs`}>
                                      {professional.specialty}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                    <span className="font-medium">{professional.rating?.toFixed(1) || '—'}</span>
                                    <span className="text-gray-500 text-sm">({professional.total_reviews || 0})</span>
                                  </div>
                                </div>

                                <p className="text-muted-foreground text-sm mt-2 line-clamp-2">
                                  {professional.bio || 'Profissional dedicado ao cuidado da sua saúde.'}
                                </p>

                                {/* Tags */}
                                {professional.tags?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {professional.tags.slice(0, 4).map(tag => (
                                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                                    ))}
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                                  {professional.years_experience > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" />
                                      {professional.years_experience}+ anos
                                    </span>
                                  )}
                                  {professional.patient_types?.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Users className="w-3.5 h-3.5" />
                                      {professional.patient_types.join(', ')}
                                    </span>
                                  )}
                                  {professional.modality && (
                                    <span className="capitalize">{professional.modality}</span>
                                  )}
                                </div>

                                {/* Prices & Actions */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-border">
                                  <div className="flex gap-4">
                                    {professional.price_standard > 0 && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">Padrão</span>
                                        <p className="font-semibold text-emerald-600">R$ {professional.price_standard?.toFixed(2)}</p>
                                      </div>
                                    )}
                                    {professional.price_priority > 0 && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">Prioritária</span>
                                        <p className="font-semibold text-amber-600">R$ {professional.price_priority?.toFixed(2)}</p>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Link to={createPageUrl(`PerfilProfissional?id=${professional.id}`)}>
                                      <Button variant="outline" size="sm">Ver Perfil</Button>
                                    </Link>
                                    <Link to={createPageUrl(`AgendamentoPerfil?professional=${professional.id}`)}>
                                      <Button size="sm" className="gradient-primary border-0 text-white">
                                        Agendar <ArrowRight className="w-4 h-4 ml-1" />
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}
