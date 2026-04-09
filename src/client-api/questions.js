import { invokeEdgeFunction } from './edgeFunctions';

export async function createQuestionRequest({
  specialty,
  questionText,
}) {
  const result = await invokeEdgeFunction('create-question', {
    body: {
      specialty,
      questionText,
    },
    fallbackMessage: 'Nao foi possivel enviar a pergunta.',
  });

  return result?.question ?? null;
}

export async function deleteQuestionRequest({ questionId }) {
  return invokeEdgeFunction('delete-question', {
    body: {
      questionId,
    },
    fallbackMessage: 'Nao foi possivel excluir a pergunta.',
  });
}

export async function answerQuestionRequest({
  questionId,
  answerText,
}) {
  const result = await invokeEdgeFunction('answer-question', {
    body: {
      questionId,
      answerText,
    },
    fallbackMessage: 'Nao foi possivel responder a pergunta.',
  });

  return result?.question ?? null;
}
