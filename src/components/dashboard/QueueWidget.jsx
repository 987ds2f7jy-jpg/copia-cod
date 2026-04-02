import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Users, Loader2, Clock } from 'lucide-react';

export default function QueueWidget({ queuePatients, onAccept, accepting }) {
  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" />
            Fila em Tempo Real
          </CardTitle>
          <Badge className={queuePatients.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}>
            {queuePatients.length} aguardando
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {queuePatients.length === 0 ? (
          <div className="px-6 pb-6 text-center">
            <p className="text-sm text-gray-400">Fila vazia</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {queuePatients.map((patient, index) => (
              <div key={patient.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{patient.patient_name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{patient.estimated_wait_time || '?'} min
                    </p>
                  </div>
                </div>
                {patient.priority_level === 'urgent' && (
                  <Badge className="bg-red-100 text-red-700 text-xs shrink-0">Urgente</Badge>
                )}
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 shrink-0"
                  onClick={() => onAccept(patient)}
                  disabled={accepting}
                >
                  {accepting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3 mr-1" />}
                  Atender
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}