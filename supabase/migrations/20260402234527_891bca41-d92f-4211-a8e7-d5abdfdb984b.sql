
-- Enable RLS on all tables with permissive policies (custom auth, not Supabase Auth)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_banking_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagem_consulta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_consulta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prontuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saques ENABLE ROW LEVEL SECURITY;

-- Permissive policies for all tables (app handles auth via session tokens)
CREATE POLICY "Allow all access" ON public.app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.patient_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.professionals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.professional_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.professional_public_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.professional_banking_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.appointments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.availability_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.consultas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.mensagem_consulta FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.avaliacao_consulta FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.prontuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.queues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.saques FOR ALL USING (true) WITH CHECK (true);
