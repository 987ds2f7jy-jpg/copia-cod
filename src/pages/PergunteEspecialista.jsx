import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { entities } from '@/client-api/readModels';
import {
  createQuestionRequest,
  deleteQuestionRequest,
} from '@/client-api/questions';
import { useAuth } from '@/components/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPageUrl } from '@/utils';
import { 
  MessageSquare, Send, Clock, CheckCircle, Stethoscope, 
  Loader2, User, Calendar, AlertCircle, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buildQuestionCreatePayload, normalizeQuestions } from '@/lib/questions';

const SPECIALTIES = [
  { id: 'Todas', name: 'Todas as Especialidades' },
  { id: 'Clínico Geral', name: 'Clínico Geral' },
  { id: 'Cardiologia', name: 'Cardiologia' },
  { id: 'Neurologia', name: 'Neurologia' },
  { id: 'Ortopedia', name: 'Ortopedia' },
  { id: 'Oftalmologia', name: 'Oftalmologia' },
  { id: 'Pediatria', name: 'Pediatria' },
  { id: 'Dermatologia', name: 'Dermatologia' },
  { id: 'Ginecologia', name: 'Ginecologia' },
  { id: 'Urologia', name: 'Urologia' },
  { id: 'Psiquiatria', name: 'Psiquiatria' },
  { id: 'Endocrinologia', name: 'Endocrinologia' },
  { id: 'Medicina Integrativa', name: 'Medicina Integrativa' },
  { id: 'Otorrinolaringologia', name: 'Otorrinolaringologia' },
  { id: 'Psicologia', name: 'Psicologia' },
  { id: 'Nutrição', name: 'Nutrição' },
  { id: 'Fonoaudiologia', name: 'Fonoaudiologia' },
];

// Card de resposta pública do fórum
function ForumCard({ question, index }) {
  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Pergunta e resposta */}
            <div className="flex-1 min-w-0">
              <Badge variant="outline" className="text-xs mb-3">
                {question.specialty}
              </Badge>
              <p className="font-medium text-gray-900 mb-4 leading-relaxed">
                {question.question_text}
              </p>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm font-semibold text-emerald-700">
                    Dr(a). {question.answered_by_name}
                  </span>
                  {question.answered_by_specialty && (
                    <span className="text-xs text-emerald-600">· {question.answered_by_specialty}</span>
                  )}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {question.answer_text}
                </p>
              </div>
              {question.answered_at && (
                <p className="text-xs text-gray-400 mt-2">
                  Respondida em {format(new Date(question.answered_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              )}
            </div>

            {/* Card lateral do profissional */}
            {question.answered_by_name && (
              <div className="lg:w-48 shrink-0">
                <div className="border border-gray-100 rounded-xl p-4 text-center bg-gray-50">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                    {question.answered_by_photo ? (
                      <img src={question.answered_by_photo} alt={question.answered_by_name} 
                        className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <Stethoscope className="w-7 h-7 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 leading-tight mb-1">
                    Dr(a). {question.answered_by_name}
                  </p>
                  {question.answered_by_specialty && (
                    <p className="text-xs text-gray-500 mb-3">{question.answered_by_specialty}</p>
                  )}
                  <div className="space-y-2">
                    {question.answered_by_public_profile_id && (
                      <Link to={`${createPageUrl('PerfilProfissional')}?id=${question.answered_by_public_profile_id}`}>
                        <Button variant="outline" size="sm" className="w-full text-xs h-7">
                          Ver Perfil
                        </Button>
                      </Link>
                    )}
                    {question.answered_by_public_profile_id && (
                      <Link to={createPageUrl(`AgendamentoPerfil?professional=${question.answered_by_public_profile_id}`)}>
                        <Button size="sm" className="w-full text-xs h-7 gradient-primary border-0 text-white mt-1">
                          <Calendar className="w-3 h-3 mr-1" />
                          Agendar
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function PergunteEspecialista() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('Todas');
  const [submitted, setSubmitted] = useState(false);

  // Fórum público: apenas perguntas RESPONDIDAS
  const { data: publicQuestions = [], isLoading } = useQuery({
    queryKey: ['forumPublic', filterSpecialty],
    queryFn: () => entities.Question.filter({ status: 'RESPONDIDA' }, '-answered_at', 50),
  });

  const { data: professionalPublicProfiles = [] } = useQuery({
    queryKey: ['forumProfessionalProfiles'],
    queryFn: () => entities.ProfessionalPublicProfile.filter({ status: 'approved' }, '-created_date', 200),
  });

  // Minhas perguntas (paciente)
  const { data: myQuestions = [] } = useQuery({
    queryKey: ['myQuestions', user?.id],
    queryFn: () => entities.Question.filter({ paciente_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const submitQuestion = useMutation({
    mutationFn: ({ specialty, questionText }) => createQuestionRequest({
      specialty,
      questionText,
    }),
    onSuccess: () => {
      setQuestionText('');
      setSelectedSpecialty('');
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['myQuestions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['pendingQuestions'] });
      setTimeout(() => setSubmitted(false), 4000);
    },
  });

  const deleteQuestion = useMutation({
    mutationFn: (id) => deleteQuestionRequest({ questionId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myQuestions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['pendingQuestions'] });
    },
  });

  const publicProfilesById = useMemo(
    () => Object.fromEntries(professionalPublicProfiles.map((profile) => [profile.id, profile])),
    [professionalPublicProfiles]
  );
  const normalizedPublicQuestions = useMemo(
    () => normalizeQuestions(publicQuestions, publicProfilesById),
    [publicQuestions, publicProfilesById]
  );
  const normalizedMyQuestions = useMemo(
    () => normalizeQuestions(myQuestions, publicProfilesById),
    [myQuestions, publicProfilesById]
  );

  const handleSubmit = () => {
    if (!user) {
      window.location.href = createPageUrl('Entrar');
      return;
    }
    if (user.role !== 'patient') return; // só pacientes
    if (!selectedSpecialty || !questionText.trim()) return;

    const payload = buildQuestionCreatePayload({
      user,
      specialty: selectedSpecialty,
      questionText,
    });

    submitQuestion.mutate({
      specialty: payload.specialty,
      questionText: payload.pergunta,
    });
  };

  // Filtrar fórum por especialidade no frontend
  const filteredForum = normalizedPublicQuestions.filter(q =>
    filterSpecialty === 'Todas' || q.specialty === filterSpecialty
  );

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium mb-4">
            <MessageSquare className="w-4 h-4" />
            Fórum Médico
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Pergunte ao Especialista
          </h1>
          <p className="text-muted-foreground">
            Tire dúvidas com profissionais qualificados. Respostas públicas ajudam outros pacientes.
          </p>
        </div>

        <Tabs defaultValue="respostas" className="w-full">
          <TabsList className="w-full bg-card shadow-sm rounded-xl p-1 mb-6">
            <TabsTrigger value="respostas" className="flex-1 text-xs sm:text-sm">Respostas</TabsTrigger>
            <TabsTrigger value="perguntar" className="flex-1 text-xs sm:text-sm">Fazer Pergunta</TabsTrigger>
            {user && (
              <TabsTrigger value="minhas" className="flex-1 text-xs sm:text-sm">
                Minhas Perguntas {normalizedMyQuestions.length > 0 && `(${normalizedMyQuestions.length})`}
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── ABA: RESPOSTAS (FÓRUM PÚBLICO) ── */}
          <TabsContent value="respostas">
            {/* Filtro de especialidade */}
            <div className="mb-5">
              <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
                <SelectTrigger className="h-11 max-w-xs border-0 shadow-sm bg-card">
                  <SelectValue placeholder="Filtrar por especialidade" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border-0 shadow-sm animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-16 bg-gray-100 rounded mt-4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredForum.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhuma pergunta respondida ainda.</p>
                  <p className="text-sm text-gray-400 mt-1">Seja o primeiro a perguntar!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredForum.map((q, i) => (
                  <ForumCard key={q.id} question={q} index={i} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── ABA: FAZER PERGUNTA ── */}
          <TabsContent value="perguntar">
            <Card className="border-0 shadow-md">
              <CardContent className="p-6 space-y-5">
                {!user ? (
                  <div className="text-center py-8">
                    <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">Faça login para enviar uma pergunta</p>
                    <Link to={createPageUrl('Entrar')}>
                      <Button className="gradient-primary border-0 text-white">Entrar</Button>
                    </Link>
                  </div>
                ) : user.role !== 'patient' ? (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700">
                      Apenas pacientes podem fazer perguntas. Profissionais respondem pelo dashboard.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="mb-2 block font-medium">Especialidade</Label>
                      <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecione a especialidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {SPECIALTIES.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedSpecialty === 'Todas' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Qualquer especialista poderá responder sua pergunta.
                        </p>
                      )}
                    </div>

                    <div>
                      <Label className="mb-2 block font-medium">Sua pergunta</Label>
                      <Textarea
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        placeholder="Descreva sua dúvida com detalhes. Quanto mais informações, melhor a resposta..."
                        className="min-h-[150px]"
                        maxLength={2000}
                      />
                      <p className="text-xs text-gray-400 mt-1 text-right">{questionText.length}/2000</p>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-sm text-amber-700">
                        <strong>Importante:</strong> As respostas são orientações gerais e não substituem uma consulta médica. Em caso de emergência, ligue para o SAMU (192).
                      </p>
                    </div>

                    {submitted && (
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="text-emerald-700 text-sm">
                          Pergunta enviada! Acompanhe em "Minhas Perguntas".
                        </span>
                      </div>
                    )}

                    <Button
                      onClick={handleSubmit}
                      disabled={!selectedSpecialty || !questionText.trim() || submitQuestion.isPending}
                      className="w-full h-12 gradient-primary border-0 text-white"
                    >
                      {submitQuestion.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Enviar Pergunta
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ABA: MINHAS PERGUNTAS ── */}
          {user && (
            <TabsContent value="minhas">
              {normalizedMyQuestions.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Você ainda não fez nenhuma pergunta.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                {normalizedMyQuestions.map((q) => (
                    <Card key={q.id} className="border-0 shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{q.specialty}</Badge>
                            <Badge className={
                              q.status === 'RESPONDIDA'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }>
                              {q.status === 'RESPONDIDA' ? (
                                <><CheckCircle className="w-3 h-3 mr-1" />Respondida</>
                              ) : (
                                <><Clock className="w-3 h-3 mr-1" />Aguardando resposta</>
                              )}
                            </Badge>
                          </div>
                          {/* Só pode apagar perguntas pendentes */}
                          {q.status === 'PENDENTE' && (
                            <button
                              onClick={() => deleteQuestion.mutate(q.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Excluir pergunta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <p className="font-medium text-gray-900 mb-3 leading-relaxed">
                          {q.question_text}
                        </p>

                        {q.status === 'RESPONDIDA' && q.answer_text && (
                          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                            <div className="flex items-center gap-2 mb-2">
                              <Stethoscope className="w-4 h-4 text-emerald-600" />
                              <span className="text-sm font-semibold text-emerald-700">
                                Dr(a). {q.answered_by_name || 'Especialista'}
                              </span>
                            </div>
                            <p className="text-gray-700 text-sm leading-relaxed">{q.answer_text}</p>
                          </div>
                        )}

                        {q.status === 'PENDENTE' && (
                          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Enviada {q.created_date ? format(new Date(q.created_date), "dd/MM/yyyy 'às' HH:mm") : ''}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
