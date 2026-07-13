# Direitos do Titular e Ciclo da Conta em Staging

## Solicitações

Tipos: `access`, `export`, `correction`, `account_deactivation`,
`deletion_or_anonymization` e `consent_information`.

Status: `submitted`, `in_review`, `awaiting_user`, `approved`,
`partially_approved`, `rejected`, `completed` e `canceled`.

A fila `privacy_rights_requests` é acessada apenas por Edge Functions com
`service_role`. O usuário cria e consulta somente solicitações próprias. A fila
administrativa e a revisão exigem role `admin` e registram auditoria sanitizada.

## Correção

Telefone, endereço, cidade, estado, data de nascimento e preferências já
suportadas continuam corrigíveis pelos endpoints específicos. CPF e nome de
identidade exigem solicitação `correction`. CRM, documentos profissionais,
dados bancários já cadastrados e registros médicos finalizados não devem ser
sobrescritos por este fluxo. Retificação clínica deve preservar histórico por
adendo ou versão, após definição jurídica e clínica.

## Exportação

A exportação é JSON, montada no backend com projeções explícitas e limite de
5 MB. O arquivo fica no bucket privado `privacy-exports`, em path pertencente ao
usuário e à solicitação. A URL assinada dura 5 minutos. Conteúdo de providers,
notas administrativas, logs antifraude e dados clínicos de terceiros são
excluídos. A remoção física periódica dos arquivos expirados ainda precisa de
rotina operacional antes da produção.

## Desativação, anonimização e exclusão

Desativação é reversível administrativamente, invalida sessões e não remove o
usuário do Supabase Auth. Ela é bloqueada quando há atendimento ativo e preserva
dados clínicos, financeiros, jurídicos e de auditoria.

Exclusão ou anonimização é somente uma solicitação administrativa. Esta fase não
possui ação de apagar tudo, hard delete de Auth ou anonimização automática. Os
códigos possíveis incluem `full_deletion_possible`, `partial_anonymization`,
`retention_required`, `identity_verification_required`,
`active_relationship_block` e `legal_or_regulatory_hold`.

## Retenção a definir

| Categoria | Evento inicial | Ação futura | Responsável e prazo |
| --- | --- | --- | --- |
| Dados clínicos e documentos médicos | encerramento do atendimento ou emissão | conservar, restringir, anonimizar ou eliminar conforme obrigação aplicável | (VALIDAR COM RESPONSÁVEL TÉCNICO E JURÍDICO) |
| Financeiros e contratuais | transação ou encerramento contratual | conservar pelo período aplicável e eliminar quando permitido | (VALIDAR COM FINANCEIRO/JURÍDICO) |
| Eventos jurídicos e consentimentos | registro do evento | preservar evidência e limitar acesso | (VALIDAR COM PRIVACIDADE/JURÍDICO) |
| Segurança e auditoria | ocorrência do evento | retenção proporcional e descarte seguro | (VALIDAR COM SEGURANÇA/PRIVACIDADE) |
| Cadastro | desativação ou término da relação | corrigir, anonimizar ou eliminar quando cabível | (VALIDAR COM PRIVACIDADE/JURÍDICO) |
| Marketing | revogação ou término da finalidade | excluir ou bloquear | (NÃO IMPLEMENTADO; VALIDAR FUTURAMENTE) |
| Exportações temporárias | geração do arquivo | remover do Storage após expiração operacional | URL: 5 minutos; arquivo: (DEFINIR ROTINA E PRAZO) |

## Deploy manual

```powershell
npx supabase db push --linked
npx supabase functions deploy create-privacy-rights-request --no-verify-jwt
npx supabase functions deploy get-my-privacy-rights-requests --no-verify-jwt
npx supabase functions deploy get-admin-privacy-rights-queue --no-verify-jwt
npx supabase functions deploy review-privacy-rights-request --no-verify-jwt
npx supabase functions deploy generate-my-privacy-data-export --no-verify-jwt
npx supabase functions deploy deactivate-account --no-verify-jwt
npx supabase functions deploy update-my-profile --no-verify-jwt
```

Antes da produção, revisar textos, prazos, matriz de retenção, critérios de
identidade, regras de reativação e procedimento operacional de resposta.
