# Documentos jurídicos e privacidade no staging

## Documentos atuais

| Documento | Chave | Versão | Vigência | Evento |
| --- | --- | --- | --- | --- |
| Termos de Uso | `terms_of_use` | `1.0.0` | `2026-07-12` | `accepted` |
| Aviso de Privacidade | `privacy_notice` | `1.0.0` | `2026-07-12` | `acknowledged` |
| Central de Ajuda | `help_center` | `1.0.0` | `2026-07-12` | nenhum |
| Autorização de telemedicina | `telemedicine_consent` | `1.0.0` | `2026-07-12` | `granted`, por consulta |
| Transcrição da consulta | `consultation_transcription_consent` | `1.0.0` | `2026-07-12` | `granted`, `declined` ou `revoked`, por consulta |
| Aviso de assistência por IA | `ai_assistance_notice` | `1.0.0` | `2026-07-12` | `acknowledged`, por consulta |

A fonte canônica é `supabase/functions/_shared/legal-documents.ts`. Novos cadastros registram o aceite dos Termos e, separadamente, a ciência do Aviso de Privacidade. A ciência não é consentimento geral para tratamento de dados.

Telemedicina, transcrição e aviso de assistência por IA possuem decisões separadas e vinculadas à consulta. A transcrição é opcional e revogável; sua recusa não impede a teleconsulta. O fluxo atual não grava áudio ou vídeo e não persiste a transcrição completa. Marketing e cookies opcionais permanecem separados.

## Pendências antes da produção

- Preencher razão social, CNPJ, endereço, suporte, contato de privacidade e responsável técnico.
- Validar registro da empresa/CRM, foro, cancelamento, reembolso, repasses e regras fiscais.
- Realizar revisão jurídica integral dos Termos e do Aviso.
- Formalizar matriz de retenção e instrumentos com fornecedores/transferências internacionais.
- Submeter os textos específicos de telemedicina, transcrição e assistência por IA à revisão jurídica.
- Cookies e armazenamento possuem inventário técnico próprio; marketing continua fora desta fase.

Os eventos são append-only, usam horário do servidor, não guardam IP completo, token, dados médicos ou payloads de cadastro e não podem ser lidos ou inseridos diretamente pelo frontend.
