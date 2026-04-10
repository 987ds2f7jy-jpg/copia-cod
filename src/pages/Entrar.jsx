import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, Stethoscope } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

function resolveRedirectPath(user) {
  if (user?.role === 'professional') {
    return createPageUrl('DashboardProfissional');
  }

  return createPageUrl('DashboardPaciente');
}

export default function Entrar() {
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const nextPath = sessionStorage.getItem('rd_login_next') || resolveRedirectPath(user);
    sessionStorage.removeItem('rd_login_next');
    navigate(nextPath, { replace: true });
  }, [authLoading, navigate, user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Preencha email e senha.');
      return;
    }

    setLoading(true);

    try {
      const authenticatedUser = await login(email, password);
      const nextPath = sessionStorage.getItem('rd_login_next') || resolveRedirectPath(authenticatedUser);
      sessionStorage.removeItem('rd_login_next');
      navigate(nextPath, { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to={createPageUrl('Home')} className="mb-6 inline-flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span className="text-2xl font-bold text-gray-900">Rapido Doutor</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Entrar na sua conta</h1>
          <p className="mt-1 text-gray-600">Bem-vindo de volta.</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="password">Senha</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Entrar
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              Nao tem conta?{' '}
              <Link
                to={createPageUrl('CadastroPaciente')}
                className="font-medium text-emerald-600 hover:underline"
              >
                Criar conta de paciente
              </Link>
            </div>

            <div className="mt-3 text-center text-sm text-gray-600">
              E profissional de saude?{' '}
              <Link
                to={createPageUrl('CadastroProfissional')}
                className="font-medium text-emerald-600 hover:underline"
              >
                <Stethoscope className="mr-1 inline h-3 w-3" />
                Cadastrar-se como profissional
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
