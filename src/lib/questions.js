export function isQuestionAnswered(question) {
  return (question?.status || '').toUpperCase() === 'RESPONDIDA';
}

export function normalizeQuestion(question, publicProfilesById = {}) {
  const publicProfileId = question?.public_profile_id || question?.answered_by_public_profile_id || '';
  const profile = publicProfilesById[publicProfileId] || null;

  const questionText = question?.pergunta || question?.question_text || '';
  const answerText = question?.resposta || question?.answer_text || '';
  const patientId = question?.paciente_id || question?.patient_id || '';
  const patientName = question?.paciente_nome || question?.patient_name || '';
  const answeredByName =
    question?.answered_by_professional_name ||
    question?.answered_by_name ||
    profile?.full_name ||
    '';

  return {
    ...question,
    patient_id: patientId,
    patient_name: patientName,
    question_text: questionText,
    answer_text: answerText,
    answered_by_name: answeredByName,
    answered_by_specialty: profile?.specialty || question?.answered_by_specialty || '',
    answered_by_photo: profile?.photo_url || question?.answered_by_photo || '',
    answered_by_public_profile_id: publicProfileId,
    is_public: isQuestionAnswered(question),
  };
}

export function normalizeQuestions(questions = [], publicProfilesById = {}) {
  return questions.map((question) => normalizeQuestion(question, publicProfilesById));
}

export function buildQuestionCreatePayload({ user, specialty, questionText }) {
  return {
    paciente_id: user.id,
    paciente_nome: user.full_name,
    specialty,
    pergunta: questionText.trim(),
    status: 'PENDENTE',
  };
}

export function buildQuestionAnswerPayload({ professional, publicProfileId, answer }) {
  return {
    resposta: answer.trim(),
    answered_by_professional_id: professional.id,
    answered_by_professional_name: professional.full_name,
    answered_at: new Date().toISOString(),
    public_profile_id: publicProfileId || '',
    status: 'RESPONDIDA',
  };
}
