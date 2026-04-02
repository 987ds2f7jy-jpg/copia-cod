import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { AlertCircle } from 'lucide-react';

export default function UserNotRegisteredError() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Usuário não registrado</h1>
        <p className="text-gray-600 mb-6">Sua conta não está registrada nesta aplicação.</p>
        <Link to={createPageUrl('CadastroPaciente')}>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Criar Conta
          </Button>
        </Link>
      </div>
    </div>
  );
}
