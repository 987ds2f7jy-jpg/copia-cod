import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getFinanceDashboardRequest, upsertProfessionalBankingDataRequest } from '@/client-api/finance';

export default function BankingDataModal({ open, onOpenChange, professionalId }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    tipo_pessoa: 'PF',
    nome_titular: '',
    cpf_cnpj: '',
    tipo_recebimento: 'PIX',
    tipo_chave_pix: 'CPF',
    chave_pix: '',
    banco: '',
    agencia: '',
    conta: '',
    digito_conta: '',
    tipo_conta: 'CORRENTE',
    razao_social: '',
  });

  const { data: existing } = useQuery({
    queryKey: ['bankingData', professionalId],
    queryFn: async () => {
      const result = await getFinanceDashboardRequest({ appointmentsLimit: 1, saquesLimit: 1 });
      return result?.bankingData ?? null;
    },
    enabled: open,
  });

  useEffect(() => {
    if (existing) setForm(prev => ({ ...prev, ...existing }));
  }, [existing]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const save = useMutation({
    mutationFn: async () => {
      return upsertProfessionalBankingDataRequest({
        tipoPessoa: form.tipo_pessoa,
        nomeTitular: form.nome_titular,
        cpfCnpj: form.cpf_cnpj,
        tipoRecebimento: form.tipo_recebimento,
        tipoChavePix: form.tipo_chave_pix,
        chavePix: form.chave_pix,
        banco: form.banco,
        agencia: form.agencia,
        conta: form.conta,
        digitoConta: form.digito_conta,
        tipoConta: form.tipo_conta,
        razaoSocial: form.razao_social,
      });
    },
    onSuccess: () => {
      toast.success('Dados bancários salvos com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['bankingData', professionalId] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      onOpenChange(false);
    },
    onError: () => toast.error('Erro ao salvar dados bancários.'),
  });

  const isValid = form.nome_titular && form.cpf_cnpj &&
    (form.tipo_recebimento === 'PIX' ? !!form.chave_pix : (form.banco && form.agencia && form.conta));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dados Bancários</DialogTitle>
          <DialogDescription>Para recebimento de saques e emissão de nota fiscal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Tipo pessoa */}
          <div>
            <Label className="mb-1 block">Tipo de Pessoa</Label>
            <Select value={form.tipo_pessoa} onValueChange={v => set('tipo_pessoa', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PF">Pessoa Física</SelectItem>
                <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                <SelectItem value="MEI">MEI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nome titular */}
          <div>
            <Label className="mb-1 block">{form.tipo_pessoa === 'PF' ? 'Nome completo' : 'Razão Social'}</Label>
            <Input value={form.nome_titular} onChange={e => set('nome_titular', e.target.value)}
              placeholder={form.tipo_pessoa === 'PF' ? 'Seu nome completo' : 'Razão social da empresa'} />
          </div>

          {/* CPF / CNPJ */}
          <div>
            <Label className="mb-1 block">{form.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}</Label>
            <Input value={form.cpf_cnpj} onChange={e => set('cpf_cnpj', e.target.value)}
              placeholder={form.tipo_pessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'} />
          </div>

          {/* Tipo recebimento */}
          <div>
            <Label className="mb-1 block">Forma de Recebimento</Label>
            <Select value={form.tipo_recebimento} onValueChange={v => set('tipo_recebimento', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="TRANSFERENCIA">Transferência Bancária (TED)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PIX fields */}
          {form.tipo_recebimento === 'PIX' && (
            <>
              <div>
                <Label className="mb-1 block">Tipo de Chave PIX</Label>
                <Select value={form.tipo_chave_pix} onValueChange={v => set('tipo_chave_pix', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                    <SelectItem value="EMAIL">E-mail</SelectItem>
                    <SelectItem value="TELEFONE">Telefone</SelectItem>
                    <SelectItem value="ALEATORIA">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Chave PIX</Label>
                <Input value={form.chave_pix} onChange={e => set('chave_pix', e.target.value)}
                  placeholder="Digite sua chave PIX" />
              </div>
            </>
          )}

          {/* Transferência fields */}
          {form.tipo_recebimento === 'TRANSFERENCIA' && (
            <>
              <div>
                <Label className="mb-1 block">Banco</Label>
                <Input value={form.banco} onChange={e => set('banco', e.target.value)} placeholder="Ex: Itaú, Bradesco, 001 - Banco do Brasil" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block">Agência</Label>
                  <Input value={form.agencia} onChange={e => set('agencia', e.target.value)} placeholder="1234" />
                </div>
                <div>
                  <Label className="mb-1 block">Tipo de Conta</Label>
                  <Select value={form.tipo_conta} onValueChange={v => set('tipo_conta', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CORRENTE">Corrente</SelectItem>
                      <SelectItem value="POUPANCA">Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="mb-1 block">Conta</Label>
                  <Input value={form.conta} onChange={e => set('conta', e.target.value)} placeholder="12345" />
                </div>
                <div>
                  <Label className="mb-1 block">Dígito</Label>
                  <Input value={form.digito_conta} onChange={e => set('digito_conta', e.target.value)} placeholder="0" />
                </div>
              </div>
            </>
          )}

          <Button
            onClick={() => save.mutate()}
            disabled={!isValid || save.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {save.isPending
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <CheckCircle className="w-4 h-4 mr-2" />
            }
            Salvar Dados Bancários
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}