# Documentos jurídicos e privacidade no staging

## Documentos atuais

| Documento | Chave | Versão | Vigência | Evento |
| --- | --- | --- | --- | --- |
| Termos de Uso | `terms_of_use` | `1.0.0` | `2026-07-12` | `accepted` |
| Aviso de Privacidade | `privacy_notice` | `1.0.0` | `2026-07-12` | `acknowledged` |
| Central de Ajuda | `help_center` | `1.0.0` | `2026-07-12` | nenhum |

A fonte canônica é `supabase/functions/_shared/legal-documents.ts`. Novos cadastros registram o aceite dos Termos e, separadamente, a ciência do Aviso de Privacidade. A ciência não é consentimento geral para tratamento de dados.

Consentimentos futuros de telemedicina e de transcrição/IA devem possuir documento, versão, finalidade, evento e possibilidade de revogação próprios. Marketing e cookies opcionais também permanecem separados.

## Pendências antes da produção

- Preencher razão social, CNPJ, endereço, suporte, contato de privacidade e responsável técnico.
- Validar registro da empresa/CRM, foro, cancelamento, reembolso, repasses e regras fiscais.
- Realizar revisão jurídica integral dos Termos e do Aviso.
- Formalizar matriz de retenção e instrumentos com fornecedores/transferências internacionais.
- Implementar consentimentos informados de telemedicina e, quando aplicável, transcrição/IA.
- Implementar em fases próprias cookies, marketing e o fluxo completo de direitos do titular.

Os eventos são append-only, usam horário do servidor, não guardam IP completo, token, dados médicos ou payloads de cadastro e não podem ser lidos ou inseridos diretamente pelo frontend.
