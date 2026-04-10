import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthContext';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Shield, ExternalLink, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { mapAdminActionToStatuses } from '@/lib/professionals';
import { getAdminApprovalQueueRequest, reviewProfessionalApplicationRequest } from '@/client-api/professionalDashboard';

const STATUS_COLORS = {
  pending_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-orange-100 text-orange-700',
  pending: 'bg-amber-100 text-amber-700',
};

const STATUS_LABELS = {
  pending_review: 'Aguardando Analise',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  suspended: 'Suspenso',
  pending: 'Pendente',
};

export default function AdminAprovacao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('pending_review');

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['admin-public-profiles', filterStatus],
    queryFn: async () => {
      const result = await getAdminApprovalQueueRequest({ status: filterStatus, limit: 100 });
      return result?.publicProfiles || [];
    },
    enabled: user?.role === 'admin',
  });

  const { data: privateProfiles = [] } = useQuery({
    queryKey: ['admin-private-profiles'],
    queryFn: async () => {
      const result = await getAdminApprovalQueueRequest({ status: 'all', limit: 200 });
      return result?.privateProfiles || [];
    },
    enabled: user?.role === 'admin',
  });

  const approvePublicMutation = useMutation({
    mutationFn: async ({ publicProfileId, privateProfileId, action }) => {
      await reviewProfessionalApplicationRequest({ publicProfileId, action });
      const { publicStatus } = mapAdminActionToStatuses(action);
      return { action, newStatus: publicStatus };
    },
    onSuccess: ({ action }) => {
      toast.success(action === 'approve' ? 'Profissional aprovado! Ja aparece na busca.' : action === 'suspend' ? 'Conta suspensa.' : 'Cadastro rejeitado.');
      queryClient.invalidateQueries({ queryKey: ['admin-public-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-private-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    },
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar status'),
  });

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Acesso Restrito</h2>
          <p className="text-gray-500 mt-2">Esta pagina e exclusiva para administradores.</p>
        </div>
      </div>
    );
  }

  const privateMap = Object.fromEntries(privateProfiles.map((profile) => [profile.id, profile]));
  const pendingCount = profiles.filter((profile) => ['pending_review', 'pending'].includes(profile.status)).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Aprovacao de Profissionais</h1>
          <p className="text-gray-500">Gerencie o cadastro dos profissionais na plataforma</p>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'pending_review', label: 'Pendentes', count: pendingCount },
            { key: 'approved', label: 'Aprovados', count: null },
            { key: 'rejected', label: 'Rejeitados', count: null },
            { key: 'suspended', label: 'Suspensos', count: null },
            { key: 'all', label: 'Todos', count: null },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setFilterStatus(filter.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                filterStatus === filter.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {filter.label}
              {filter.count !== null && filter.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  filterStatus === filter.key ? 'bg-white/20' : 'bg-amber-100 text-amber-700'
                }`}
                >
                  {filter.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : profiles.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">Nenhum cadastro neste status</h3>
              <p className="text-gray-400 text-sm mt-1">Novos cadastros aparecerao aqui para analise</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {profiles.map((pub) => {
              const priv = privateMap[pub.professional_profile_id];
              const isPending = ['pending_review', 'pending'].includes(pub.status);

              return (
                <Card key={pub.id} className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        {pub.photo_url
                          ? <img src={pub.photo_url} alt={pub.full_name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xl">{pub.full_name?.[0]}</div>}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-lg">
                              {pub.profession === 'Medicina' ? 'Dr(a). ' : ''}{pub.full_name}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{pub.profession}</Badge>
                              <Badge variant="outline" className="text-xs">{pub.specialty}</Badge>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[pub.status] || 'bg-gray-100 text-gray-600'}`}>
                                {STATUS_LABELS[pub.status] || pub.status}
                              </span>
                            </div>
                          </div>
                          <Link to={createPageUrl(`PerfilProfissional?id=${pub.id}`)}>
                            <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600">
                              <Eye className="w-3.5 h-3.5" />
                              Ver perfil
                            </button>
                          </Link>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-3 text-sm text-gray-600 mb-3">
                          <div>
                            <p className="text-xs text-gray-400">Registro</p>
                            <p className="font-medium">{pub.register_number}/{pub.register_state}</p>
                          </div>
                          {priv?.university && (
                            <div>
                              <p className="text-xs text-gray-400">Universidade</p>
                              <p className="font-medium">{priv.university}</p>
                            </div>
                          )}
                          {priv?.diploma_url && (
                            <div>
                              <p className="text-xs text-gray-400">Diploma</p>
                              <a
                                href={priv.diploma_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-emerald-600 hover:underline font-medium"
                              >
                                Ver documento <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>

                        {pub.bio && (
                          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{pub.bio}</p>
                        )}

                        {isPending && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => approvePublicMutation.mutate({ publicProfileId: pub.id, privateProfileId: pub.professional_profile_id, action: 'approve' })}
                              disabled={approvePublicMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                            >
                              {approvePublicMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approvePublicMutation.mutate({ publicProfileId: pub.id, privateProfileId: pub.professional_profile_id, action: 'reject' })}
                              disabled={approvePublicMutation.isPending}
                              className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Rejeitar
                            </Button>
                          </div>
                        )}
                        {pub.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approvePublicMutation.mutate({ publicProfileId: pub.id, privateProfileId: pub.professional_profile_id, action: 'suspend' })}
                            className="text-orange-600 border-orange-200 hover:bg-orange-50"
                          >
                            Suspender
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
