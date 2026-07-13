# Cookies e Armazenamento no Navegador em Staging

## Inventário confirmado

O código ativo não define cookies próprios. O cookie `sidebar:state` existia em
um componente de UI não utilizado e foi removido. Não há IndexedDB, Service
Worker, Google Analytics, Google Tag Manager, Meta Pixel, Hotjar, Clarity,
Sentry ou chat externo.

`localStorage`:

- `rd.auth.session.v1`: sessão necessária do app;
- `rd.auth.recovery.v1`: sessão temporária de recuperação Supabase;
- `rapido-doutor-theme`: preferência funcional de aparência;
- `rapido_doutor_privacy_preferences_v1`: escolha local versionada;
- `mapbox.eventData*`: armazenamento opcional criado pelo Mapbox GL JS.

`sessionStorage`:

- `rd_login_next`;
- `rd_last_active_consultation`;
- `rd_consulta_agora_auto_resume`;
- `rd.payment.return_context.v1`;
- `rd.solicitacaoExames.plantao`;
- `rd.laudosMedicos.wizard`.

O inventário canônico, finalidades e durações aproximadas estão em
`src/config/browser-storage.ts`.

## Categorias e escolha

Armazenamentos de autenticação, recuperação, pagamento e continuidade do
atendimento são estritamente necessários. O tema é uma preferência funcional
local e não é bloqueado.

Mapbox é a única tecnologia opcional confirmada. Antes da escolha, o mapa não é
importado nem inicializado. Aceitar opcionais habilita apenas o mapa. Rejeitar ou
revogar desmonta o mapa e remove chaves conhecidas `mapbox.eventData...`, sem
apagar sessão, tema ou estados operacionais.

Não há categoria ativa de analytics ou marketing. Os botões de aceitar e
rejeitar opcionais possuem a mesma visibilidade. A escolha contém somente
versão, categorias booleanas e timestamp local, sem usuário, e-mail ou token.

## Serviços externos

- Supabase Auth: necessário e persistido localmente nos fluxos ativos;
- Zoom Video SDK: navegador, apenas durante teleconsulta autorizada;
- Mapbox GL JS: navegador e opcional;
- Deepgram: navegador e backend, somente após consentimento de transcrição;
- Groq e API de planos: server-side, sem armazenamento local próprio;
- Stripe e Mercado Pago: redirecionamento para gateway, sem SDK no React. O
  domínio do gateway pode aplicar tecnologias próprias durante o checkout.

## Adição futura

Uma nova tecnologia opcional deve ser registrada na configuração canônica,
começar desativada, ser carregada somente após `isBrowserTechnologyAllowed`,
definir as chaves que precisam ser removidas na revogação e receber testes que
comprovem ausência de rede e eventos antes da escolha. Scripts não devem ser
adicionados diretamente ao `index.html`, `main.tsx` ou layout global.

## Pendências jurídicas

Validar o texto, as durações, o enquadramento funcional do Mapbox, contratos e
políticas dos gateways, transferências internacionais e o contato de
privacidade. Preencher os placeholders empresariais antes da produção.
