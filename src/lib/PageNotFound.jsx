import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Stethoscope } from 'lucide-react';

export default function PageNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="relative mb-8">
          <div className="text-[150px] font-bold text-emerald-100 leading-none">404</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
              <Stethoscope className="w-12 h-12 text-emerald-600" />
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Página não encontrada</h1>
        <p className="text-gray-600 mb-8">Parece que você se perdeu. Não se preocupe, vamos te ajudar a voltar.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => window.history.back()} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <Link to={createPageUrl('Home')}>
            <Button className="gradient-primary border-0 text-white flex items-center gap-2 w-full">
              <Home className="w-4 h-4" /> Ir para o Início
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
