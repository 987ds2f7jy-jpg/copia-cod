
-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- app_users
CREATE TABLE public.app_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'professional', 'admin')),
  session_token TEXT DEFAULT '',
  token_expires_at TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  phone TEXT DEFAULT '',
  cpf TEXT DEFAULT '',
  birth_date TEXT DEFAULT '',
  sex TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  profile_complete BOOLEAN DEFAULT false,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_app_users_email ON public.app_users (email);
CREATE INDEX idx_app_users_session_token ON public.app_users (session_token);

-- patient_profiles
CREATE TABLE public.patient_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  cpf TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  birth_date TEXT DEFAULT '',
  sex TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- professionals
CREATE TABLE public.professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT DEFAULT '',
  full_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  crm TEXT NOT NULL,
  bio TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  rating NUMERIC DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  price_standard NUMERIC DEFAULT 0,
  price_priority NUMERIC DEFAULT 0,
  is_on_duty BOOLEAN DEFAULT false,
  available_days TEXT[] DEFAULT '{}',
  available_hours TEXT[] DEFAULT '{}',
  years_experience INTEGER DEFAULT 0,
  education TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- professional_profiles
CREATE TABLE public.professional_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  profession TEXT NOT NULL,
  specialty TEXT NOT NULL,
  register_number TEXT NOT NULL,
  register_state TEXT NOT NULL,
  rqe TEXT DEFAULT '',
  university TEXT DEFAULT '',
  graduation_year INTEGER DEFAULT 0,
  diploma_url TEXT DEFAULT '',
  sex TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  cpf TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  price_standard NUMERIC DEFAULT 0,
  price_priority NUMERIC DEFAULT 0,
  is_on_duty BOOLEAN DEFAULT false,
  available_days TEXT[] DEFAULT '{}',
  available_hours TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
  perfil_ativo BOOLEAN DEFAULT false,
  prioritario_ativo BOOLEAN DEFAULT false,
  rating NUMERIC DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- professional_public_profiles
CREATE TABLE public.professional_public_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_profile_id TEXT NOT NULL,
  user_id TEXT DEFAULT '',
  full_name TEXT NOT NULL,
  slug TEXT DEFAULT '',
  profession TEXT NOT NULL,
  specialty TEXT NOT NULL,
  register_number TEXT NOT NULL,
  register_state TEXT NOT NULL,
  rqe TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  education TEXT DEFAULT '',
  graduation_year INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  patient_types TEXT[] DEFAULT '{}',
  modality TEXT DEFAULT 'online',
  languages TEXT[] DEFAULT '{}',
  office_city TEXT DEFAULT '',
  office_state TEXT DEFAULT '',
  office_address TEXT DEFAULT '',
  instagram_url TEXT DEFAULT '',
  gallery_urls TEXT[] DEFAULT '{}',
  price_standard NUMERIC DEFAULT 0,
  price_priority NUMERIC DEFAULT 0,
  available_days TEXT[] DEFAULT '{}',
  available_hours TEXT[] DEFAULT '{}',
  is_on_duty BOOLEAN DEFAULT false,
  rating NUMERIC DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  perfil_ativo BOOLEAN DEFAULT false,
  prioritario_ativo BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'suspended')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- professional_banking_data
CREATE TABLE public.professional_banking_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id TEXT NOT NULL,
  tipo_pessoa TEXT DEFAULT 'PF',
  nome_titular TEXT DEFAULT '',
  cpf_cnpj TEXT DEFAULT '',
  tipo_recebimento TEXT DEFAULT 'PIX',
  tipo_chave_pix TEXT DEFAULT 'CPF',
  chave_pix TEXT DEFAULT '',
  banco TEXT DEFAULT '',
  agencia TEXT DEFAULT '',
  conta TEXT DEFAULT '',
  digito_conta TEXT DEFAULT '',
  tipo_conta TEXT DEFAULT 'CORRENTE',
  razao_social TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- appointments
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL,
  patient_name TEXT DEFAULT '',
  patient_email TEXT DEFAULT '',
  professional_id TEXT DEFAULT '',
  professional_name TEXT DEFAULT '',
  specialty TEXT DEFAULT '',
  appointment_type TEXT DEFAULT 'standard',
  scheduled_datetime TEXT DEFAULT '',
  date TEXT DEFAULT '',
  time TEXT DEFAULT '',
  status TEXT DEFAULT 'SOLICITADO',
  price NUMERIC DEFAULT 0,
  symptoms TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  meeting_link TEXT DEFAULT '',
  cancellation_reason TEXT DEFAULT '',
  accepted_at TEXT DEFAULT '',
  consulta_id TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_patient ON public.appointments (patient_id);
CREATE INDEX idx_appointments_professional ON public.appointments (professional_id);

-- availability_slots
CREATE TABLE public.availability_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  time_slot TEXT NOT NULL,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_availability_professional ON public.availability_slots (professional_id);

-- consultas
CREATE TABLE public.consultas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id TEXT NOT NULL,
  paciente_nome TEXT DEFAULT '',
  paciente_email TEXT DEFAULT '',
  profissional_id TEXT NOT NULL,
  profissional_nome TEXT DEFAULT '',
  especialidade TEXT DEFAULT '',
  tipo_consulta TEXT NOT NULL CHECK (tipo_consulta IN ('padrao', 'prioritario', 'especialidade', 'plantao')),
  status TEXT DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'em_atendimento', 'finalizada', 'cancelada')),
  datetime TEXT DEFAULT '',
  descricao_sintomas TEXT DEFAULT '',
  inicio_at TEXT DEFAULT '',
  fim_at TEXT DEFAULT '',
  sala_id TEXT DEFAULT '',
  token_sala TEXT DEFAULT '',
  preco NUMERIC DEFAULT 0,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- mensagem_consulta
CREATE TABLE public.mensagem_consulta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consulta_id TEXT NOT NULL,
  remetente_id TEXT NOT NULL,
  remetente_nome TEXT DEFAULT '',
  remetente_tipo TEXT DEFAULT '',
  mensagem TEXT NOT NULL,
  anexo_url TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- avaliacao_consulta
CREATE TABLE public.avaliacao_consulta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consulta_id TEXT NOT NULL,
  paciente_id TEXT NOT NULL,
  profissional_id TEXT NOT NULL,
  nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- prontuarios
CREATE TABLE public.prontuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consulta_id TEXT NOT NULL,
  paciente_id TEXT DEFAULT '',
  profissional_id TEXT DEFAULT '',
  modo TEXT DEFAULT 'completo',
  motivo_consulta TEXT DEFAULT '',
  historico_risco TEXT DEFAULT '',
  exames_imagem TEXT DEFAULT '',
  exame_fisico TEXT DEFAULT '',
  avaliacao_diagnostico TEXT DEFAULT '',
  recomendacoes TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- questions
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id TEXT DEFAULT '',
  paciente_nome TEXT DEFAULT '',
  specialty TEXT DEFAULT '',
  pergunta TEXT NOT NULL,
  status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'RESPONDIDA')),
  resposta TEXT DEFAULT '',
  answered_by_professional_id TEXT DEFAULT '',
  answered_by_professional_name TEXT DEFAULT '',
  answered_at TEXT DEFAULT '',
  public_profile_id TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- queues
CREATE TABLE public.queues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL,
  patient_name TEXT DEFAULT '',
  patient_email TEXT DEFAULT '',
  specialty TEXT DEFAULT '',
  symptoms TEXT DEFAULT '',
  priority_level TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled', 'em_atendimento')),
  position INTEGER DEFAULT 0,
  estimated_wait_time INTEGER DEFAULT 0,
  assigned_professional_id TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reviews
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id TEXT NOT NULL,
  patient_id TEXT DEFAULT '',
  patient_name TEXT DEFAULT '',
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  comment TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- saques
CREATE TABLE public.saques (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id TEXT NOT NULL,
  valor NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'pago', 'rejeitado')),
  data_solicitacao TEXT DEFAULT '',
  data_processamento TEXT DEFAULT '',
  metodo TEXT DEFAULT '',
  observacao TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add updated_at triggers
CREATE TRIGGER update_app_users_updated_at BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_professionals_updated_at BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_professional_profiles_updated_at BEFORE UPDATE ON public.professional_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_professional_public_profiles_updated_at BEFORE UPDATE ON public.professional_public_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_professional_banking_data_updated_at BEFORE UPDATE ON public.professional_banking_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_availability_slots_updated_at BEFORE UPDATE ON public.availability_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_consultas_updated_at BEFORE UPDATE ON public.consultas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mensagem_consulta_updated_at BEFORE UPDATE ON public.mensagem_consulta FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_avaliacao_consulta_updated_at BEFORE UPDATE ON public.avaliacao_consulta FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_prontuarios_updated_at BEFORE UPDATE ON public.prontuarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON public.queues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_saques_updated_at BEFORE UPDATE ON public.saques FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patient_profiles_updated_at BEFORE UPDATE ON public.patient_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read uploads" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "Anyone can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "Anyone can update uploads" ON storage.objects FOR UPDATE USING (bucket_id = 'uploads');
CREATE POLICY "Anyone can delete uploads" ON storage.objects FOR DELETE USING (bucket_id = 'uploads');
