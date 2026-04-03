import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/components/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope, CheckCircle, ArrowRight, ArrowLeft,
  Loader2, Upload, GraduationCap, Award, User, Camera,
  MapPin, Plus, X, Globe
} from 'lucide-react';
import { toast } from 'sonner';

const PROFESSIONS = ['Medicina', 'Psicologia', 'Nutrição', 'Fonoaudiologia'];

const MEDICAL_SPECIALTIES = [
  'Clínico Geral', 'Cardiologia', 'Neurologia', 'Ortopedia',
  'Oftalmologia', 'Pediatria', 'Dermatologia', 'Ginecologia',
  'Urologia', 'Psiquiatria', 'Endocrinologia', 'Medicina Integrativa',
  'Otorrinolaringologia',
];

const NON_MEDICAL_SPECIALTY = {
  'Psicologia': 'Psicologia Clínica',
  'Nutrição': 'Nutrição Clínica',
  'Fonoaudiologia': 'Fonoaudiologia Clínica',
};

const REGISTER_LABEL = {
  Medicina: 'CRM', Psicologia: 'CRP', Nutrição: 'CRN', Fonoaudiologia: 'CREFONO',
};

const PATIENT_TYPES = ['Criança', 'Adolescente', 'Adulto', 'Idoso'];
const MODALITIES = [
  { value: 'online', label: 'Online' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'ambos', label: 'Online e Presencial' },
];

function generateSlug(name, specialty) {
  const normalize = (str) => str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${normalize(name)}-${normalize(specialty)}`;
}

export default function CadastroProfissional() {
  const navigate = useNavigate();
  const { user: appUser, register } = useAuth();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tagInput, setTagInput] = useState('');

  const [formData, setFormData] = useState({
    // Private (ProfessionalProfile)
    full_name: '',
    profession: '',
    specialty: '',
    register_number: '',
    register_state: '',
    rqe: '',
    university: '',
    graduation_year: '',
    diploma_url: '',
    sex: '',
    phone: '',
    cpf: '',
    // Public (ProfessionalPublicProfile)
    photo_url: '',
    bio: '',
    instagram_url: '',
    patient_types: [],
    tags: [],
    modality: 'online',
    office_city: '',
    office_state: '',
    office_address: '',
    gallery_urls: [],
  });

  useEffect(() => {
    if (appUser) setFormData(prev => ({ ...prev, full_name: appUser.full_name || '' }));
  }, [appUser]);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleProfessionChange = (value) => {
    const auto = NON_MEDICAL_SPECIALTY[value] || '';
    setFormData(prev => ({ ...prev, profession: value, specialty: auto }));
  };

  const handleDiplomaUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('diploma_url', file_url);
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel enviar o diploma.');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('photo_url', file_url);
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel enviar a foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingGallery(true);
    try {
      const uploads = await Promise.all(files.map((file) => base44.integrations.Core.UploadFile({ file })));
      set('gallery_urls', [...formData.gallery_urls, ...uploads.map((upload) => upload.file_url)]);
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel enviar a galeria.');
    } finally {
      setUploadingGallery(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      set('tags', [...formData.tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag) => set('tags', formData.tags.filter(t => t !== tag));

  const togglePatientType = (type) => {
    const curr = formData.patient_types;
    set('patient_types', curr.includes(type) ? curr.filter(t => t !== type) : [...curr, type]);
  };

  const createProfessional = useMutation({
    mutationFn: async (data) => {
      let currentUser = appUser;

      // 1. Create or update user account
      if (!currentUser) {
        if (!email || !password) throw new Error('Informe email e senha para criar sua conta.');
        currentUser = await register({
          full_name: data.full_name,
          email,
          password,
          role: 'professional',
          phone: data.phone,
          cpf: data.cpf,
          sex: data.sex,
        });
      } else {
        await base44.entities.AppUser.update(currentUser.id, { role: 'professional' });
      }

      const graduationYear = parseInt(data.graduation_year) || 0;

      // 2. Create ProfessionalProfile (private — contains CPF, diploma, etc.)
      const privateProfile = await base44.entities.ProfessionalProfile.create({
        user_id: currentUser.id,
        full_name: data.full_name,
        profession: data.profession,
        specialty: data.specialty,
        register_number: data.register_number,
        register_state: data.register_state,
        rqe: data.rqe || '',
        university: data.university,
        graduation_year: graduationYear,
        diploma_url: data.diploma_url,
        sex: data.sex,
        phone: data.phone,
        cpf: data.cpf,
        bio: data.bio,
        photo_url: data.photo_url,
        is_on_duty: false,
        is_verified: false,
        status: 'pending',
        perfil_ativo: false,
        prioritario_ativo: false,
        rating: 0,
        total_reviews: 0,
      });

      // 3. Create ProfessionalPublicProfile (public portfolio — NO sensitive data)
      await base44.entities.ProfessionalPublicProfile.create({
        professional_profile_id: privateProfile.id,
        user_id: currentUser.id,
        full_name: data.full_name,
        slug: generateSlug(data.full_name, data.specialty),
        profession: data.profession,
        specialty: data.specialty,
        register_number: data.register_number,
        register_state: data.register_state,
        rqe: data.rqe || '',
        bio: data.bio,
        photo_url: data.photo_url,
        graduation_year: graduationYear,
        education: data.university || '',
        tags: data.tags,
        patient_types: data.patient_types,
        modality: data.modality,
        office_city: data.office_city,
        office_state: data.office_state,
        office_address: data.office_address,
        instagram_url: data.instagram_url,
        gallery_urls: data.gallery_urls,
        is_on_duty: false,
        rating: 0,
        total_reviews: 0,
        perfil_ativo: false,
        prioritario_ativo: false,
        status: 'pending_review',
      });

      return privateProfile;
    },
    onSuccess: () => setStep(99),
  });

  const registerLabel = REGISTER_LABEL[formData.profession] || 'Registro Profissional';
  // Steps: (Credenciais?) → Dados Pessoais → Formação → Perfil Público → Sucesso
  const totalSteps = appUser ? 3 : 4;

  const isCredentials = !appUser && step === 1;
  const isBasicInfo = (appUser && step === 1) || (!appUser && step === 2);
  const isFormation = (appUser && step === 2) || (!appUser && step === 3);
  const isProfile = (appUser && step === 3) || (!appUser && step === 4);
  const isSuccess = step === 99;

  const prevStep = () => setStep(s => s - 1);
  const nextStep = () => setStep(s => s + 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 mb-4">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cadastro de Profissional</h1>
          <p className="text-gray-600">Junte-se à nossa rede de especialistas</p>
        </div>

        {!isSuccess && (
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((i) => (
                <React.Fragment key={i}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step >= i ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > i ? <CheckCircle className="w-4 h-4" /> : i}
                  </div>
                  {i < totalSteps && <div className={`flex-1 max-w-[32px] h-1 ${step > i ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>

          {/* ── Step: Credentials (not logged in) ── */}
          {isCredentials && (
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle>Criar sua Conta</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="mt-1" />
                </div>
                <div>
                  <Label>Senha (mínimo 6 caracteres)</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" />
                </div>
                <p className="text-sm text-gray-500">
                  Já tem conta?{' '}
                  <Link to={createPageUrl('Entrar')} className="text-emerald-600 underline">Entrar</Link>
                </p>
                <div className="flex justify-end">
                  <Button onClick={nextStep} disabled={!email || !password || password.length < 6} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Continuar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step: Basic Info ── */}
          {isBasicInfo && (
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-emerald-600" />Dados Pessoais e Profissionais</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome completo</Label>
                  <Input value={formData.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Nome Completo" className="mt-1" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>CPF</Label>
                    <Input value={formData.cpf} onChange={(e) => set('cpf', e.target.value)} placeholder="000.000.000-00" className="mt-1" />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input value={formData.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 99999-9999" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Sexo</Label>
                  <Select value={formData.sex} onValueChange={(v) => set('sex', v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Profissão</Label>
                  <Select value={formData.profession} onValueChange={handleProfessionChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione sua profissão" /></SelectTrigger>
                    <SelectContent>
                      {PROFESSIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {formData.profession && (
                  <div>
                    <Label>Especialidade</Label>
                    {formData.profession === 'Medicina' ? (
                      <Select value={formData.specialty} onValueChange={(v) => set('specialty', v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a especialidade" /></SelectTrigger>
                        <SelectContent>
                          {MEDICAL_SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={formData.specialty} disabled className="mt-1 bg-muted" />
                    )}
                  </div>
                )}
                <div className="flex justify-between">
                  {!appUser && <Button variant="outline" onClick={prevStep}><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>}
                  <div className={appUser ? 'ml-auto' : ''}>
                    <Button onClick={nextStep} disabled={!formData.full_name || !formData.profession || !formData.specialty} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      Continuar <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step: Formation & Registration ── */}
          {isFormation && (
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="flex items-center gap-2"><Award className="w-5 h-5 text-emerald-600" />Formação e Registro</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{registerLabel} (Número / Estado)</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <Input className="col-span-2" value={formData.register_number} onChange={(e) => set('register_number', e.target.value)} placeholder="00000" />
                    <Input value={formData.register_state} onChange={(e) => set('register_state', e.target.value.toUpperCase())} placeholder="UF" maxLength={2} />
                  </div>
                </div>
                <div>
                  <Label>Universidade de formação</Label>
                  <Input value={formData.university} onChange={(e) => set('university', e.target.value)} placeholder="Ex: USP, UFPA..." className="mt-1" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Ano de formação</Label>
                    <Input type="number" value={formData.graduation_year} onChange={(e) => set('graduation_year', e.target.value)} placeholder="Ex: 2015" className="mt-1" />
                  </div>
                  <div>
                    <Label>RQE (opcional)</Label>
                    <Input value={formData.rqe} onChange={(e) => set('rqe', e.target.value.replace(/\D/g, ''))} placeholder="Apenas números" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Upload do Diploma <span className="text-red-500">*</span></Label>
                  <div className="mt-1 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
                    {formData.diploma_url ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Diploma enviado com sucesso</span>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleDiplomaUpload} />
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                          {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                          <span className="text-sm">{uploading ? 'Enviando...' : 'Clique para enviar (PDF, JPG, PNG)'}</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
                  <Button onClick={nextStep} disabled={!formData.register_number || !formData.register_state || !formData.university || !formData.graduation_year || !formData.diploma_url} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Continuar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step: Public Profile ── */}
          {isProfile && (
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-emerald-600" />Perfil Público</CardTitle></CardHeader>
              <CardContent className="space-y-5">

                {/* Photo */}
                <div>
                  <Label>Foto de perfil <span className="text-red-500">*</span></Label>
                  <div className="mt-2 flex items-center gap-4">
                    {formData.photo_url ? (
                      <div className="relative">
                        <img src={formData.photo_url} alt="Foto" className="w-20 h-20 rounded-xl object-cover" />
                        <button onClick={() => set('photo_url', '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                      </div>
                    ) : (
                      <label className="cursor-pointer w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-emerald-400 transition-colors">
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                        {uploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <Camera className="w-5 h-5 text-gray-400" />}
                        <span className="text-xs text-gray-400">Upload</span>
                      </label>
                    )}
                    <p className="text-sm text-gray-500">Foto clara, profissional, fundo neutro</p>
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <Label>Sobre você</Label>
                  <Textarea value={formData.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Conte sobre sua experiência, abordagem e como você pode ajudar seus pacientes..." className="mt-1 min-h-[100px]" />
                </div>

                {/* Instagram */}
                <div>
                  <Label className="flex items-center gap-1"><Globe className="w-3 h-3" />Instagram (opcional)</Label>
                  <Input value={formData.instagram_url} onChange={(e) => set('instagram_url', e.target.value)} placeholder="https://instagram.com/seu_perfil" className="mt-1" />
                </div>

                {/* Patient types */}
                <div>
                  <Label>Público atendido</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {PATIENT_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => togglePatientType(type)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                          formData.patient_types.includes(type)
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Experience tags */}
                <div>
                  <Label>Experiência em (áreas de atuação)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      placeholder="Ex: obesidade, hipertensão..."
                      className="flex-1"
                    />
                    <Button type="button" onClick={addTag} variant="outline" size="icon"><Plus className="w-4 h-4" /></Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button onClick={() => removeTag(tag)}><X className="w-3 h-3" /></button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modality */}
                <div>
                  <Label>Modalidade de atendimento</Label>
                  <div className="flex gap-2 mt-2">
                    {MODALITIES.map(m => (
                      <button
                        key={m.value}
                        onClick={() => set('modality', m.value)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                          formData.modality === m.value
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Office address (optional) */}
                {(formData.modality === 'presencial' || formData.modality === 'ambos') && (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                    <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" />Endereço do consultório</Label>
                    <Input value={formData.office_address} onChange={e => set('office_address', e.target.value)} placeholder="Rua, número, bairro" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={formData.office_city} onChange={e => set('office_city', e.target.value)} placeholder="Cidade" />
                      <Input value={formData.office_state} onChange={e => set('office_state', e.target.value.toUpperCase())} placeholder="UF" maxLength={2} />
                    </div>
                  </div>
                )}

                {/* Gallery */}
                <div>
                  <Label>Galeria do consultório (opcional)</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.gallery_urls.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                        <button onClick={() => set('gallery_urls', formData.gallery_urls.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">✕</button>
                      </div>
                    ))}
                    <label className="cursor-pointer w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-emerald-400 transition-colors">
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                      {uploadingGallery ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Plus className="w-4 h-4 text-gray-400" />}
                    </label>
                  </div>
                </div>

                {createProfessional.isError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                    {createProfessional.error?.message || 'Erro ao enviar cadastro.'}
                  </div>
                )}
                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
                  <Button onClick={() => createProfessional.mutate(formData)} disabled={createProfessional.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {createProfessional.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Finalizar Cadastro
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Success ── */}
          {isSuccess && (
            <Card className="border-0 shadow-md">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro Enviado!</h2>
                <p className="text-gray-600 mb-4">Seu perfil está em análise pela nossa equipe.</p>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left mb-6">
                  <p className="text-sm text-amber-800 font-medium mb-1">⚠️ Próximo passo importante</p>
                  <p className="text-sm text-amber-700">
                    Para ativar seu perfil e aparecer nas buscas, acesse o <strong>Dashboard</strong> em <strong>"Meu Perfil"</strong>, complete seus dados (disponibilidade e valores), e ative seu perfil manualmente.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => navigate(createPageUrl('DashboardProfissional'))} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Ir para o Dashboard
                  </Button>
                  <Button variant="outline" onClick={() => navigate(createPageUrl('Home'))}>
                    Voltar ao Início
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </motion.div>
      </div>
    </div>
  );
}
