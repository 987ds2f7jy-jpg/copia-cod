export const SAQUE_STATUS_META = {
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-blue-100 text-blue-700' },
  pago: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-700' },
  rejeitado: { label: 'Rejeitado', cls: 'bg-red-100 text-red-700' },
};

export function buildWithdrawalMethodSummary(bankingData) {
  if (!bankingData) return '';

  if (bankingData.tipo_recebimento === 'PIX') {
    const chaveTipo = bankingData.tipo_chave_pix || 'CHAVE';
    return `PIX (${chaveTipo}): ${bankingData.chave_pix || ''}`.trim();
  }

  const contaTipo = bankingData.tipo_conta === 'POUPANCA' ? 'Poupanca' : 'Corrente';
  return `${contaTipo} ${bankingData.banco || ''} Ag. ${bankingData.agencia || ''} Conta ${bankingData.conta || ''}-${bankingData.digito_conta || ''}`.trim();
}

export function buildSaquePayload({ professionalId, value, bankingData }) {
  return {
    professional_id: professionalId,
    valor: value,
    status: 'pendente',
    data_solicitacao: new Date().toISOString(),
    metodo: bankingData?.tipo_recebimento || 'PIX',
    observacao: buildWithdrawalMethodSummary(bankingData),
  };
}

export function getSaqueDescriptor(saque) {
  return saque?.observacao || saque?.metodo || '';
}
