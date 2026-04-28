import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function isValidCPF(cpf) {
  const normalizedCpf = String(cpf || '').replace(/\D/g, '');

  if (normalizedCpf.length !== 11 || /^(\d)\1+$/.test(normalizedCpf)) {
    return false;
  }

  let sum = 0;

  for (let index = 0; index < 9; index += 1) {
    sum += Number(normalizedCpf[index]) * (10 - index);
  }

  let remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }

  if (remainder !== Number(normalizedCpf[9])) {
    return false;
  }

  sum = 0;

  for (let index = 0; index < 10; index += 1) {
    sum += Number(normalizedCpf[index]) * (11 - index);
  }

  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }

  return remainder === Number(normalizedCpf[10]);
}

export default function CadastroPaciente() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    cpf: '',
    phone: '',
    birth_date: '',
    sex: '',
  });

  const setField = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => ({
      ...current,
      [field]: '',
      submit: '',
    }));
  };

  const validate = () => {
    const nextErrors = {};

    if (!formData.full_name.trim()) {
      nextErrors.full_name = 'Nome obrigatorio.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = 'Email invalido.';
    }

    if (!formData.password || formData.password.length < 6) {
      nextErrors.password = 'Senha deve ter ao menos 6 caracteres.';
    }

    if (!isValidCPF(formData.cpf)) {
      nextErrors.cpf = 'CPF invalido.';
    }

    if (!formData.phone.trim()) {
      nextErrors.phone = 'Telefone obrigatorio.';
    }

    if (!formData.birth_date) {
      nextErrors.birth_date = 'Data obrigatoria.';
    }

    if (!formData.sex) {
      nextErrors.sex = 'Sexo obrigatorio.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

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
    } catch (error) {
      setErrors((current) => ({
        ...current,
        submit: error.message || 'Nao foi possivel concluir o cadastro.',
      }));
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field, label, extraProps = {}) => (
    <div>
      <Label htmlFor={field} className="mb-1 block">{label}</Label>
      <Input
        {...extraProps}
        id={field}
        value={formData[field]}
        onChange={(event) => setField(field, event.target.value)}
        className={`mt-1 ${errors[field] ? 'border-red-400' : ''}`}
      />
      {errors[field] ? (
        <p className="mt-1 text-xs text-red-500">{errors[field]}</p>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 py-12 dark:from-slate-950 dark:via-background dark:to-emerald-950/30">
      <div className="mx-auto max-w-lg px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Criar Conta de Paciente</h1>
          <p className="text-muted-foreground">
            Ja tem conta?{' '}
            <Link to={createPageUrl('Entrar')} className="text-emerald-600 underline">
              Entrar
            </Link>
          </p>
        </motion.div>

        <Card className="border border-border shadow-md">
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              {renderField('full_name', 'Nome completo', {
                placeholder: 'Seu nome completo',
              })}
              {renderField('email', 'Email', {
                type: 'email',
                placeholder: 'seu@email.com',
                autoComplete: 'email',
              })}

              <div>
                <Label htmlFor="password" className="mb-1 block">Senha</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(event) => setField('password', event.target.value)}
                    placeholder="Minimo de 6 caracteres"
                    autoComplete="new-password"
                    className={`pr-10 ${errors.password ? 'border-red-400' : ''}`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? (
                  <p className="mt-1 text-xs text-red-500">{errors.password}</p>
                ) : null}
              </div>

              {renderField('cpf', 'CPF', {
                placeholder: '000.000.000-00',
              })}
              {renderField('phone', 'Telefone', {
                placeholder: '(11) 99999-9999',
              })}
              {renderField('birth_date', 'Data de nascimento', {
                type: 'date',
              })}

              <div>
                <Label className="mb-1 block">Sexo</Label>
                <Select value={formData.sex} onValueChange={(value) => setField('sex', value)}>
                  <SelectTrigger className={errors.sex ? 'border-red-400' : ''}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro / Prefiro nao informar</SelectItem>
                  </SelectContent>
                </Select>
                {errors.sex ? (
                  <p className="mt-1 text-xs text-red-500">{errors.sex}</p>
                ) : null}
              </div>

              {errors.submit ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  {errors.submit}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar conta
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
