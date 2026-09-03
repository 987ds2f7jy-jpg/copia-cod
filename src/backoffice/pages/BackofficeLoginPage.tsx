import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBackofficeAuth } from '../hooks/useBackofficeAuth';

export function BackofficeLoginPage() {
  const { session, loading, login } = useBackofficeAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) return <Navigate to="/admin/backoffice/pending-registrations" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/admin/backoffice/pending-registrations', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Não foi possível entrar no backoffice.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><LockKeyhole className="h-5 w-5" /></div>
          <CardTitle>Backoffice administrativo</CardTitle>
          <CardDescription>Use uma conta administrativa exclusiva para acessar esta área.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="backoffice-email">E-mail</Label>
              <Input id="backoffice-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backoffice-password">Senha</Label>
              <Input id="backoffice-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button className="w-full" type="submit" disabled={submitting}>{submitting ? 'Entrando...' : 'Entrar'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
