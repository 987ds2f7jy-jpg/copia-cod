import React from 'react';
import { Users, CheckCircle, Star, ThumbsUp, Clock } from 'lucide-react';

export default function ProfileMetrics({ appointments, reviews }) {
  const completed = appointments.filter(a => ['completed', 'CONCLUIDO'].includes(a.status));
  const uniquePatients = new Set(completed.map(a => a.patient_id)).size;
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)
    : 0;
  const recommended = reviews.filter(r => r.rating >= 4).length;
  const recRate = reviews.length > 0 ? Math.round((recommended / reviews.length) * 100) : 0;

  const metrics = [
    { icon: CheckCircle, label: 'Consultas realizadas', value: completed.length, color: 'text-emerald-600 bg-emerald-50' },
    { icon: Users, label: 'Pacientes atendidos', value: uniquePatients, color: 'text-indigo-600 bg-indigo-50' },
    { icon: Star, label: 'Nota média', value: avgRating > 0 ? avgRating.toFixed(1) : '—', color: 'text-yellow-600 bg-yellow-50' },
    { icon: ThumbsUp, label: 'Taxa de recomendação', value: reviews.length > 0 ? `${recRate}%` : '—', color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {metrics.map(m => (
        <div key={m.label} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center shrink-0`}>
            <m.icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-900 leading-none">{m.value}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{m.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}