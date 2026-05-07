import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { recoverySupabase } from '@/integrations/supabase/recoveryClient';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

function buildRecoverPageUrl(email = '') {
  const basePath = createPageUrl('RecuperarSenha');

  if (!email) {
    return basePath;
  }

  return `${basePath}?email=${encodeURIComponent(email)}`;
}

export default function RecuperarSenha() {
  const { requestPasswordReset, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isResetMode = searchParams.get('mode') === 'reset';
  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [checkingRecovery, setCheckingRecovery] = useState(isResetMode);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (!isResetMode) {
      setCheckingRecovery(false);
      setRecoveryReady(false);
      setAccountEmail('');
      return undefined;
    }

    let isMounted = true;

    const syncRecoverySession = async () => {
      const { data, error: sessionError } = await recoverySupabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setError('Nao foi possivel validar o link de recuperacao. Solicite um novo email.');
        setRecoveryReady(false);
        setCheckingRecovery(false);
        return;
      }

      const session = data.session || null;
      setAccountEmail(session?.user?.email || '');
      setRecoveryReady(Boolean(session));
      setCheckingRecovery(false);
    };

    syncRecoverySession();

    const {
      data: { subscription },
    } = recoverySupabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setAccountEmail(session?.user?.email || '');
        setRecoveryReady(Boolean(session));
        setCheckingRecovery(false);
        setError('');
      }

      if (event === 'SIGNED_OUT') {
        setRecoveryReady(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isResetMode]);

  const handleRequestReset = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setSuccessMessage(
        `Se existir uma conta de paciente ou profissional para ${normalizedEmail}, enviamos um link de recuperacao para o email informado.`,
      );
    } catch (requestError) {
      setError(requestError.message || 'Nao foi possivel enviar o email de recuperacao.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    if (!password || password.length < 6) {
      setError('A nova senha deve ter ao menos 6 caracteres.');
      setSubmitting(false);
      return;
    }

    if (passwordConfirmation !== password) {
      setError('A confirmacao da senha precisa ser igual a nova senha.');
      setSubmitting(false);
      return;
    }

    try {
      await resetPassword(password);

      try {
        await recoverySupabase.auth.signOut();
      } catch {
        // Best effort only. The user can still return to login after resetting the password.
      }

      navigate(`${createPageUrl('Entrar')}?reset=success`, { replace: true });
    } catch (resetError) {
      setError(resetError.message || 'Nao foi possivel redefinir a senha.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestNewLink = async () => {
    setError('');
    setSuccessMessage('');
    setPassword('');
    setPasswordConfirmation('');

    try {
      await recoverySupabase.auth.signOut();
    } catch {
      // Ignore recovery-session cleanup failures.
    }

    navigate(buildRecoverPageUrl(accountEmail || email), { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-12 dark:from-slate-950 dark:via-background dark:to-emerald-950/30">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to={createPageUrl('Home')} className="mb-6 inline-flex items-center gap-2">
            <span className="inline-flex h-10 w-10 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5">
              <img
                src="/rapido-doutor-logo.png"
                alt="Rápido Doutor"
                className="h-full w-full object-cover"
              />
            </span>
            <span className="text-2xl font-bold text-foreground">Rápido Doutor</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            {isResetMode ? 'Criar nova senha' : 'Recuperar senha'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isResetMode
              ? 'Confirme sua nova senha para voltar a acessar sua conta.'
              : 'Enviaremos um link por email para voce redefinir sua senha.'}
          </p>
        </div>

        <Card className="border border-border shadow-xl">
          <CardContent className="p-6">
            {checkingRecovery ? (
              <div className="space-y-4 py-6 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
                <div>
                  <p className="font-medium text-foreground">Validando seu link de recuperacao</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Aguarde enquanto confirmamos a sessao enviada por email.
                  </p>
                </div>
              </div>
            ) : isResetMode && !recoveryReady ? (
              <div className="space-y-5">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  Abra novamente o link enviado por email ou solicite um novo link de recuperacao para continuar.
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    onClick={handleRequestNewLink}
                    className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Mail className="h-4 w-4" />
                    Solicitar novo link
                  </Button>

                  <Button type="button" variant="outline" asChild className="h-11 w-full">
                    <Link to={createPageUrl('Entrar')}>Voltar para entrar</Link>
                  </Button>
                </div>
              </div>
            ) : isResetMode ? (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Link confirmado</p>
                      <p className="mt-1">
                        {accountEmail
                          ? `Voce esta redefinindo a senha da conta ${accountEmail}.`
                          : 'Voce ja pode informar a nova senha da sua conta.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite sua nova senha"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    placeholder="Repita sua nova senha"
                    className="mt-1"
                  />
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Atualizar senha
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRequestReset} className="space-y-5">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                  Funciona para contas de paciente e profissional. O link sera enviado para o email informado.
                </div>

                <div>
                  <Label htmlFor="recovery-email">Email</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seu@email.com"
                    className="mt-1"
                  />
                </div>

                {successMessage ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                    {successMessage}
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {successMessage ? 'Reenviar link' : 'Enviar link de recuperacao'}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link
                to={createPageUrl('Entrar')}
                className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para entrar
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
