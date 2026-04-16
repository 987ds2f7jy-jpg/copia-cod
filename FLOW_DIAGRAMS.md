# User Flows - Visual Summary & Quick Reference

Quick visual reference for all major user flows in the Rapid Doctor application.

---

## AUTHENTICATION FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOGIN/SIGNUP FLOW                             │
└─────────────────────────────────────────────────────────────────┘

                          [Entrar.jsx]
                         Email + Password
                                │
                                ▼
                    [AuthContext.jsx] login()
                                │
                                ▼
                    [authService.js] login()
                  1. Validate with Zod schema
                  2. Call accountApi.loginAppUserRequest()
                                │
                                ▼
                    Edge Function: login-app-user
                  1. Verify email/password
                  2. Generate JWT tokens
                  3. Return { session, appUser }
                                │
                                ▼
              [session.js] saveStoredSession()
             Store in localStorage: rd.auth.session.v1
                  { accessToken, refreshToken, ... }
                                │
                                ▼
                    [AuthContext.jsx] setUser()
                   Update context with normalized user
                                │
                                ▼
                        Redirect to Dashboard
                  (Professional or Patient based on role)


              SESSION RESTORATION ON APP STARTUP
              
                    [AuthContext.jsx] useEffect
                      1. Check localStorage
                      2. Call authService.restoreSession()
                      3. Validate token with ensureFreshSession()
                      4. Fetch user with bootstrap-app-user
                      5. Update context or set to null


                    LOGOUT FLOW

                  [AuthContext.jsx] logout()
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     Professional    Clear Session  Clear Cache
     Reset Duty    (localStorage +  (React Query)
   resetProfessional  sessionStorage)
   DutyForUser()        │
                  authService.logout()
                        │
                        ▼
                 window.location.href = '/'
```

---

## APPOINTMENT BOOKING FLOW DIAGRAM

```
┌──────────────────────────────────────────────────────────────────┐
│            APPOINTMENT BOOKING (5-STEP WIZARD)                    │
└──────────────────────────────────────────────────────────────────┘

Step 1: Select Profession
  [Medicina] [Psicologia] [Nutrição] [Fonoaudiologia]
                     │
                     ▼
Step 2: Select Specialty (if multiple)
  [Clínico Geral] [Cardiologia] [Neurologia] ...
                     │
                     ▼
Step 3: Select Date
  Calendar with validation:
  - Min: Now + 36 hours
  - Max: Now + 14 days
                     │
                     ▼
Step 4: Select Time
  [08:00] [08:30] [09:00] ... [18:30]
  Filtered by validateSchedulingWindow()
                     │
                     ▼
Step 5: Enter Symptoms (Optional)
  Textarea: "Febre e tosse"
                     │
                     ▼
  ┌─────────────────────────────────┐
  │ Confirmar Agendamento           │
  └─────────────────────────────────┘
                     │
                     ▼
          createAppointmentRequest()
          Build datetime from date + time
          Validate scheduling window
                     │
                     ▼
     Edge Function: create-appointment
     1. Validate patient authenticated
     2. Find available professionals
     3. Create appointment record
     4. Return appointment object
                     │
                     ▼
        queryClient.invalidateQueries()
        ['patientAppointments', user?.id]
                     │
                     ▼
      Display in DashboardPaciente
      Status: SOLICITADO (awaiting professional)


    APPOINTMENT LIFECYCLE

    [SOLICITADO]  (Patient requested)
         │ accept-appointment
         ▼
    [CONFIRMADO]  (Professional accepted)
         │ within time window
         ▼
    [IN_PROGRESS] (Consultation active)
         │ finish-consulta
         ▼
    [COMPLETED]   (Professional completes)
         │ submit rating
         ▼
    [REVIEWED]    (Patient rated)


    CANCELLATION

    Active Appointment
         │ Patient clicks Cancel
         ▼
    cancelAppointmentRequest()
         │
         ▼
    Edge Function: cancel-appointment
    1. Update status to CANCELADO
    2. Free professional slot
    3. Notify patient
         │
         ▼
    Query invalidated, UI updated
```

---

## TELECONSULTA (VIDEO CONSULTATION) FLOW

```
┌──────────────────────────────────────────────────────────────────┐
│          VIDEO CONSULTATION (ZOOM INTEGRATION)                    │
└──────────────────────────────────────────────────────────────────┘

ENTRY: Patient clicks "Entrar na Consulta"
  From DashboardPaciente on active appointment
  Condition: isActive + within time window (±5-30 min)
                │
                ▼
    navigate(/consulta/:consultationId)
                │
                ▼
    [Teleconsulta.jsx] Load context
    useQuery(['teleconsulta-context', consultationId])
                │
                ▼
    Edge Function: get-teleconsulta-context
    1. Fetch consultation data
    2. Fetch participant info
    3. Fetch medical record (prontuario)
    4. Fetch evaluation (if exists)
    5. Fetch patient summary
                │
                ▼
    Get Zoom credentials:
    - buildZoomSessionName() → sala_id or consulta.id
    - buildZoomSessionKey() → token_sala
    - buildZoomUserIdentity() → pr-userId or pt-userId
    - buildZoomDisplayName() → user.full_name
                │
                ▼
    useZoomSession Hook
    Initialize Zoom Video SDK
                │
                ▼
    startConsultaSessionRequest()
    (Only professional calls this)
                │
                ▼
    Edge Function: start-consulta-session
    UPDATE consultas SET status='em_atendimento'
                │
                ▼
    [ZoomVideoStage.jsx]
    ┌─────────────────────┐
    │   Video Conference  │
    │                     │
    │  ┌───────────────┐  │
    │  │ Local Video   │  │
    │  └───────────────┘  │
    │  ┌───────────────┐  │
    │  │ Remote Video  │  │
    │  └───────────────┘  │
    │                     │
    │ [Video] [Audio] [Call]
    └─────────────────────┘

    PARALLEL: [ProntuarioForm.jsx]
    Professional fills medical record:
    - motivo_consulta (required)
    - recomendacoes (required)
    - Or complete mode: + all fields
           │
           ▼
    upsertProntuarioRequest()
           │
           ▼
    Edge Function: upsert-prontuario
    INSERT/UPDATE prontuarios
           │
           ▼
    Query refreshed

    PARALLEL: [ZoomChatPanel.jsx]
    Send messages during call


    END CONSULTATION: Click "Encerrar"
           │
           ▼
    finishConsultaRequest()
           │
           ▼
    Edge Function: finish-consulta
    1. Update status to 'finalizada'
    2. Record fim_at timestamp
           │
           ▼
    Zoom session closed
    Redirect to dashboard
           │
           ▼
    [AvaliacaoModal.jsx] (Patient only)
    Rate consultation: 1-5 stars
    Optional comment
           │
           ▼
    submitConsultaEvaluation()
           │
           ▼
    Edge Function: submit-consulta-evaluation
    INSERT avaliacao_consulta
           │
           ▼
    Professional rating updated
```

---

## PROFESSIONAL DASHBOARD FLOW

```
┌──────────────────────────────────────────────────────────────────┐
│          PROFESSIONAL DASHBOARD (MULTIPLE TABS)                   │
└──────────────────────────────────────────────────────────────────┘

[DashboardProfissional.jsx] INITIALIZATION
                │
    ┌───────────┼───────────┬──────────┬──────────────┐
    ▼           ▼           ▼          ▼              ▼
  Query:     Query:      Query:     Query:          Query:
['myProf'   ['profAppts' ['queue    ['pending       ['answered
ProfileId']  Id']        Waiting']   Questions']     Questions']
    │           │           │          │              │
    ▼           ▼           ▼          ▼              ▼
  Load       Load        Load       Load            Load
 Profile   Appointments  Queue    Unanswered      Answered
 Data       (200 limit)  Entries   Questions      Questions
    │           │           │          │              │
    └───────────┴───────────┴──────────┴──────────────┘
                       │
                       ▼
    ┌──────────────────────────────────┐
    │   TAB 1: DASHBOARD OVERVIEW      │
    │                                  │
    │  [KPI Cards]                     │
    │  - Total Revenue (period)        │
    │  - Trend vs previous period      │
    │  - Completed Appointments        │
    │  - Average Rating                │
    │                                  │
    │  [Charts]                        │
    │  - Revenue Chart (trend)         │
    │  - Appointments Chart            │
    └──────────────────────────────────┘

    ┌──────────────────────────────────┐
    │  TAB 2: APPOINTMENT REQUESTS     │
    │                                  │
    │ [SolicitacoesAgendamento]        │
    │                                  │
    │ Status: SOLICITADO               │
    │ ┌────────────────────────────┐  │
    │ │ Patient: João Silva        │  │
    │ │ Date: 2025-05-20 14:00     │  │
    │ │ Specialty: Clínico Geral   │  │
    │ │ Symptoms: Febre, tosse     │  │
    │ │ [Aceitar] [Recusar]        │  │
    │ └────────────────────────────┘  │
    │                                  │
    │ acceptAppointmentRequest()       │
    │    ▼                             │
    │ Edge: accept-appointment        │
    │ Status: CONFIRMADO              │
    └──────────────────────────────────┘

    ┌──────────────────────────────────┐
    │   TAB 3: MEU PERFIL              │
    │                                  │
    │ [Editable Fields]                │
    │ - Full name                      │
    │ - Specialty                      │
    │ - CRM                            │
    │ - Bio                            │
    │ - Availability (day/time grid)  │
    │ - Office locations               │
    │                                  │
    │ upsertProfessionalProfileRequest()
    │    ▼                             │
    │ Edge: upsert-professional-profile
    │ UPDATE professional_profiles     │
    │                                  │
    │ replaceAvailabilitySlotsRequest()
    │    ▼                             │
    │ Edge: replace-availability-slots │
    │ UPDATE availability table        │
    └──────────────────────────────────┘

    ┌──────────────────────────────────┐
    │  TAB 4: PLANTÃO (QUEUE DUTY)    │
    │                                  │
    │ [Toggle] ON DUTY / OFF DUTY      │
    │                                  │
    │ If ON DUTY:                      │
    │ - is_online_now = true           │
    │ - Visible in queue listings      │
    │ - Queue refetch: 10 sec          │
    │                                  │
    │ ┌────────────────────────────┐  │
    │ │ Queue Entry:               │  │
    │ │ Patient: Maria Santos      │  │
    │ │ Complaint: Dor de cabeça   │  │
    │ │ Time waiting: 5 min        │  │
    │ │ [Atender]                  │  │
    │ └────────────────────────────┘  │
    │                                  │
    │ acceptQueueEntryRequest()        │
    │    ▼                             │
    │ Edge: accept-queue-entry        │
    │ Creates consultation_id          │
    │ Redirects to /consulta/:id      │
    └──────────────────────────────────┘

    ┌──────────────────────────────────┐
    │ TAB 5: PERGUNTAS PENDENTES      │
    │ (Q&A Forum)                      │
    │                                  │
    │ ┌────────────────────────────┐  │
    │ │ Question:                  │  │
    │ │ "Como tratar alergia?"     │  │
    │ │ Posted: 2 hours ago        │  │
    │ │ By: Anonymous              │  │
    │ │ [Responder]                │  │
    │ └────────────────────────────┘  │
    │                                  │
    │ answerQuestionRequest()          │
    │    ▼                             │
    │ Edge: answer-question           │
    │ UPDATE questions SET answer_text │
    │ Refetch: pendingQuestions,       │
    │          answeredQuestions       │
    └──────────────────────────────────┘

    ┌──────────────────────────────────┐
    │ WIDGET: FINANCIAL TRACKING       │
    │                                  │
    │ [FinancialWidget]                │
    │ Total Earnings: R$ 1.250,00      │
    │ Pending: R$ 300,00               │
    │ Last Withdrawal: 2025-05-10      │
    │ [Solicitar Saque]                │
    │                                  │
    │ requestWithdrawalRequest()       │
    │    ▼                             │
    │ Edge: request-withdrawal         │
    │ INSERT saques (status=pending)   │
    └──────────────────────────────────┘
```

---

## PATIENT DASHBOARD FLOW

```
┌──────────────────────────────────────────────────────────────────┐
│          PATIENT DASHBOARD (APPOINTMENTS & ACTIONS)               │
└──────────────────────────────────────────────────────────────────┘

[DashboardPaciente.jsx] INITIALIZATION
                │
    ┌───────────┼──────────────┬──────────────┐
    ▼           ▼              ▼              ▼
 Query:      Query:          Query:         Query:
['patientA  ['myActive       ['patientR    [RefreshPull-
ppointments' Consultation']  eviews']      ToRefresh]
 user?.id]    user?.id]       user?.id]
    │           │              │              │
    ▼           ▼              ▼              ▼
  Load All   Load Current   Load Patient   Manual
Appointments Active Call    Reviews        Refresh

    ┌──────────────────────────────────────────────────────┐
    │ [ResumeConsultationCard]                             │
    │ (If Active Consultation Exists)                      │
    │                                                       │
    │ Alert Banner:                                        │
    │ "Você tem uma consulta agora!"                       │
    │                                                       │
    │ Professional: Dr. João                               │
    │ Specialty: Clínico Geral                             │
    │ Status: Em andamento                                 │
    │ [Entrar na Consulta]                                │
    │                                                       │
    │ Navigates to: /consulta/:consultationId             │
    └──────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────┐
    │ TAB: PRÓXIMAS CONSULTAS (Upcoming)                   │
    │                                                       │
    │ Filters:                                             │
    │ - Status: SOLICITADO, CONFIRMADO, IN_PROGRESS        │
    │ - Date >= Today                                      │
    │                                                       │
    │ ┌────────────────────────────────────────────────┐  │
    │ │ ┌────────┐  Dr. João Silva                      │  │
    │ │ │ Avatar │  Clínico Geral                       │  │
    │ │ └────────┘  2025-05-20 14:00                    │  │
    │ │             Status: [CONFIRMADO]                │  │
    │ │             Symptoms: Febre, tosse              │  │
    │ │             [Entrar]  [Cancelar]                │  │
    │ └────────────────────────────────────────────────┘  │
    │                                                       │
    │ Conditions for "Entrar":                             │
    │ - Status must be: accepted, CONFIRMADO, in_progress │
    │ - Current time within: 5 min before to 30 min after │
    │                                                       │
    │ If clicked:                                          │
    │   navigate(/consulta/:consultationId)              │
    │       ▼                                              │
    │   [Teleconsulta.jsx] Video call                     │
    │                                                       │
    │ If clicked "Cancelar":                               │
    │   cancelAppointmentRequest()                        │
    │       ▼                                              │
    │   Edge: cancel-appointment                          │
    │   Status: CANCELADO                                 │
    │   Update UI                                         │
    └──────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────┐
    │ TAB: CONSULTAS ANTERIORES (Past)                     │
    │                                                       │
    │ Filters:                                             │
    │ - Status: COMPLETED, CONCLUIDO, EXPIRADO             │
    │ - Date < Today (or stale)                            │
    │                                                       │
    │ ┌────────────────────────────────────────────────┐  │
    │ │ ┌────────┐  Dr. Maria Santos                    │  │
    │ │ │ Avatar │  Psicologia                          │  │
    │ │ └────────┘  2025-05-15 10:00                    │  │
    │ │             Status: [CONCLUÍDO]                 │  │
    │ │                                                  │  │
    │ │             NOT YET REVIEWED ✗                  │  │
    │ │             [Avaliar] [Ver Detalhes]            │  │
    │ └────────────────────────────────────────────────┘  │
    │                                                       │
    │ Click "Avaliar":                                     │
    │   [AvaliacaoModal] opens                            │
    │   ┌─────────────────────────────┐                   │
    │   │ Rating: [★★★★☆] 4 stars    │                   │
    │   │                              │                   │
    │   │ Comment:                     │                   │
    │   │ [Ótimo atendimento...]       │                   │
    │   │ [Cancelar] [Enviar]          │                   │
    │   └─────────────────────────────┘                   │
    │       ▼                                              │
    │   submitAppointmentReviewRequest()                 │
    │       ▼                                              │
    │   Edge: submit-appointment-review                   │
    │   INSERT reviews                                    │
    │   Professional rating updated                       │
    │   Review count incremented                          │
    └──────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────┐
    │ TAB: CANCELADAS (Cancelled)                          │
    │                                                       │
    │ Filters:                                             │
    │ - Status: CANCELLED, CANCELADO                       │
    │                                                       │
    │ Display: Same as past appointments                   │
    │ Option: [Agendar Novamente] → AgendamentoEspecialidade
    └──────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────┐
    │ QUICK ACTION BUTTONS                                │
    │                                                       │
    │ [Agendar Consulta] → AgendamentoEspecialidade       │
    │ [Consulta Agora] → ConsultaAgora (Instant Queue)   │
    │ [Laudos Médicos] → LaudosMedicos (Medical Records) │
    │ [Solicitar Exames] → SolicitacaoExames (Exams)     │
    │ [Pergunte ao Especialista] → PergunteEspecialista   │
    │ [Meu Perfil] → Perfil (Edit Profile)               │
    └──────────────────────────────────────────────────────┘
```

---

## MEDICAL EXAMS REQUEST FLOW

```
┌──────────────────────────────────────────────────────────────────┐
│        MEDICAL EXAMS REQUEST (3 REQUEST TYPES)                    │
└──────────────────────────────────────────────────────────────────┘

[SolicitacaoExames.jsx] SELECTION

            ┌─────────────────┬──────────────────┬──────────────────┐
            ▼                 ▼                  ▼
      TYPE 1:           TYPE 2:              TYPE 3:
    CHECK-UP         SPECIFIC EXAM      PRESCRIPTION RENEWAL
                                         [RenovacaoReceitas.jsx]


TYPE 1: CHECK-UP FLOW
─────────────────────

Dialog: "Solicitar Check-Up"
│
├─ [ ] "Entendi que será uma solicitação..."
├─ [Cancelar] [Confirmar Solicitação]
│
▼
handleCheckupSubmit()
    ▼
createCheckupRequest(user)
    ▼
createSolicitacaoExame({
  tipo: 'checkup',
  exameSolicitado: 'Check-Up Completo',
  motivo: 'Exames de rotina / check-up preventivo',
  sintomas: '',
  assintomaticoConfirmado: true,
  fluxoDestino: 'dashboard',
  especialidadeDestino: 'clinico_geral'
})
    ▼
Edge Function: create-solicitacao-exame
    ▼
INSERT solicitacoes_exames (
  paciente_id, tipo='checkup', status='pending', ...
)
    ▼
ADMIN APPROVAL FLOW
1. Request appears in admin queue
2. Admin reviews medical necessity
3. Approves/denies
4. Patient notified
5. If approved → professional sees on dashboard


TYPE 2: SPECIFIC EXAM FLOW
──────────────────────────

Dialog: "Solicitar Exames Específicos"
│
├─ Exame: [Eletrocardiograma▼]
├─ Motivo: [Optional text...]
├─ Sintomas: [Optional text...]
│
▼
handleEspecificosSubmit()
    ▼
createSpecificExamRequest(user, { exame, motivo, sintomas })
    ▼
createSolicitacaoExame({
  tipo: 'especificos',
  exameSolicitado: 'Eletrocardiograma',
  motivo: 'Acompanhamento cardiológico',
  sintomas: 'Palpitações',
  assintomaticoConfirmado: false,
  fluxoDestino: 'plantao',    ◄─── ROUTES TO QUEUE!
  especialidadeDestino: 'clinico_geral'
})
    ▼
Edge Function: create-solicitacao-exame
    ▼
INSERT solicitacoes_exames
    ▼
buildSpecificExamSymptoms()
Result: "[Solicitação de Exame: Eletrocardiograma]. 
          Motivo: Acompanhamento. Sintomas: Palpitações"
    ▼
persistSpecificExamRedirect(context)
Save to sessionStorage: rd.solicitacaoExames.plantao
    ▼
navigate(/ConsultaAgora?especialidade=clinico_geral&sintomas=...)
    ▼
[ConsultaAgora.jsx]
INSTANT CONSULTATION FLOW
1. Patient joins queue
2. Waits for available professional
3. Professional accepts
4. Video consultation starts
5. Professional discusses exam needs
6. Professional can approve/schedule exam


TYPE 3: PRESCRIPTION RENEWAL FLOW
─────────────────────────────────

Dialog: "Renovar Receita"
│
├─ Medicamento: [Dipirona▼]
├─ Dosagem: [500mg▼]
├─ Frequência: [A cada 8h▼]
├─ Arquivo: [Anexar receita...]
│   ├─ Validation:
│   │  ├─ Type: PDF, JPG, PNG
│   │  ├─ Size: max 10MB
│   │  └─ Count: max 5 files
│   │
│   └─ Upload → Get URL
│
▼
handleEspecificosSubmit()
    ▼
createPrescriptionRenewalRequest(user, {
  nomeMedicamento,
  dosagem,
  frequencia,
  arquivoReceitaUrl
})
    ▼
createSolicitacaoExame({
  tipo: 'renovacao_receitas',
  nomeMedicamento: 'Dipirona',
  dosagem: '500mg',
  frequencia: 'A cada 8h',
  arquivoReceitaUrl: 'https://...',
  fluxoDestino: 'dashboard',
  especialidadeDestino: 'clinico_geral'
})
    ▼
Edge Function: create-solicitacao-exame
    ▼
INSERT solicitacoes_exames (
  paciente_id, tipo='renovacao_receitas', 
  status='pending', arquivo_receita_url, ...
)
    ▼
PROFESSIONAL REVIEW FLOW
1. Request appears on professional dashboard
2. Professional reviews prescription
3. Professional approves/denies
4. Patient notified
5. If approved → Patient can print/download


FILE VALIDATION LOGIC
─────────────────────

validateMedicalSupportFile(file)
│
├─ if !file → required error
├─ if size > 10MB → "Arquivo excede o limite"
├─ if type not in [pdf, jpeg, png] → "Formato inválido"
└─ return null (valid)

Allowed MIME Types:
  - application/pdf
  - image/jpeg
  - image/png

Allowed Extensions:
  - .pdf, .jpg, .jpeg, .png
```

---

## QUICK REFERENCE TABLE

| Flow | Start Point | Key Steps | End Result |
|------|-------------|-----------|-----------|
| **Login** | [Entrar.jsx](src/pages/Entrar.jsx) | Email/password → login-app-user → Store token → Redirect | Authenticated user in dashboard |
| **Signup** | [CadastroPaciente.jsx](src/pages/CadastroPaciente.jsx) | Form → bootstrap-app-user → Create user + profile → Store token | New account with session |
| **Book Apt** | [AgendamentoEspecialidade.jsx](src/pages/AgendamentoEspecialidade.jsx) | 5-step wizard → create-appointment → Status SOLICITADO | Appointment in patient dashboard |
| **Accept Apt** | [DashboardProfissional.jsx](src/pages/DashboardProfissional.jsx) | Click accept → accept-appointment → Status CONFIRMADO | Scheduled appointment confirmed |
| **Video Call** | [Teleconsulta.jsx](src/pages/Teleconsulta.jsx) | Join → start-consulta-session → Zoom SDK → Prontuário → finish-consulta | Completed consultation with records |
| **Queue (Instant)** | [ConsultaAgora.jsx](src/pages/ConsultaAgora.jsx) | Join queue → accept-queue-entry → Video call → finish-consulta | Instant consultation completed |
| **Prof Dashboard** | [DashboardProfissional.jsx](src/pages/DashboardProfissional.jsx) | View metrics → Manage appointments → Answer questions → On/off duty | Professional operations center |
| **Patient Dashboard** | [DashboardPaciente.jsx](src/pages/DashboardPaciente.jsx) | View appointments → Rate past → Book new → Access medical records | Patient consultation hub |
| **Exams Request** | [SolicitacaoExames.jsx](src/pages/SolicitacaoExames.jsx) | 3 types: Check-Up (admin) / Specific (queue) / Prescription (review) | Request created + routed appropriately |

---

## API ENDPOINT SUMMARY

### Edge Functions Called by Each Flow

**Authentication:**
- `login-app-user` - Authenticate user
- `bootstrap-app-user` - Create user or restore session

**Appointments:**
- `create-appointment` - Request new appointment
- `accept-appointment` - Professional accepts request
- `cancel-appointment` - Cancel appointment
- `submit-appointment-review` - Patient rates consultation

**Video Consultation:**
- `get-teleconsulta-context` - Load consultation data
- `start-consulta-session` - Begin video session
- `finish-consulta` - End consultation
- `submit-consulta-evaluation` - Patient rates video call
- `upsert-prontuario` - Professional fills medical record

**Queue/Instant Consultation:**
- `join-queue` - Patient joins waiting queue
- `leave-queue` - Patient leaves queue
- `accept-queue-entry` - Professional accepts from queue
- `finish-consulta` - End consultation

**Professional Dashboard:**
- `get-professional-dashboard` - Load all dashboard data
- `upsert-professional-profile` - Edit profile
- `replace-availability-slots` - Update availability
- `set-professional-duty` - Toggle on/off duty
- `answer-question` - Answer Q&A post

**Medical Exams:**
- `create-solicitacao-exame` - Create exam request
- `update-solicitacao-exame` - Update request status
- `delete-solicitacao-exame` - Delete request

**Admin:**
- `get-admin-approval-queue` - View approval queue
- `review-professional-application` - Approve/deny professional

---

## STATE MANAGEMENT PATTERNS

### React Context (AuthContext)
- **Purpose:** Global auth state
- **Data:** `{ user, loading }`
- **Methods:** `login()`, `register()`, `logout()`, `refreshUser()`, `updateUser()`

### React Query (TanStack Query)
- **Purpose:** Server state caching
- **Usage:** Appointments, professional profile, queue, questions, etc.
- **Invalidation:** Mutations trigger cache refresh

### Local Storage
- **Key:** `rd.auth.session.v1`
- **Data:** JWT tokens + expiry
- **Cleared on:** Logout, account deactivation

### Session Storage
- **Keys:** `rd_login_next`, `rd_last_active_consultation`, etc.
- **Purpose:** Session-temporary data
- **Cleared on:** Tab close, manual clear

---

## ERROR HANDLING MATRIX

| Scenario | Status Code | Handler | User Message |
|----------|------------|---------|--------------|
| Invalid email format | 400 | Zod schema | "Email inválido" |
| Account not found | 404 | authService | "Conta não encontrada" |
| Account inactive | 403 | authService | "Sua conta está inativa" |
| Session expired | 401 | ensureFreshSession | Auto-refresh or redirect |
| Network error | 0 | Mutation error | Toast with error |
| Appointment unavailable | 409 | API error | "Horário indisponível" |
| File too large | 413 | Validation | "Arquivo > 10MB" |
| Duplicate email | 409 | Edge Function | "E-mail já cadastrado" |

---

## Performance Optimizations

### Query Stale Times
- `myProfessionalProfile`: 30 seconds
- `myPublicProfile`: 60 seconds
- `queueWaiting`: 10 seconds (if on duty)
- `pendingQuestions`: 30 seconds

### Refetch Intervals
- `queueWaiting`: 10 sec when on duty, disabled otherwise
- `teleconsulta-context`: 5 sec during active consultation
- `myActiveConsultation`: 10 sec
- `pendingQuestions`: 30 sec

### Optimistic Updates
- Appointment cancellation
- Profile updates
- Review submissions

---

## Security Notes

1. **Token Storage:** localStorage (XSS-vulnerable, consider alternatives)
2. **Authorization:** Role checks on frontend + RLS policies on backend
3. **Protected Routes:** Check `user?.id` and `user?.role`
4. **CORS:** Configured on Supabase
5. **Data Isolation:** RLS enforces patient/professional boundaries
6. **Session Validation:** Token refresh before each API call

