export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          address: string | null
          birth_date: string | null
          city: string | null
          cpf: string | null
          created_date: string
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          password_hash: string
          phone: string | null
          profile_complete: boolean | null
          role: string
          session_token: string | null
          sex: string | null
          state: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_date?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          password_hash: string
          phone?: string | null
          profile_complete?: boolean | null
          role?: string
          session_token?: string | null
          sex?: string | null
          state?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_date?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          password_hash?: string
          phone?: string | null
          profile_complete?: boolean | null
          role?: string
          session_token?: string | null
          sex?: string | null
          state?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          accepted_at: string | null
          appointment_type: string | null
          cancellation_reason: string | null
          consulta_id: string | null
          created_date: string
          date: string | null
          id: string
          meeting_link: string | null
          notes: string | null
          patient_email: string | null
          patient_id: string
          patient_name: string | null
          price: number | null
          professional_id: string | null
          professional_name: string | null
          scheduled_datetime: string | null
          specialty: string | null
          status: string | null
          symptoms: string | null
          time: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          appointment_type?: string | null
          cancellation_reason?: string | null
          consulta_id?: string | null
          created_date?: string
          date?: string | null
          id?: string
          meeting_link?: string | null
          notes?: string | null
          patient_email?: string | null
          patient_id: string
          patient_name?: string | null
          price?: number | null
          professional_id?: string | null
          professional_name?: string | null
          scheduled_datetime?: string | null
          specialty?: string | null
          status?: string | null
          symptoms?: string | null
          time?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          appointment_type?: string | null
          cancellation_reason?: string | null
          consulta_id?: string | null
          created_date?: string
          date?: string | null
          id?: string
          meeting_link?: string | null
          notes?: string | null
          patient_email?: string | null
          patient_id?: string
          patient_name?: string | null
          price?: number | null
          professional_id?: string | null
          professional_name?: string | null
          scheduled_datetime?: string | null
          specialty?: string | null
          status?: string | null
          symptoms?: string | null
          time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      availability_slots: {
        Row: {
          created_date: string
          id: string
          professional_id: string
          time_slot: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_date?: string
          id?: string
          professional_id: string
          time_slot: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_date?: string
          id?: string
          professional_id?: string
          time_slot?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      avaliacao_consulta: {
        Row: {
          comentario: string | null
          consulta_id: string
          created_date: string
          id: string
          nota: number
          paciente_id: string
          profissional_id: string
          updated_at: string
        }
        Insert: {
          comentario?: string | null
          consulta_id: string
          created_date?: string
          id?: string
          nota: number
          paciente_id: string
          profissional_id: string
          updated_at?: string
        }
        Update: {
          comentario?: string | null
          consulta_id?: string
          created_date?: string
          id?: string
          nota?: number
          paciente_id?: string
          profissional_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      consultas: {
        Row: {
          created_date: string
          datetime: string | null
          descricao_sintomas: string | null
          especialidade: string | null
          fim_at: string | null
          id: string
          inicio_at: string | null
          paciente_email: string | null
          paciente_id: string
          paciente_nome: string | null
          preco: number | null
          profissional_id: string
          profissional_nome: string | null
          sala_id: string | null
          status: string | null
          tipo_consulta: string
          token_sala: string | null
          updated_at: string
        }
        Insert: {
          created_date?: string
          datetime?: string | null
          descricao_sintomas?: string | null
          especialidade?: string | null
          fim_at?: string | null
          id?: string
          inicio_at?: string | null
          paciente_email?: string | null
          paciente_id: string
          paciente_nome?: string | null
          preco?: number | null
          profissional_id: string
          profissional_nome?: string | null
          sala_id?: string | null
          status?: string | null
          tipo_consulta: string
          token_sala?: string | null
          updated_at?: string
        }
        Update: {
          created_date?: string
          datetime?: string | null
          descricao_sintomas?: string | null
          especialidade?: string | null
          fim_at?: string | null
          id?: string
          inicio_at?: string | null
          paciente_email?: string | null
          paciente_id?: string
          paciente_nome?: string | null
          preco?: number | null
          profissional_id?: string
          profissional_nome?: string | null
          sala_id?: string | null
          status?: string | null
          tipo_consulta?: string
          token_sala?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mensagem_consulta: {
        Row: {
          anexo_url: string | null
          consulta_id: string
          created_date: string
          id: string
          mensagem: string
          remetente_id: string
          remetente_nome: string | null
          remetente_tipo: string | null
          updated_at: string
        }
        Insert: {
          anexo_url?: string | null
          consulta_id: string
          created_date?: string
          id?: string
          mensagem: string
          remetente_id: string
          remetente_nome?: string | null
          remetente_tipo?: string | null
          updated_at?: string
        }
        Update: {
          anexo_url?: string | null
          consulta_id?: string
          created_date?: string
          id?: string
          mensagem?: string
          remetente_id?: string
          remetente_nome?: string | null
          remetente_tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_profiles: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_date: string
          id: string
          phone: string | null
          sex: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_date?: string
          id?: string
          phone?: string | null
          sex?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_date?: string
          id?: string
          phone?: string | null
          sex?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_banking_data: {
        Row: {
          agencia: string | null
          banco: string | null
          chave_pix: string | null
          conta: string | null
          cpf_cnpj: string | null
          created_date: string
          digito_conta: string | null
          id: string
          nome_titular: string | null
          professional_id: string
          razao_social: string | null
          tipo_chave_pix: string | null
          tipo_conta: string | null
          tipo_pessoa: string | null
          tipo_recebimento: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          created_date?: string
          digito_conta?: string | null
          id?: string
          nome_titular?: string | null
          professional_id: string
          razao_social?: string | null
          tipo_chave_pix?: string | null
          tipo_conta?: string | null
          tipo_pessoa?: string | null
          tipo_recebimento?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          created_date?: string
          digito_conta?: string | null
          id?: string
          nome_titular?: string | null
          professional_id?: string
          razao_social?: string | null
          tipo_chave_pix?: string | null
          tipo_conta?: string | null
          tipo_pessoa?: string | null
          tipo_recebimento?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      professional_profiles: {
        Row: {
          available_days: string[] | null
          available_hours: string[] | null
          bio: string | null
          cpf: string | null
          created_date: string
          diploma_url: string | null
          full_name: string
          graduation_year: number | null
          id: string
          is_on_duty: boolean | null
          is_verified: boolean | null
          perfil_ativo: boolean | null
          phone: string | null
          photo_url: string | null
          price_priority: number | null
          price_standard: number | null
          prioritario_ativo: boolean | null
          profession: string
          rating: number | null
          register_number: string
          register_state: string
          rqe: string | null
          sex: string | null
          specialty: string
          status: string | null
          total_reviews: number | null
          university: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_days?: string[] | null
          available_hours?: string[] | null
          bio?: string | null
          cpf?: string | null
          created_date?: string
          diploma_url?: string | null
          full_name: string
          graduation_year?: number | null
          id?: string
          is_on_duty?: boolean | null
          is_verified?: boolean | null
          perfil_ativo?: boolean | null
          phone?: string | null
          photo_url?: string | null
          price_priority?: number | null
          price_standard?: number | null
          prioritario_ativo?: boolean | null
          profession: string
          rating?: number | null
          register_number: string
          register_state: string
          rqe?: string | null
          sex?: string | null
          specialty: string
          status?: string | null
          total_reviews?: number | null
          university?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_days?: string[] | null
          available_hours?: string[] | null
          bio?: string | null
          cpf?: string | null
          created_date?: string
          diploma_url?: string | null
          full_name?: string
          graduation_year?: number | null
          id?: string
          is_on_duty?: boolean | null
          is_verified?: boolean | null
          perfil_ativo?: boolean | null
          phone?: string | null
          photo_url?: string | null
          price_priority?: number | null
          price_standard?: number | null
          prioritario_ativo?: boolean | null
          profession?: string
          rating?: number | null
          register_number?: string
          register_state?: string
          rqe?: string | null
          sex?: string | null
          specialty?: string
          status?: string | null
          total_reviews?: number | null
          university?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_public_profiles: {
        Row: {
          available_days: string[] | null
          available_hours: string[] | null
          bio: string | null
          created_date: string
          education: string | null
          full_name: string
          gallery_urls: string[] | null
          graduation_year: number | null
          id: string
          instagram_url: string | null
          is_on_duty: boolean | null
          languages: string[] | null
          modality: string | null
          office_address: string | null
          office_city: string | null
          office_state: string | null
          patient_types: string[] | null
          perfil_ativo: boolean | null
          photo_url: string | null
          price_priority: number | null
          price_standard: number | null
          prioritario_ativo: boolean | null
          profession: string
          professional_profile_id: string
          rating: number | null
          register_number: string
          register_state: string
          rqe: string | null
          slug: string | null
          specialty: string
          status: string | null
          tags: string[] | null
          total_reviews: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          available_days?: string[] | null
          available_hours?: string[] | null
          bio?: string | null
          created_date?: string
          education?: string | null
          full_name: string
          gallery_urls?: string[] | null
          graduation_year?: number | null
          id?: string
          instagram_url?: string | null
          is_on_duty?: boolean | null
          languages?: string[] | null
          modality?: string | null
          office_address?: string | null
          office_city?: string | null
          office_state?: string | null
          patient_types?: string[] | null
          perfil_ativo?: boolean | null
          photo_url?: string | null
          price_priority?: number | null
          price_standard?: number | null
          prioritario_ativo?: boolean | null
          profession: string
          professional_profile_id: string
          rating?: number | null
          register_number: string
          register_state: string
          rqe?: string | null
          slug?: string | null
          specialty: string
          status?: string | null
          tags?: string[] | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          available_days?: string[] | null
          available_hours?: string[] | null
          bio?: string | null
          created_date?: string
          education?: string | null
          full_name?: string
          gallery_urls?: string[] | null
          graduation_year?: number | null
          id?: string
          instagram_url?: string | null
          is_on_duty?: boolean | null
          languages?: string[] | null
          modality?: string | null
          office_address?: string | null
          office_city?: string | null
          office_state?: string | null
          patient_types?: string[] | null
          perfil_ativo?: boolean | null
          photo_url?: string | null
          price_priority?: number | null
          price_standard?: number | null
          prioritario_ativo?: boolean | null
          profession?: string
          professional_profile_id?: string
          rating?: number | null
          register_number?: string
          register_state?: string
          rqe?: string | null
          slug?: string | null
          specialty?: string
          status?: string | null
          tags?: string[] | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      professionals: {
        Row: {
          available_days: string[] | null
          available_hours: string[] | null
          bio: string | null
          created_date: string
          crm: string
          education: string | null
          full_name: string
          id: string
          is_on_duty: boolean | null
          photo_url: string | null
          price_priority: number | null
          price_standard: number | null
          rating: number | null
          specialty: string
          status: string | null
          total_reviews: number | null
          updated_at: string
          user_id: string | null
          years_experience: number | null
        }
        Insert: {
          available_days?: string[] | null
          available_hours?: string[] | null
          bio?: string | null
          created_date?: string
          crm: string
          education?: string | null
          full_name: string
          id?: string
          is_on_duty?: boolean | null
          photo_url?: string | null
          price_priority?: number | null
          price_standard?: number | null
          rating?: number | null
          specialty: string
          status?: string | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string | null
          years_experience?: number | null
        }
        Update: {
          available_days?: string[] | null
          available_hours?: string[] | null
          bio?: string | null
          created_date?: string
          crm?: string
          education?: string | null
          full_name?: string
          id?: string
          is_on_duty?: boolean | null
          photo_url?: string | null
          price_priority?: number | null
          price_standard?: number | null
          rating?: number | null
          specialty?: string
          status?: string | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      prontuarios: {
        Row: {
          avaliacao_diagnostico: string | null
          consulta_id: string
          created_date: string
          exame_fisico: string | null
          exames_imagem: string | null
          historico_risco: string | null
          id: string
          modo: string | null
          motivo_consulta: string | null
          paciente_id: string | null
          profissional_id: string | null
          recomendacoes: string | null
          updated_at: string
        }
        Insert: {
          avaliacao_diagnostico?: string | null
          consulta_id: string
          created_date?: string
          exame_fisico?: string | null
          exames_imagem?: string | null
          historico_risco?: string | null
          id?: string
          modo?: string | null
          motivo_consulta?: string | null
          paciente_id?: string | null
          profissional_id?: string | null
          recomendacoes?: string | null
          updated_at?: string
        }
        Update: {
          avaliacao_diagnostico?: string | null
          consulta_id?: string
          created_date?: string
          exame_fisico?: string | null
          exames_imagem?: string | null
          historico_risco?: string | null
          id?: string
          modo?: string | null
          motivo_consulta?: string | null
          paciente_id?: string | null
          profissional_id?: string | null
          recomendacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answered_at: string | null
          answered_by_professional_id: string | null
          answered_by_professional_name: string | null
          created_date: string
          id: string
          paciente_id: string | null
          paciente_nome: string | null
          pergunta: string
          public_profile_id: string | null
          resposta: string | null
          specialty: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          answered_by_professional_id?: string | null
          answered_by_professional_name?: string | null
          created_date?: string
          id?: string
          paciente_id?: string | null
          paciente_nome?: string | null
          pergunta: string
          public_profile_id?: string | null
          resposta?: string | null
          specialty?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          answered_by_professional_id?: string | null
          answered_by_professional_name?: string | null
          created_date?: string
          id?: string
          paciente_id?: string | null
          paciente_nome?: string | null
          pergunta?: string
          public_profile_id?: string | null
          resposta?: string | null
          specialty?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      queues: {
        Row: {
          assigned_professional_id: string | null
          created_date: string
          estimated_wait_time: number | null
          id: string
          patient_email: string | null
          patient_id: string
          patient_name: string | null
          position: number | null
          priority_level: string | null
          specialty: string | null
          status: string | null
          symptoms: string | null
          updated_at: string
        }
        Insert: {
          assigned_professional_id?: string | null
          created_date?: string
          estimated_wait_time?: number | null
          id?: string
          patient_email?: string | null
          patient_id: string
          patient_name?: string | null
          position?: number | null
          priority_level?: string | null
          specialty?: string | null
          status?: string | null
          symptoms?: string | null
          updated_at?: string
        }
        Update: {
          assigned_professional_id?: string | null
          created_date?: string
          estimated_wait_time?: number | null
          id?: string
          patient_email?: string | null
          patient_id?: string
          patient_name?: string | null
          position?: number | null
          priority_level?: string | null
          specialty?: string | null
          status?: string | null
          symptoms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          appointment_id: string | null
          comment: string | null
          created_date: string
          id: string
          patient_id: string | null
          patient_name: string | null
          professional_id: string
          rating: number | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          comment?: string | null
          created_date?: string
          id?: string
          patient_id?: string | null
          patient_name?: string | null
          professional_id: string
          rating?: number | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          comment?: string | null
          created_date?: string
          id?: string
          patient_id?: string | null
          patient_name?: string | null
          professional_id?: string
          rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      saques: {
        Row: {
          created_date: string
          data_processamento: string | null
          data_solicitacao: string | null
          id: string
          metodo: string | null
          observacao: string | null
          professional_id: string
          status: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          created_date?: string
          data_processamento?: string | null
          data_solicitacao?: string | null
          id?: string
          metodo?: string | null
          observacao?: string | null
          professional_id: string
          status?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          created_date?: string
          data_processamento?: string | null
          data_solicitacao?: string | null
          id?: string
          metodo?: string | null
          observacao?: string | null
          professional_id?: string
          status?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      solicitacoes_exames: {
        Row: {
          assintomatico_confirmado: boolean | null
          created_date: string
          exame_solicitado: string | null
          id: string
          medico_id: string | null
          motivo: string | null
          paciente_id: string
          paciente_nome: string | null
          sintomas: string | null
          status: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          assintomatico_confirmado?: boolean | null
          created_date?: string
          exame_solicitado?: string | null
          id?: string
          medico_id?: string | null
          motivo?: string | null
          paciente_id: string
          paciente_nome?: string | null
          sintomas?: string | null
          status?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          assintomatico_confirmado?: boolean | null
          created_date?: string
          exame_solicitado?: string | null
          id?: string
          medico_id?: string | null
          motivo?: string | null
          paciente_id?: string
          paciente_nome?: string | null
          sintomas?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
