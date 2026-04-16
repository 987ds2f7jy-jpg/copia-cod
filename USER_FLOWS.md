# User Flows - Rapid Doctor Application

Complete trace of all major user flows with technical implementation details.

---

## 1. AUTHENTICATION FLOW

### Overview
Custom token-based authentication system (not Supabase Auth). Users authenticate with email/password, receive JWT-like access/refresh tokens stored in localStorage.

### Login Flow

**Start Point:** [src/pages/Entrar.jsx](src/pages/Entrar.jsx)

**Files Involved:**
- [src/pages/Entrar.jsx](src/pages/Entrar.jsx) - Login UI form
- [src/components/AuthContext.jsx](src/components/AuthContext.jsx) - Auth state management (React Context)
- [src/services/authService.js](src/services/authService.js) - Authentication business logic
- [src/client-api/session.js](src/client-api/session.js) - Session token storage/retrieval
- [src/client-api/account.js](src/client-api/account.js) - Account API wrapper
- [src/client-api/edgeFunctions.js](src/client-api/edgeFunctions.js) - Edge Function caller

**Step-by-Step Process:**

1. **User Input** (Entrar.jsx)
   - User enters email and password
   - Form validation: email format, non-empty password
   - State: `[email, setEmail]`, `[password, setPassword]`

2. **Form Submission** (Entrar.jsx → AuthContext)
   ```javascript
   // Entrar.jsx
   const { login } = useAuth();
   await login(email, password);
   ```

3. **Login Function** (AuthContext.jsx)
   ```javascript
   // AuthContext.jsx - line 68
   const login = useCallback(async (email, password) => {
     const nextUser = await authService.login(email, password);
     setUser(nextUser);
     return nextUser;
   }, []);
   ```

4. **Authentication Service** (authService.js)
   ```javascript
   // authService.js - line 164
   async login(email, password) {
     const credentials = loginSchema.parse({ email, password }); // Zod validation
     
     const result = await accountApi.loginAppUserRequest({
       email: credentials.email,
       password: credentials.password,
     });
     
     // Validate session tokens exist
     if (!result?.session?.accessToken || !result?.session?.refreshToken) {
       throw AppError (AUTH_SESSION_NOT_CREATED);
     }
     
     // Store session in localStorage
     saveStoredSession(result.session);
     
     // Return normalized user object
     return ensureActiveUser(toUiUser(result.appUser));
   }
   ```

5. **Edge Function Call** (edgeFunctions.js)
   - Endpoint: `login-app-user` Edge Function
   - Payload sent:
     ```json
     {
       "email": "user@example.com",
       "password": "hashed_password"
     }
     ```
   - Response:
     ```json
     {
       "session": {
         "accessToken": "jwt_token",
         "refreshToken": "refresh_token",
         "expiresAt": 1234567890,
         "tokenType": "bearer"
       },
       "appUser": {
         "id": "user_id",
         "fullName": "User Name",
         "email": "user@example.com",
         "role": "patient|professional",
         "isActive": true
       }
     }
     ```

6. **Session Storage** (session.js)
   ```javascript
   // session.js
   export function saveStoredSession(session) {
     const normalizedSession = normalizeSession(session);
     window.localStorage.setItem('rd.auth.session.v1', JSON.stringify(normalizedSession));
     notifyListeners(normalizedSession); // Notify subscribers
     return normalizedSession;
   }
   
   // Stored data structure:
   {
     "accessToken": "jwt_...",
     "refreshToken": "refresh_...",
     "expiresAt": 1234567890,
     "tokenType": "bearer"
   }
   ```

7. **User State Update** (AuthContext.jsx)
   - Context value updated: `[user, setUser]`
   - Triggers re-render of protected routes
   - [ProtectedRoute.jsx](src/components/ProtectedRoute.jsx) checks `user?.id` and `user?.role`

8. **Navigation** (Entrar.jsx)
   ```javascript
   // Entrar.jsx - line 35-37
   const nextPath = sessionStorage.getItem('rd_login_next') || resolveRedirectPath(user);
   navigate(nextPath, { replace: true });
   
   // resolveRedirectPath:
   // role='professional' → /DashboardProfissional
   // role='patient' → /DashboardPaciente
   ```

### Session Restoration (App Startup)

**File:** [src/components/AuthContext.jsx](src/components/AuthContext.jsx) - `useEffect` hook (line 32)

```javascript
useEffect(() => {
  const syncSession = async () => {
    try {
      const restoredUser = await authService.restoreSession();
      if (isMounted) setUser(restoredUser);
    } catch {
      if (isMounted) setUser(null);
    } finally {
      if (isMounted) setLoading(false);
    }
  };
  
  syncSession();
  
  // Subscribe to storage events (cross-tab sync)
  const unsubscribe = authService.subscribeToAuthChanges((nextUser) => {
    if (isMounted) setUser(nextUser);
  });
  
  return () => {
    isMounted = false;
    unsubscribe();
  };
}, []);
```

**Process:**
1. Check localStorage for `rd.auth.session.v1` (session.js)
2. If session exists, call `ensureFreshSession()` to validate/refresh token
3. Call Edge Function `bootstrap-app-user` with session to fetch current user
4. Update `setUser()` or set to null if session invalid

### Logout Flow

**Files:** [src/components/AuthContext.jsx](src/components/AuthContext.jsx)

```javascript
const logout = useCallback(async () => {
  // Reset professional duty if applicable
  if (user?.role === 'professional' && user?.id) {
    try {
      await resetProfessionalDutyForUser(user.id);
    } catch {
      // Best effort only
    }
  }
  
  // Clear session
  clearPostLoginRedirect();
  await authService.logout(); // Call logout Edge Function
  clearClientState(); // Clear context + React Query cache
  window.location.href = '/'; // Hard redirect
}, [user]);
```

**Data Cleared:**
- localStorage: `rd.auth.session.v1`, `rd_login_next`
- sessionStorage: `rd_last_active_consultation`, `rd_consulta_agora_auto_resume`
- React Query cache: `queryClient.clear()`
- Context: `setUser(null)`

### Registration Flow

**Start Point:** [src/pages/CadastroPaciente.jsx](src/pages/CadastroPaciente.jsx) or [src/pages/CadastroProfissional.jsx](src/pages/CadastroProfissional.jsx)

**Steps:**

1. **User Registration Form** (CadastroPaciente.jsx)
   - Patient fields: full_name, email, password, phone, cpf, birth_date, sex, address, city, state
   - Professional fields: additional CRM, specialty, availability slots

2. **Form Submission**
   ```javascript
   const { register } = useAuth();
   await register({
     full_name,
     email,
     password,
     role: 'patient', // or 'professional'
     phone,
     cpf,
     birth_date,
     sex,
     address,
     city,
     state
   });
   ```

3. **Validation** (authService.js - Zod schema)
   - full_name: trim, min 3 chars
   - email: valid email format
   - password: min 6 chars
   - role: 'patient' or 'professional'

4. **Payload Transformation** (authService.js)
   ```javascript
   // mapRegisterPayload()
   {
     fullName, email, password, role,
     phone, cpf, birthDate, sex,
     address, city, state
   }
   ```

5. **Edge Function Call** (bootstrap-app-user)
   - Creates record in `app_users` table
   - Creates related `patient_profiles` or `professional_profiles`
   - Returns session + user data (same format as login)

6. **Session Stored** (same as login)

7. **Redirect** (CadastroPaciente/CadastroProfissional)
   - Patient: Redirect to /DashboardPaciente or profile completion
   - Professional: Redirect to profile completion wizard

### Error Scenarios & Handling

| Scenario | Error Code | Handling |
|----------|-----------|----------|
| Invalid email format | Schema validation | Show "Email inválido" |
| Password < 6 chars | Schema validation | Show "Senha deve ter ao menos 6 caracteres" |
| Duplicate email | Edge Function 409 | Show "E-mail já cadastrado" |
| Account inactive | ACCOUNT_INACTIVE | Clear session, redirect to login |
| Session expired | AUTH_SESSION_REQUIRED | Auto-refresh token or clear session |
| Network error | Network error | Show toast with error message |

---

## 2. APPOINTMENT BOOKING FLOW (Scheduled Appointments)

### Overview
Patients browse specialties, select date/time, and request appointment from available professionals. System validates scheduling window (36 hours to 14 days ahead).

### Start Point
[src/pages/AgendamentoEspecialidade.jsx](src/pages/AgendamentoEspecialidade.jsx) or [src/pages/AgendamentoPerfil.jsx](src/pages/AgendamentoPerfil.jsx)

### Booking Wizard (5 Steps)

**Files:**
- [src/pages/AgendamentoEspecialidade.jsx](src/pages/AgendamentoEspecialidade.jsx) - Main wizard
- [src/client-api/appointments.js](src/client-api/appointments.js) - API calls
- [src/lib/scheduling.js](src/lib/scheduling.js) - Date/time validation

#### Step 1: Select Profession

**UI:** [AgendamentoEspecialidade.jsx](src/pages/AgendamentoEspecialidade.jsx#L17)

```javascript
const PROFESSIONS = [
  {
    id: 'Medicina',
    name: 'Medicina',
    specialties: ['Clínico Geral', 'Cardiologia', 'Neurologia', 'Ortopedia', ...]
  },
  { id: 'Psicologia', specialties: ['Psicologia Clínica'] },
  { id: 'Nutrição', specialties: ['Nutrição Clínica'] },
  { id: 'Fonoaudiologia', specialties: ['Fonoaudiologia Clínica'] },
];
```

**State:** `selectedProfession` → `step = 2` (if multiple specialties) or `step = 3` (if single)

#### Step 2: Select Specialty

**State:** `selectedSpecialty`
**Action:** Click specialty → `setStep(3)`

#### Step 3: Select Date

**Component:** [Calendar](src/components/ui/calendar.tsx) component

**Validation:** `isDateDisabled()`
```javascript
const now = new Date();
const minDate = addHours(now, 36); // 36 hours from now
const maxDate = addDays(now, 14);  // 14 days from now
return date < minDate || date > maxDate;
```

**State:** `selectedDate` → Available time slots filtered

#### Step 4: Select Time

**Time Slots:** [src/lib/scheduling.js](src/lib/scheduling.js)
```javascript
const ALL_TIME_SLOTS = [
  '08:00', '08:30', '09:00', ..., '18:30'
];
```

**Filtering:** Only show slots where `validateSchedulingWindow(datetime)` returns `{ valid: true }`
- Checks: Not in past, within allowed window, business hours, etc.

**State:** `selectedTime`

#### Step 5: Enter Symptoms (Optional)

**State:** `symptoms` (textarea)

**Action:** "Confirmar Agendamento" button

### Submission

**Mutation:** `createRequest` (useMutation)

```javascript
const createRequest = useMutation({
  mutationFn: async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const scheduledDatetime = buildDatetime(dateStr, selectedTime);
    
    // Final validation
    const validation = validateSchedulingWindow(scheduledDatetime);
    if (!validation.valid) throw new Error(validation.reason);
    
    return createAppointmentRequest({
      professionalProfileId: null, // null = any professional
      specialty: selectedSpecialty,
      date: dateStr,
      time: selectedTime,
      symptoms,
      priority: false,
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['patientAppointments'] });
    setStep(5); // Success screen
  },
  onError: (err) => {
    setSubmitError(err.message);
  },
});
```

### API Call Flow

**Function:** [src/client-api/appointments.js](src/client-api/appointments.js#L3)

```javascript
export async function createAppointmentRequest({
  professionalProfileId,
  specialty,
  date,
  time,
  symptoms,
  priority,
}) {
  return invokeEdgeFunction('create-appointment', {
    body: {
      professionalProfileId,
      specialty,
      date,
      time,
      symptoms,
      priority,
    },
    fallbackMessage: 'Não foi possível criar o agendamento.',
  });
}
```

### Edge Function Processing

**Edge Function:** `create-appointment`

**Request Payload:**
```json
{
  "professionalProfileId": null,
  "specialty": "Clínico Geral",
  "date": "2025-05-20",
  "time": "14:00",
  "symptoms": "Febre e tosse",
  "priority": false
}
```

**Backend Processing:**
1. Validate user authenticated + role = 'patient'
2. Validate date/time in allowed window
3. Validate specialty exists
4. Search for available professionals in specialty
5. If professional(s) available and priority=false: assign
6. If no professional available or priority=true: create in queue with status='SOLICITADO'
7. Create appointment record in `appointments` table
8. Return appointment object

**Response:**
```json
{
  "id": "appt_uuid",
  "patient_id": "patient_uuid",
  "professional_id": "pro_uuid or null",
  "specialty": "Clínico Geral",
  "scheduled_datetime": "2025-05-20T14:00:00",
  "symptoms": "Febre e tosse",
  "status": "SOLICITADO|CONFIRMADO",
  "created_at": "2025-04-16T10:30:00",
  "type": "specialty"
}
```

### Result Display

**Location:** [src/pages/DashboardPaciente.jsx](src/pages/DashboardPaciente.jsx)

**Query:** `['patientAppointments', user?.id]`
```javascript
const { data: appointments = [] } = useQuery({
  queryKey: ['patientAppointments', user?.id],
  queryFn: () => entities.Appointment.filter(
    { patient_id: user.id },
    '-scheduled_datetime'
  ),
  enabled: !!user?.id,
});
```

**Display:**
- Appointment appears under "Próximas Consultas" tab
- Status badge: "Aguardando especialista" (SOLICITADO)
- Shows: Professional name, specialty, date/time
- Actions: "Entrar na Consulta" (if time window ok), "Cancelar"

### Validations

| Field | Validation | Error Message |
|-------|-----------|----------------|
| Date | >= 36 hours, <= 14 days | "Escolha uma data válida" |
| Time | Within business hours | "Horário indisponível" |
| Specialty | Must be in PROFESSIONS list | "Especialidade inválida" |
| Role | Must be patient | "Profissionais não podem agendar" |
| Symptoms | Optional, max 500 chars | N/A |

### Cancel Appointment

**Function:** [src/client-api/appointments.js](src/client-api/appointments.js#L24)

```javascript
const cancelAppointment = useMutation({
  mutationFn: (id) => cancelAppointmentRequest({ appointmentId: id }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['patientAppointments', user?.id] });
  },
});
```

**Edge Function:** `cancel-appointment`

**Changes:**
- Appointment status: SOLICITADO/CONFIRMADO → CANCELADO
- If professional already assigned: Professional notified (via query refetch)
- Patient sees in "Canceladas" tab

---

## 3. TELECONSULTA (VIDEO CONSULTATION) FLOW

### Overview
Real-time video consultation using Zoom Video SDK. Triggered when appointment status is CONFIRMADO/in_progress within allowed time window.

### Start Point

**Location:** [src/pages/Teleconsulta.jsx](src/pages/Teleconsulta.jsx)

**Accessed Via:**
```
/consulta/:consultationId
```

**Entry Points:**
1. Patient clicks "Entrar na Consulta" from [DashboardPaciente.jsx](src/pages/DashboardPaciente.jsx)
   ```javascript
   const canEnterConsult = (appt) => {
     const isActive = ['accepted', 'CONFIRMADO', 'in_progress'].includes(appt.status);
     const dtStr = appt.scheduled_datetime || appt.datetime;
     const now = new Date();
     const dt = new Date(dtStr);
     const from = new Date(dt.getTime() - 5 * 60 * 1000);      // 5 min before
     const to = new Date(dt.getTime() + 30 * 60 * 1000);       // 30 min after
     return isActive && now >= from && now <= to;
   };
   
   navigate(`/consulta/${appointment.consulta_id}`);
   ```

2. Professional clicks accepted appointment or queue entry → navigates to consultation

### Context Loading

**Query:** [src/pages/Teleconsulta.jsx](src/pages/Teleconsulta.jsx#L83)

```javascript
const teleconsultaQuery = useQuery({
  queryKey: ['teleconsulta-context', consultationId],
  queryFn: () => getTeleconsultaContextRequest({
    consultationId,
    historyLimit: 20,
  }),
  enabled: Boolean(consultationId && user?.id && !isLeavingSession),
  refetchInterval: (query) => {
    const status = query.state.data?.consultation?.status;
    if (isLeavingSession || ['finalizada', 'cancelada'].includes(status)) {
      return false;
    }
    return 5000; // Refetch every 5 seconds
  },
});
```

**API Call:** [src/client-api/teleconsulta.js](src/client-api/teleconsulta.js)

```javascript
// getTeleconsultaContextRequest()
invokeEdgeFunction('get-teleconsulta-context', {
  body: { consultationId, historyLimit: 20 },
  fallbackMessage: 'Não foi possível carregar a teleconsulta.',
})
```

**Edge Function Response:**
```json
{
  "consultation": {
    "id": "consulta_uuid",
    "paciente_id": "patient_uuid",
    "profissional_id": "pro_uuid",
    "paciente_nome": "Patient Name",
    "profissional_nome": "Doctor Name",
    "especialidade": "Clínico Geral",
    "status": "em_atendimento",
    "datetime": "2025-05-20T14:00:00",
    "sala_id": "room_name_123",
    "token_sala": "zoom_session_token"
  },
  "participant": {
    "appUserId": "user_uuid",
    "role": "patient|professional",
    "isParticipant": true
  },
  "currentProntuario": {
    "id": "prontuario_uuid",
    "consulta_id": "consulta_uuid",
    "motivo_consulta": "Patient complaint",
    "historico_risco": "Risk history",
    "exames_imagem": "Imaging exams",
    "exame_fisico": "Physical exam findings",
    "avaliacao_diagnostico": "Diagnosis",
    "recomendacoes": "Recommendations"
  },
  "currentEvaluation": {
    "id": "eval_uuid",
    "rating": 5,
    "comment": "Excellent service"
  },
  "patientSummary": {
    "fullName": "Patient Name",
    "birthDate": "1990-01-15",
    "sex": "M",
    "latestRiskHistory": "Diabetes"
  }
}
```

### Zoom Session Initialization

**Hook:** [src/hooks/useZoomSession.ts](src/hooks/useZoomSession.ts)

```typescript
const zoomSession = useZoomSession({
  consultationId: consultationId || '',
  participantRole: isProfissional ? 'professional' : 'patient',
  userId: user?.id || '',
  userName: zoomDisplayName,
});
```

**Zoom Credentials Built:** [src/lib/zoom.js](src/lib/zoom.js)

```javascript
// buildZoomSessionName()
const sessionName = consulta?.sala_id || `consulta-${consulta?.id}`;
// Result: "room_name_123" (max 200 chars)

// buildZoomSessionKey()
const sessionKey = stripUnsafeCharacters(consulta?.token_sala) || consultaId;
// Result: "zoom_session_token" (max 36 chars)

// buildZoomUserIdentity()
const userIdentity = participantRole === 'professional'
  ? `pr-${sanitizedUserId}` // prefix 'pr-'
  : `pt-${sanitizedUserId}`; // prefix 'pt-'
// Result: "pr-user_id" or "pt-user_id" (max 35 chars)

// buildZoomDisplayName()
const displayName = user?.full_name || consulta?.profissional_nome;
// Result: "Dr. João Silva" (max 64 chars)
```

### Start Consultation Session

**Mutation:** [src/pages/Teleconsulta.jsx](src/pages/Teleconsulta.jsx#L153)

```javascript
const startConsulta = useMutation({
  mutationFn: () => startConsultaSessionRequest({ consultationId }),
  onSuccess: () => {
    refreshContext();
    refreshActiveConsultation();
  },
});
```

**API Call:** [src/client-api/teleconsulta.js](src/client-api/teleconsulta.js)

```javascript
export async function startConsultaSessionRequest({ consultationId }) {
  return invokeEdgeFunction('start-consulta-session', {
    body: { consultationId },
    fallbackMessage: 'Não foi possível iniciar a teleconsulta.',
  });
}
```

**Edge Function:** `start-consulta-session`

**Changes:**
- Update `consultas` table: `status = 'em_atendimento'`, `inicio_at = now()`
- Professional dashboard: Shows consultation in active list
- Participant can now join video session

### Video Stage (Zoom Video)

**Component:** [src/components/teleconsulta/ZoomVideoStage.jsx](src/components/teleconsulta/ZoomVideoStage.jsx)

**Functionality:**
- Displays video feed of both participants
- Buttons: Toggle Video (VideoOff), Toggle Audio (MicOff), Hang Up (PhoneOff)
- Participant list
- Screen share (if available)

### Medical Record Entry (Prontuário)

**Component:** [src/components/teleconsulta/ProntuarioForm.jsx](src/components/teleconsulta/ProntuarioForm.jsx)

**Two Modes:**

1. **Simple Mode**
   - Field: `motivo_consulta` (required)
   - Field: `recomendacoes` (required)

2. **Complete Mode**
   - Fields: `motivo_consulta`, `historico_risco`, `exames_imagem`, `exame_fisico`, `avaliacao_diagnostico`, `recomendacoes`

**Submission:**

```javascript
const upsertProntuario = useMutation({
  mutationFn: (data) => upsertProntuarioRequest({
    consultationId,
    ...data, // motivo_consulta, recomendacoes, etc.
  }),
  onSuccess: () => {
    toast({ title: 'Prontuário salvo!' });
    refreshContext();
  },
});
```

**Edge Function:** `upsert-prontuario`

**Database:**
```sql
INSERT INTO prontuarios (
  consulta_id, paciente_id, profissional_id,
  modo, motivo_consulta, recomendacoes,
  historico_risco, exames_imagem, exame_fisico, avaliacao_diagnostico,
  created_date, updated_at
) VALUES (...)
```

### Chat Panel (Optional)

**Component:** [src/components/teleconsulta/ZoomChatPanel.jsx](src/components/teleconsulta/ZoomChatPanel.jsx)

**Features:**
- Real-time messaging during consultation
- Uses Zoom SDK's native chat
- Visible to both participants

### End Consultation

**Trigger:** Either participant clicks "Encerrar Consulta" (PhoneOff button)

**Mutation:**

```javascript
const finishConsulta = useMutation({
  mutationFn: () => finishConsultaRequest({ consultationId }),
  onSuccess: () => {
    refreshContext();
    navigate(getDashboardPath(user?.role)); // Return to dashboard
  },
});
```

**API Call:** [src/client-api/teleconsulta.js](src/client-api/teleconsulta.js)

```javascript
export async function finishConsultaRequest({ consultationId }) {
  return invokeEdgeFunction('finish-consulta', {
    body: { consultationId },
    fallbackMessage: 'Não foi possível finalizar a teleconsulta.',
  });
}
```

**Edge Function:** `finish-consulta`

**Changes:**
- Update `consultas` table: `status = 'finalizada'`, `fim_at = now()`
- Zoom session closed
- Redirect to dashboard

### Patient Evaluation

**Component:** [src/components/teleconsulta/AvaliacaoModal.jsx](src/components/teleconsulta/AvaliacaoModal.jsx)

**Shown After:** Professional ends consultation

**Fields:**
- Rating: 1-5 stars
- Comment: Optional text

**Submission:**

```javascript
const submitEvaluation = useMutation({
  mutationFn: (data) => submitConsultaEvaluation({
    consultationId,
    rating: data.rating,
    comment: data.comment,
  }),
  onSuccess: () => {
    refreshContext();
    refreshDashboardQueries();
  },
});
```

**Edge Function:** `submit-consulta-evaluation`

**Database:**
```sql
INSERT INTO avaliacao_consulta (
  consulta_id, paciente_id, profissional_id,
  nota, comentario, created_date
) VALUES (...)
```

### Data Flow Diagram

```
[DashboardPaciente] Patient clicks "Entrar na Consulta"
  ↓
[Teleconsulta.jsx] Validates time window & loads context
  ↓ getTeleconsultaContextRequest()
    ↓ Edge Function: get-teleconsulta-context
      ↓ Query: consultas, prontuarios, avaliacao_consulta
        ↓ Return consultation data + participant info
  ↓
[useZoomSession] Initialize Zoom Video SDK
  ↓ buildZoomSessionName/Key/UserIdentity/DisplayName
    ↓ Zoom SDK joins room
      ↓ Video conference active
  ↓
[startConsultaSessionRequest] Start session (if professional)
  ↓ Edge Function: start-consulta-session
    ↓ UPDATE consultas SET status='em_atendimento'
  ↓
[ZoomVideoStage] Video feed active
  ├─ Toggle video/audio
  ├─ [ZoomChatPanel] Send messages
  │
  ├─ [ProntuarioForm] Professional fills medical record
  │   ↓ upsertProntuarioRequest()
  │     ↓ Edge Function: upsert-prontuario
  │       ↓ INSERT/UPDATE prontuarios
  │
  ├─ Consultation active
  │
  └─ Either participant clicks "Sair"
      ↓ finishConsultaRequest()
        ↓ Edge Function: finish-consulta
          ↓ UPDATE consultas SET status='finalizada'
            ↓ Zoom session ends
              ↓ [AvaliacaoModal] Patient rates (5-10 sec delay)
                ↓ submitConsultaEvaluation()
                  ↓ Edge Function: submit-consulta-evaluation
                    ↓ INSERT avaliacao_consulta
                      ↓ Redirect to dashboard
```

---

## 4. PROFESSIONAL DASHBOARD FLOW

### Start Point
[src/pages/DashboardProfissional.jsx](src/pages/DashboardProfissional.jsx)

Protected by [src/components/ProtectedRoute.jsx](src/components/ProtectedRoute.jsx) - requires `role='professional'`

### Dashboard Initialization

**Files:**
- [src/pages/DashboardProfissional.jsx](src/pages/DashboardProfissional.jsx) - Main component
- [src/client-api/professionalDashboard.js](src/client-api/professionalDashboard.js) - API calls
- Sub-components: Dashboard sections

### Primary Data Queries

**1. Load Professional Profile**

```javascript
// DashboardProfissional.jsx - line 72
const { data: professional, isLoading: loadingProfessional } = useQuery({
  queryKey: ['myProfessionalProfile', user?.id],
  queryFn: async () => {
    const result = await getProfessionalDashboardRequest({ 
      appointmentsLimit: 1,
      includeQueue: false,
      includeQuestions: false,
      includeReviews: false 
    });
    return result?.professional || null;
  },
  enabled: !!user?.id,
  staleTime: 30_000,
});
```

**Edge Function:** `get-professional-dashboard`

**Request:**
```json
{
  "appointmentsLimit": 1,
  "includeQueue": false,
  "includeQuestions": false,
  "includeReviews": false
}
```

**Response (Professional Object):**
```json
{
  "id": "profile_uuid",
  "user_id": "user_uuid",
  "specialty": "Clínico Geral",
  "crm": "123456/SP",
  "bio": "Professional bio",
  "avatar_url": "https://...",
  "ratings_average": 4.5,
  "reviews_count": 42,
  "is_online_now": false,
  "response_time": 300
}
```

**2. Load Appointments**

```javascript
const { data: appointments = [], isLoading: loadingAppts } = useQuery({
  queryKey: ['profAppts', professional?.id],
  queryFn: async () => {
    const result = await getProfessionalDashboardRequest({ 
      appointmentsLimit: 200,
      includeQueue: false,
      includeQuestions: false,
      includeReviews: false 
    });
    return result?.appointments || [];
  },
  enabled: !!professional?.id,
});
```

**3. Load Queue (If On Duty)**

```javascript
const { data: queuePatients = [] } = useQuery({
  queryKey: ['queueWaiting', professional?.id, professional?.specialty],
  queryFn: async () => {
    const result = await getProfessionalDashboardRequest({ 
      appointmentsLimit: 1,
      includeQueue: true,
      includeQuestions: false,
      includeReviews: false 
    });
    return attachLaudoContextToQueue(result?.queueWaiting || []);
  },
  enabled: !!professional?.id && canWorkOnDuty(professional?.specialty) && currentDutyStatus,
  refetchInterval: currentDutyStatus ? 10000 : false, // Every 10 sec when on duty
});
```

**4. Load Pending Questions**

```javascript
const { data: pendingQuestions = [] } = useQuery({
  queryKey: ['pendingQuestions', professional?.id, professionalSpecialty],
  queryFn: async () => {
    const result = await getProfessionalDashboardRequest({ 
      appointmentsLimit: 1,
      includeQueue: false,
      includeQuestions: true,
      includeReviews: false 
    });
    return result?.pendingQuestions || [];
  },
  enabled: !!professional?.id && !!professionalSpecialty,
  refetchInterval: 30_000, // Every 30 sec
});
```

### Dashboard Tabs

#### Tab 1: Dashboard Overview

**Components:**
- [src/components/dashboard/KPICard.jsx](src/components/dashboard/KPICard.jsx) - Key metrics
- [src/components/dashboard/RevenueChart.jsx](src/components/dashboard/RevenueChart.jsx) - Revenue trend
- [src/components/dashboard/AppointmentsChart.jsx](src/components/dashboard/AppointmentsChart.jsx) - Appointments

**Metrics Displayed:**
```javascript
const filteredAppointments = filterByPeriod(appointments, period);
// period: 'today' | 'week' | 'month' | 'all'

const currentRevenue = filteredAppointments
  .filter(a => a.status === 'completed')
  .reduce((sum, a) => sum + (a.price || 0), 0);

const prevRevenue = prevPeriodRevenue(appointments, period);

const trend = Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100);

// Display KPI cards:
// - Total Revenue: R$ currentRevenue
// - Trend: +15% vs previous period
// - Completed Appointments: count
// - Average Rating: professional.ratings_average
```

#### Tab 2: Appointment Requests (Solicitações)

**Component:** [src/components/dashboard/SolicitacoesAgendamento.jsx](src/components/dashboard/SolicitacoesAgendamento.jsx)

**Filters:** Appointments with status='SOLICITADO' (awaiting acceptance)

**Display:**
- Patient name
- Requested date/time
- Specialty
- Symptoms
- Buttons: "Aceitar" (accept), "Recusar" (decline)

**Accept Appointment:**

```javascript
const acceptAppointment = useMutation({
  mutationFn: (appointmentId) => acceptAppointmentRequest({ appointmentId }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['profAppts'] });
  },
});
```

**Edge Function:** `accept-appointment`

**Changes:**
- Appointment status: SOLICITADO → CONFIRMADO
- Professional assigned if null
- Patient receives notification (via query refetch)

#### Tab 3: My Profile (Meu Perfil)

**Component:** [src/components/dashboard/MeuPerfil.jsx](src/components/dashboard/MeuPerfil.jsx)

**Editable Fields:**
- Full name
- Specialty
- CRM
- Bio/About
- Availability slots (day/time grid)
- Office locations
- Profile photo

**Submission:**

```javascript
const updateProfile = useMutation({
  mutationFn: (data) => upsertProfessionalProfileRequest(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['myProfessionalProfile'] });
  },
});
```

**Edge Function:** `upsert-professional-profile`

**Availability Slots:**

```javascript
// Format:
{
  day: 'monday', // monday-sunday
  start_time: '08:00',
  end_time: '18:00',
  slots: [
    { time: '08:00', available: true },
    { time: '08:30', available: true },
    ...
  ]
}
```

**Save Availability:**

```javascript
const saveAvailability = useMutation({
  mutationFn: (slots) => replaceAvailabilitySlotsRequest({ slots }),
  onSuccess: () => {
    toast({ title: 'Disponibilidade atualizada!' });
  },
});
```

**Edge Function:** `replace-availability-slots`

#### Tab 4: Queue Management (Plantão)

**Component:** [src/components/dashboard/QueueWidget.jsx](src/components/dashboard/QueueWidget.jsx)

**Toggle On-Duty Status:**

```javascript
const toggleDuty = useMutation({
  mutationFn: (isOnDuty) => setProfessionalDutyRequest({ isOnDuty }),
  onSuccess: (data) => {
    setSessionDutyState(data.isOnDuty);
    queryClient.invalidateQueries({ queryKey: ['myProfessionalProfile'] });
    
    if (data.isOnDuty) {
      // Start refetching queue
      queryClient.invalidateQueries({ queryKey: ['queueWaiting'] });
    }
  },
});
```

**Edge Function:** `set-professional-duty`

**Changes:**
- `professional_profiles.is_online_now = true/false`
- Visibility in queue listings updated
- Queue refetch interval starts/stops

**Queue Entry Display:**
- Patient name
- Symptoms/complaint
- Specialty
- Time in queue
- Button: "Atender" (accept) → Starts instant consultation

**Accept Queue Entry:**

```javascript
const acceptQueueEntry = useMutation({
  mutationFn: (queueId) => acceptQueueEntryRequest({ queueId }),
  onSuccess: (data) => {
    navigate(`/consulta/${data.consultationId}`);
  },
});
```

**Edge Function:** `accept-queue-entry`

**Changes:**
- Queue status: waiting → in_progress
- Creates consultation record
- Redirects to [Teleconsulta.jsx](src/pages/Teleconsulta.jsx)

#### Tab 5: Pending Questions

**Component:** [src/components/dashboard/QuestionsList.jsx](src/components/dashboard/QuestionsList.jsx)

**Display:**
- Patient name
- Question title
- Question content
- Date posted
- Button: "Responder" (answer)

**Answer Question:**

```javascript
const answerQuestion = useMutation({
  mutationFn: (data) => answerQuestionRequest({
    questionId: data.question_id,
    answerText: data.answer_text,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['pendingQuestions'] });
    queryClient.invalidateQueries({ queryKey: ['answeredQuestions'] });
  },
});
```

**Edge Function:** `answer-question`

**Database:**
```sql
UPDATE questions SET
  answered_by_professional_id = professional_id,
  answer_text = ?,
  answered_at = now()
WHERE id = question_id
```

### Financial Tracking

**Component:** [src/components/dashboard/FinancialWidget.jsx](src/components/dashboard/FinancialWidget.jsx)

**Data:**
- Total earnings (from completed appointments)
- Pending payments (not yet withdrawn)
- Last withdrawal date
- Withdrawal history

**Withdrawal Request:**

```javascript
const requestWithdrawal = useMutation({
  mutationFn: (amount) => requestWithdrawalRequest({
    amount,
    professionalId: professional.id,
  }),
  onSuccess: () => {
    toast({ title: 'Solicitação de saque enviada!' });
  },
});
```

**Edge Function:** `request-withdrawal`

**Database:**
```sql
INSERT INTO saques (
  profissional_id, valor, status, created_at
) VALUES (?, ?, 'pending', now())
```

---

## 5. PATIENT DASHBOARD FLOW

### Start Point
[src/pages/DashboardPaciente.jsx](src/pages/DashboardPaciente.jsx)

Protected by [src/components/ProtectedRoute.jsx](src/components/ProtectedRoute.jsx) - requires `role='patient'`

### Dashboard Sections

#### Section 1: Active Consultation Alert

**Component:** [src/components/teleconsulta/ResumeConsultationCard.jsx](src/components/teleconsulta/ResumeConsultationCard.jsx)

**Query:** `['myActiveConsultation', user?.id]` from [src/hooks/useMyActiveConsultation.js](src/hooks/useMyActiveConsultation.js)

```javascript
export function useMyActiveConsultation({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['myActiveConsultation', useAuth()?.user?.id],
    queryFn: () => getMyActiveConsultationRequest(),
    enabled,
    refetchInterval: 10000, // Every 10 sec
  });
}
```

**Edge Function:** `get-my-active-consultation`

**Response:**
```json
{
  "id": "consulta_uuid",
  "status": "em_atendimento",
  "profissional_nome": "Dr. João",
  "especialidade": "Clínico Geral",
  "inicio_at": "2025-05-20T14:00:00",
  "room_url": "https://zoom.link"
}
```

**Display:**
- Alert banner with consultation details
- Button: "Entrar na Consulta"
- Countdown to consultation start (if scheduled for future)

#### Section 2: Appointments Tabs

**Query:** [src/pages/DashboardPaciente.jsx](src/pages/DashboardPaciente.jsx#L42)

```javascript
const { data: appointments = [], isLoading } = useQuery({
  queryKey: ['patientAppointments', user?.id],
  queryFn: () => entities.Appointment.filter(
    { patient_id: user.id },
    '-scheduled_datetime'
  ),
  enabled: !!user?.id,
});
```

**Tabs:**

**Tab A: Próximas Consultas (Upcoming)**

```javascript
const todayStr = new Date().toISOString().slice(0, 10);
const upcomingAppointments = appointments.filter(a => {
  const dateStr = a.scheduled_datetime?.slice(0, 10) || a.date;
  const activeStatuses = ['pending', 'accepted', 'confirmed', 'in_progress', 'SOLICITADO', 'CONFIRMADO'];
  return activeStatuses.includes(a.status) && dateStr >= todayStr;
});
```

**Display for Each Appointment:**
- Doctor name/avatar
- Specialty
- Date & time
- Status badge: SOLICITADO (amber), CONFIRMADO (green), IN_PROGRESS (blue)
- Symptoms
- Actions:
  - "Entrar na Consulta" (if time window valid)
  - "Cancelar"
  - Location/link (if available)

**Time Window Check:**
```javascript
const canEnterConsult = (appt) => {
  const isActive = ['accepted', 'CONFIRMADO', 'confirmed', 'in_progress'].includes(appt.status);
  const dtStr = appt.scheduled_datetime || appt.datetime;
  const now = new Date();
  const dt = new Date(dtStr);
  const from = new Date(dt.getTime() - 5 * 60 * 1000);      // 5 min before
  const to = new Date(dt.getTime() + 30 * 60 * 1000);       // 30 min after
  return isActive && now >= from && now <= to;
};
```

**Cancel Appointment:**

```javascript
const cancelAppointment = useMutation({
  mutationFn: (id) => cancelAppointmentRequest({ appointmentId: id }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['patientAppointments', user?.id] });
  },
});
```

**Edge Function:** `cancel-appointment` 
- Updates status to CANCELADO
- Frees up professional slot

**Tab B: Consultas Anteriores (Past)**

```javascript
const pastAppointments = appointments.filter(a => {
  const dateStr = a.scheduled_datetime?.slice(0, 10) || a.date;
  return ['completed', 'CONCLUIDO', 'EXPIRADO'].includes(a.status) || 
    (dateStr < todayStr && !['accepted', 'in_progress', 'cancelled', ...].includes(a.status));
});
```

**Review System:**

```javascript
// Check if already reviewed
const { data: myReviews = [] } = useQuery({
  queryKey: ['patientReviews', user?.id],
  queryFn: () => entities.Review.filter({ patient_id: user.id }),
  enabled: !!user?.id,
});

const reviewedAppointmentIds = new Set(myReviews.map(r => r.appointment_id));
```

**Rate Appointment:**

```javascript
const submitReview = useMutation({
  mutationFn: ({ appointment_id, rating, comment }) => 
    submitAppointmentReviewRequest({
      appointmentId: appointment_id,
      rating,
      comment,
    }),
  onSuccess: () => {
    setReviewModal({ open: false, appointment: null });
    // Invalidate multiple caches
    queryClient.invalidateQueries({ queryKey: ['patientAppointments'] });
    queryClient.invalidateQueries({ queryKey: ['patientReviews'] });
    queryClient.invalidateQueries({ queryKey: ['profReviews'] });
    queryClient.invalidateQueries({ queryKey: ['myProfessionalProfile'] });
  },
});
```

**Modal:** [src/components/teleconsulta/AvaliacaoModal.jsx](src/components/teleconsulta/AvaliacaoModal.jsx)
- Rating: 1-5 stars
- Comment: Optional textarea

**Edge Function:** `submit-appointment-review`

**Database:**
```sql
INSERT INTO reviews (
  appointment_id, patient_id, professional_id,
  rating, comment, created_at
) VALUES (?, ?, ?, ?, ?, now())
```

**Professional Impact:**
- Review visible in professional's public profile
- Average rating recalculated
- Review count incremented

**Tab C: Canceladas (Cancelled)**

```javascript
const cancelledAppointments = appointments.filter(a => 
  ['cancelled', 'CANCELADO'].includes(a.status)
);
```

**Display:**
- Same as past appointments
- Button: "Agendar Novamente" → Returns to booking wizard

### Quick Actions

**Buttons on Dashboard:**

| Button | Navigation | Action |
|--------|-----------|--------|
| "Agendar Consulta" | AgendamentoEspecialidade | Start appointment booking |
| "Consulta Agora" | ConsultaAgora | Join instant queue |
| "Laudos Médicos" | LaudosMedicos | View medical records |
| "Solicitar Exames" | SolicitacaoExames | Request medical exams |
| "Pergunte ao Especialista" | PergunteEspecialista | Browse Q&A forum |
| "Meu Perfil" | Perfil | Edit personal info |

### Pull-to-Refresh

**Component:** [src/components/PullToRefresh.jsx](src/components/PullToRefresh.jsx)

```javascript
const handleRefresh = async () => {
  await queryClient.invalidateQueries({ 
    queryKey: ['patientAppointments', user?.id] 
  });
};
```

---

## 6. MEDICAL EXAMS REQUEST FLOW

### Overview
Three types of requests: Check-Up (routine), Specific Exams, and Prescription Renewal. Some route to instant consultation queue.

### Start Point
[src/pages/SolicitacaoExames.jsx](src/pages/SolicitacaoExames.jsx)

**Files:**
- [src/pages/SolicitacaoExames.jsx](src/pages/SolicitacaoExames.jsx) - UI dialogs
- [src/lib/solicitacoesExames.js](src/lib/solicitacoesExames.js) - Business logic
- [src/client-api/solicitacoesExames.js](src/client-api/solicitacoesExames.js) - API calls

### Type 1: Check-Up Request

**Dialog: "Solicitar Check-Up"**

**Steps:**

1. **Confirmation**
   ```javascript
   const [checkupConfirmed, setCheckupConfirmed] = useState(false);
   // Checkbox: "Entendi que será uma solicitação..."
   ```

2. **Submit**
   ```javascript
   async function handleCheckupSubmit() {
     setCheckupLoading(true);
     try {
       await createCheckupRequest(user);
       toast({
         title: 'Solicitação enviada!',
         description: 'Seu pedido de Check-Up foi enviado para a fila direta do clínico geral.',
       });
     } catch (error) {
       toast({ variant: 'destructive', title: 'Erro' });
     }
   }
   ```

3. **Function Call** [src/lib/solicitacoesExames.js](src/lib/solicitacoesExames.js#L28)
   ```javascript
   export async function createCheckupRequest(user) {
     ensureAuthenticatedUser(user);
     
     return createSolicitacaoExame({
       tipo: 'checkup',
       exameSolicitado: 'Check-Up Completo',
       motivo: 'Exames de rotina / check-up preventivo',
       sintomas: '',
       assintomaticoConfirmado: true,
       fluxoDestino: 'dashboard',
       especialidadeDestino: 'clinico_geral',
     });
   }
   ```

4. **API Call** [src/lib/solicitacoesExames.js](src/lib/solicitacoesExames.js#L24)
   ```javascript
   async function createSolicitacaoExame(payload) {
     return createSolicitacaoExameRequest(payload);
   }
   ```
   
   Calls: [src/client-api/solicitacoesExames.js](src/client-api/solicitacoesExames.js)

5. **Edge Function:** `create-solicitacao-exame`
   ```json
   {
     "tipo": "checkup",
     "exameSolicitado": "Check-Up Completo",
     "motivo": "Exames de rotina / check-up preventivo",
     "sintomas": "",
     "assintomaticoConfirmado": true,
     "fluxoDestino": "dashboard",
     "especialidadeDestino": "clinico_geral"
   }
   ```

6. **Database:**
   ```sql
   INSERT INTO solicitacoes_exames (
     paciente_id, tipo, exame_solicitado, motivo, sintomas,
     assintomatico_confirmado, fluxo_destino, especialidade_destino,
     status, created_at
   ) VALUES (?, 'checkup', ..., 'pending', now())
   ```

7. **Result:** Success message, dialog closes

### Type 2: Specific Exam Request

**Dialog: "Solicitar Exames Específicos"**

**Fields:**
- `exame` (required): "Eletrocardiograma", "Ultrassom", etc.
- `motivo` (optional): Reason for exam
- `sintomas` (optional): Symptoms

**Steps:**

1. **Input Validation**
   ```javascript
   if (!exame.trim()) {
     return; // Show error
   }
   ```

2. **Function Call** [src/lib/solicitacoesExames.js](src/lib/solicitacoesExames.js#L40)
   ```javascript
   export async function createSpecificExamRequest(user, { exame, motivo, sintomas }) {
     ensureAuthenticatedUser(user);
     
     return createSolicitacaoExame({
       tipo: 'especificos',
       exameSolicitado: exame,
       motivo: motivo || '',
       sintomas: sintomas || '',
       assintomaticoConfirmado: false,
       fluxoDestino: 'plantao', // Routes to queue!
       especialidadeDestino: 'clinico_geral',
     });
   }
   ```

3. **Build Symptoms String**
   ```javascript
   export function buildSpecificExamSymptoms({ exame, motivo, sintomas }) {
     const parts = [
       exame ? `[Solicitação de Exame: ${exame}]` : '',
       motivo ? `Motivo: ${motivo}` : '',
       sintomas ? `Sintomas: ${sintomas}` : '',
     ].filter(Boolean);
     
     return parts.join('. ');
     // Result: "[Solicitação de Exame: ECG]. Motivo: Palpitações. Sintomas: Taquicardia"
   }
   ```

4. **Create Exam Request**
   - Edge Function: `create-solicitacao-exame`
   - Creates record in `solicitacoes_exames` table

5. **Redirect to Instant Consultation**
   ```javascript
   const sintomasCompletos = buildSpecificExamSymptoms({ exame, motivo, sintomas });
   
   persistSpecificExamRedirect({
     especialidade: 'clinico_geral',
     sintomas: sintomasCompletos,
     exame: exame.trim(),
     motivo: motivo.trim(),
     descricao_original_sintomas: sintomas.trim(),
   });
   
   navigate(`/ConsultaAgora?especialidade=clinico_geral&sintomas=${encodeURIComponent(sintomasCompletos)}`);
   ```

6. **Result:** Patient redirected to instant consultation flow with symptoms pre-filled

### Type 3: Prescription Renewal Request

**Accessed From:** [src/pages/RenovacaoReceitas.jsx](src/pages/RenovacaoReceitas.jsx)

**Fields:**
- `nomeMedicamento` (required): Medication name
- `dosagem` (required): Dosage
- `frequencia` (required): Frequency
- `arquivo` (required): Prescription file (PDF/JPG/PNG, max 10MB)

**File Validation:** [src/lib/solicitacoesExames.js](src/lib/solicitacoesExames.js#L87)

```javascript
export function validateMedicalSupportFile(file, { required = false } = {}) {
  if (!file && required) return 'Envie um arquivo obrigatório.';
  
  if (file.size > 10 * 1024 * 1024) {
    return `O arquivo ${file.name} excede o limite de 10MB.`;
  }
  
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `O arquivo ${file.name} tem um formato inválido. Use PDF, JPG ou PNG.`;
  }
  
  return null;
}
```

**Steps:**

1. **File Upload**
   - If validation passes, upload to storage
   - Get URL: `arquivoReceitaUrl`

2. **Function Call** [src/lib/solicitacoesExames.js](src/lib/solicitacoesExames.js#L54)
   ```javascript
   export async function createPrescriptionRenewalRequest(user, {
     nomeMedicamento,
     dosagem,
     frequencia,
     arquivoReceitaUrl,
   }) {
     ensureAuthenticatedUser(user);
     
     return createSolicitacaoExame({
       tipo: 'renovacao_receitas',
       exameSolicitado: '',
       motivo: '',
       sintomas: '',
       assintomaticoConfirmado: false,
       nomeMedicamento,
       dosagem,
       frequencia,
       arquivoReceitaUrl,
       fluxoDestino: 'dashboard',
       especialidadeDestino: 'clinico_geral',
     });
   }
   ```

3. **Edge Function:** `create-solicitacao-exame`

4. **Database:**
   ```sql
   INSERT INTO solicitacoes_exames (
     paciente_id, tipo, nome_medicamento, dosagem, frequencia,
     arquivo_receita_url, fluxo_destino, especialidade_destino,
     status, created_at
   ) VALUES (?, 'renovacao_receitas', ..., 'pending', now())
   ```

5. **Result:** Confirmation message, returns to dashboard

### Admin Approval Flow

**For:** Check-Up requests routed to "dashboard" → Admin reviews

**Process:**
1. Request appears in admin queue
2. Admin reviews medical necessity
3. Admin approves/denies
4. Patient notified via email/notification
5. Approved exam request added to patient's records

### Backend Processing

**Edge Function:** `create-solicitacao-exame`

**Logic:**
```
1. Validate user authenticated + payload valid
2. If fluxoDestino='plantao':
   a. Create solicitacao_exame record (status='pending')
   b. Create queue entry automatically
   c. Patient added to clinico_geral queue
   d. Next available professional notified
3. If fluxoDestino='dashboard':
   a. Create solicitacao_exame record (status='pending')
   b. Route to admin approval queue
   c. Admin reviews before professional sees
4. Return solicitacao object
```

---

## ERROR HANDLING PATTERNS

### Authentication Errors

**File:** [src/lib/errors.js](src/lib/errors.js)

```javascript
const ERROR_MESSAGES = {
  'ACCOUNT_NOT_FOUND': 'Conta não encontrada.',
  'ACCOUNT_INACTIVE': 'Sua conta está inativa no momento.',
  'AUTH_SESSION_NOT_CREATED': 'Login concluído, mas a sessão não foi iniciada automaticamente.',
  'AUTH_SESSION_REQUIRED': 'Autenticação obrigatória.',
  'FULL_NAME_INVALID': 'Informe um nome completo válido.',
  'EMAIL_ALREADY_EXISTS': 'E-mail já cadastrado.',
  'INVALID_CREDENTIALS': 'E-mail ou senha inválida.',
};

export function getUserFacingErrorMessage(error, fallbackMessage) {
  if (error?.userMessage) return error.userMessage;
  if (ERROR_MESSAGES[error?.code]) return ERROR_MESSAGES[error.code];
  return fallbackMessage;
}
```

### API Error Handling

**File:** [src/client-api/edgeFunctions.js](src/client-api/edgeFunctions.js)

```javascript
async function executeEdgeFunction(functionName, {
  body,
  fallbackMessage,
  authMode,
}) {
  const response = await fetch(`${env.edgeFunctionsBaseUrl}/${functionName}`, {
    method: 'POST',
    headers: buildHeaders({ body, authMode }),
    body: buildRequestBody(body),
  });
  
  const payload = await parseResponsePayload(response);
  
  if (!response.ok) {
    const error = createFunctionError({
      message: payload?.message || fallbackMessage,
      code: payload?.code || 'EDGE_FUNCTION_ERROR',
      status: response.status,
      details: payload?.details,
    });
    
    throw error;
  }
  
  return payload?.data || payload;
}
```

### Mutation Error Handling

**Pattern:**
```javascript
useMutation({
  mutationFn: async () => { /* API call */ },
  onSuccess: (data) => {
    toast({ title: 'Sucesso!' });
    queryClient.invalidateQueries({ /* ... */ });
  },
  onError: (error) => {
    toast({
      variant: 'destructive',
      title: 'Erro',
      description: error.message || 'Algo deu errado',
    });
  },
});
```

### Session Error Recovery

**File:** [src/services/authService.js](src/services/authService.js)

```javascript
async function clearInactiveSession(error, stage) {
  if (error?.code !== 'ACCOUNT_INACTIVE') {
    return;
  }
  
  try {
    clearStoredSession(); // Remove token
  } catch (signOutError) {
    logUiWarning('auth', {
      stage,
      error: serializeError(signOutError),
    });
  }
}

// Usage:
try {
  // API call
} catch (error) {
  await clearInactiveSession(error, 'restore-signout-inactive');
  throw normalizeAccountError(error, 'Não foi possível restaurar a sessão.');
}
```

---

## SESSION STORAGE KEYS

| Key | Location | Purpose | Example Value |
|-----|----------|---------|----------------|
| `rd.auth.session.v1` | localStorage | Authentication token | `{"accessToken":"jwt..","refreshToken":".."}` |
| `rd_login_next` | sessionStorage | Post-login redirect | `/DashboardPaciente` |
| `rd_last_active_consultation` | sessionStorage | Resume consultation | `{"consultationId":"uuid"}` |
| `rd_consulta_agora_auto_resume` | sessionStorage | Instant queue resume | `{"queueId":"uuid"}` |
| `rd.laudosMedicos.wizard` | sessionStorage | Laudo wizard state | `{"tipoLaudo":"clinical"}` |
| `rd.solicitacaoExames.plantao` | sessionStorage | Exam redirect context | `{"sintomas":"..."}` |

---

## REACT QUERY CACHE KEYS

| Query Key | Scope | Refetch Interval | Purpose |
|-----------|-------|------------------|---------|
| `['patientAppointments', user?.id]` | Patient | On focus | List patient appointments |
| `['profAppts', professional?.id]` | Professional | On focus | List professional appointments |
| `['queueWaiting', prof?.id, prof?.specialty]` | Professional | 10s (if on duty) | Waiting queue patients |
| `['myProfessionalProfile', user?.id]` | Professional | 30s | Professional profile data |
| `['myPublicProfile', pro?.id]` | Professional | 60s | Public profile |
| `['pendingQuestions', prof?.id, specialty]` | Professional | 30s | Unanswered questions |
| `['myActiveConsultation', user?.id]` | Patient/Prof | 10s | Currently active consultation |
| `['teleconsulta-context', consultationId]` | Patient/Prof | 5s | Consultation context data |
| `['patientReviews', user?.id]` | Patient | On focus | Patient's submitted reviews |
| `['profReviews']` | Professional | On focus | Reviews of professional |

---

## SECURITY CONSIDERATIONS

### Token Management
- **Storage:** JWT tokens in localStorage (accessible to XSS)
- **Expiry:** Handled by Edge Function token validation
- **Refresh:** Automatic via `ensureFreshSession()` before each request
- **Revocation:** Logout clears localStorage + sessionStorage

### Authorization
- **Frontend:** Role checks via `user?.role` (NOT secure alone)
- **Backend:** Edge Functions validate role via RLS policies + token claims
- **Protected Routes:** [ProtectedRoute.jsx](src/components/ProtectedRoute.jsx) checks user existence + role

### Data Isolation
- **Patients:** Can only see own appointments, reviews
- **Professionals:** Can only accept/view appointments for their specialties
- **Admins:** Can review professional applications, access approval queues

### CORS & API
- **CORS:** Configured on Supabase for frontend domain
- **API Key:** Publishable key used in client-side calls
- **Bearer Token:** Added to Authorization header for authenticated requests

