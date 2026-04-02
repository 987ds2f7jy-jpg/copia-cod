import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/components/AuthContext';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';

function isValidCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cpf[10]);
}

export default function CadastroPaciente() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    full_name: '', email: '', password: '', cpf: '', phone: '', birth_date: '', sex: '',
  });

  const validate = () => {
    const e = {};
    if (!formData.full_name.trim()) e.full_name = 'Nome obrigatório';
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Email inválido';
    if (!formData.password || formData.password.length < 6) e.password = 'Senha deve ter ao menos 6 caracteres';
    if (!isValidCPF(formData.cpf)) e.cpf = 'CPF inválido';
    if (!formData.phone.trim()) e.phone = 'Telefone obrigatório';
    if (!formData.birth_date) e.birth_date = 'Data obrigatória';
    if (!formData.sex) e.sex = 'Sexo obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        role: 'patient',
        cpf: formData.cpf,
        phone: formData.phone,
        birth_date: formData.birth_date,
        sex: formData.sex,
      });
      navigate(createPageUrl('DashboardPaciente'), { replace: true });
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, extra = {}) => (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <Input value={formData[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        className={`mt-1 ${errors[key] ? 'border-red-400' : ''}`} {...extra} />
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 py-12">
      <div className="max-w-lg mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Criar Conta de Paciente</h1>
          <p className="text-gray-600">
            Já tem conta?{' '}
            <Link to={createPageUrl('Entrar')} className="text-emerald-600 underline">Entrar</Link>
          </p>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Dados Pessoais</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {field('full_name', 'Nome completo', { placeholder: 'Seu nome completo' })}
              {field('email', 'Email', { type: 'email', placeholder: 'seu@email.com' })}

              <div>
                <Label className="mb-1 block">Senha</Label>
                <div className="relative mt-1">
                  <Input type={showPass ? 'text' : 'password'} value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres" className={`pr-10 ${errors.password ? 'border-red-400' : ''}`} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowPass(v => !v)}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              {field('cpf', 'CPF', { placeholder: '000.000.000-00' })}
              {field('phone', 'Telefone', { placeholder: '(11) 99999-9999' })}
              {field('birth_date', 'Data de nascimento', { type: 'date' })}

              <div>
                <Label className="mb-1 block">Sexo</Label>
                <Select value={formData.sex} onValueChange={(v) => setFormData({ ...formData, sex: v })}>
                  <SelectTrigger className={errors.sex ? 'border-red-400' : ''}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro / Prefiro não informar</SelectItem>
                  </SelectContent>
                </Select>
                {errors.sex && <p className="text-xs text-red-500 mt-1">{errors.sex}</p>}
              </div>

              {errors.submit && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errors.submit}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Criar Conta
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}