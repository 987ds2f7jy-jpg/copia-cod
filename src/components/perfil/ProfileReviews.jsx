import React, { useState } from 'react';
import { Star, MessageSquare } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';

const PAGE_SIZE = 5;

function anonymize(name) {
  if (!name) return 'Paciente';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0] + '***';
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
}

export default function ProfileReviews({ reviews }) {
  const [page, setPage] = useState(1);
  const sorted = [...reviews].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const visible = sorted.slice(0, page * PAGE_SIZE);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
          Avaliações dos Pacientes
        </h2>
        <span className="text-sm text-gray-400">{reviews.length} avaliações</span>
      </div>

      {reviews.length === 0 ? (
        <div className="py-10 text-center">
          <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Ainda não há avaliações</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {visible.map(review => (
              <div key={review.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{anonymize(review.patient_name)}</p>
                    {review.created_date && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(review.created_date), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-4 h-4 ${i <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                )}
              </div>
            ))}
          </div>

          {page < totalPages && (
            <Button variant="outline" className="w-full mt-4" onClick={() => setPage(p => p + 1)}>
              Ver mais avaliações
            </Button>
          )}
        </>
      )}
    </div>
  );
}