import React, { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 4;

function QuestionItem({ question }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <p className="text-sm font-medium text-gray-800 leading-snug">{question.question_text}</p>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0">
          <div className="bg-emerald-50 rounded-xl p-3 border-l-4 border-emerald-400">
            <p className="text-xs text-emerald-600 font-medium mb-1">Resposta do especialista</p>
            <p className="text-sm text-gray-700 leading-relaxed">{question.answer_text}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileQuestions({ questions }) {
  const [page, setPage] = useState(1);
  const answered = questions.filter(q => q.status === 'RESPONDIDA' && q.answer_text);
  const visible = answered.slice(0, page * PAGE_SIZE);

  if (answered.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-purple-500" />
          Perguntas Respondidas
        </h2>
        <span className="text-sm text-gray-400">{answered.length} respostas</span>
      </div>

      <div className="space-y-2">
        {visible.map(q => <QuestionItem key={q.id} question={q} />)}
      </div>

      {visible.length < answered.length && (
        <Button variant="outline" className="w-full mt-4" onClick={() => setPage(p => p + 1)}>
          Ver mais perguntas
        </Button>
      )}
    </div>
  );
}
