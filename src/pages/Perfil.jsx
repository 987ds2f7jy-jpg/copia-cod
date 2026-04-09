import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  Save,
  Loader2,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function PerfilInner() {
  const { user, updateUser, deactivateAccount } = useAuth();
  const [formData, setFormData] = useState({
    phone: '',
    cpf: '',
    birth_date: '',
    address: '',
    city: '',
    state: '',
  });
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deactivateError, setDeactivateError] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormData({
      phone: user.phone || '',
      cpf: user.cpf || '',
      birth_date: user.birth_date || '',
      address: user.address || '',
      city: user.city || '',
      state: user.state || '',
    });
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: (data) => updateUser(data),
    onMutate: () => {
      setSubmitError('');
      setSaved(false);
    },
    onSuccess: () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    },
    onError: (error) => {
      setSubmitError(error?.message || 'Nao foi possivel salvar as alteracoes.');
    },
  });

  const handleChange = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
    setSaved(false);
    setSubmitError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    updateProfile.mutate(formData);
  };

  const handleDeactivateAccount = async () => {
    setDeactivateError('');

    try {
      await deactivateAccount();
    } catch (error) {
      setDeactivateError(error?.message || 'Nao foi possivel desativar a conta.');
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Meu perfil</h1>
          <p className="text-gray-600">Gerencie suas informacoes pessoais.</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <User className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <CardTitle>{user.full_name}</CardTitle>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefone
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(event) => handleChange('phone', event.target.value)}
                    placeholder="(11) 99999-9999"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(event) => handleChange('cpf', event.target.value)}
                    placeholder="000.000.000-00"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="birth_date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data de nascimento
                </Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={(event) => handleChange('birth_date', event.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereco
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(event) => handleChange('address', event.target.value)}
                  placeholder="Rua, numero, complemento"
                  className="mt-1"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(event) => handleChange('city', event.target.value)}
                    placeholder="Sao Paulo"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(event) => handleChange('state', event.target.value.toUpperCase())}
                    placeholder="SP"
                    className="mt-1"
                  />
                </div>
              </div>

              {submitError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {submitError}
                </div>
              ) : null}

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="gradient-primary h-12 w-full border-0 text-white"
                >
                  {updateProfile.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : saved ? (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saved ? 'Salvo!' : 'Salvar alteracoes'}
                </Button>
              </div>
            </form>

            <div className="mt-8 border-t border-gray-200 pt-6">
              <h3 className="mb-3 text-sm font-medium text-gray-500">Zona de cuidado</h3>
              <p className="mb-4 text-sm text-gray-600">
                A desativacao faz soft-delete da conta e encerra suas sessoes atuais.
              </p>

              {deactivateError ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {deactivateError}
                </div>
              ) : null}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-12 w-full border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Desativar conta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desativar sua conta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sua conta sera marcada como inativa e as sessoes abertas serao encerradas.
                      Depois disso, sera necessario suporte interno para reativacao.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 text-white hover:bg-red-700"
                      onClick={handleDeactivateAccount}
                    >
                      Sim, desativar minha conta
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Perfil() {
  return (
    <ProtectedRoute>
      <PerfilInner />
    </ProtectedRoute>
  );
}
