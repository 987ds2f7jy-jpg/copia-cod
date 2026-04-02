import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/components/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, Stethoscope } from 'lucide-react';

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699cf7ff429d9e728fec4557/63297c12a_logo.png";

export default function Entrar() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      const next = sessionStorage.getItem('rd_login_next') || createPageUrl('DashboardPaciente');
      sessionStorage.removeItem('rd_login_next');
      navigate(next, { replace: true });
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Preencha email e senha.'); return; }
    setLoading(true);
    try {
      const user = await login(email, password);
      const next = sessionStorage.getItem('rd_login_next') || (
        user.role === 'professional' ? createPageUrl('DashboardProfissional') : createPageUrl('DashboardPaciente')
      );
      sessionStorage.removeItem('rd_login_next');
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to={createPageUrl('Home')} className="inline-flex items-center gap-2 mb-6">
            <img src={LOGO_URL} alt="Rápido Doutor" className="h-10 w-auto" />
            <span className="text-2xl font-bold text-gray-900">Rápido Doutor</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Entrar na sua conta</h1>
          <p className="text-gray-600 mt-1">Bem-vindo de volta!</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <div className="relative mt-1">
                  <Input id="password" type={showPass ? 'text' : 'password'} autoComplete="current-password"
                    value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pr-10" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPass(v => !v)}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Entrar
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              Não tem conta?{' '}
              <Link to={createPageUrl('CadastroPaciente')} className="text-emerald-600 font-medium hover:underline">
                Criar conta de Paciente
              </Link>
            </div>
            <div className="mt-3 text-center text-sm text-gray-600">
              É profissional de saúde?{' '}
              <Link to={createPageUrl('CadastroProfissional')} className="text-emerald-600 font-medium hover:underline">
                <Stethoscope className="w-3 h-3 inline mr-1" />
                Cadastrar-se como Profissional
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}