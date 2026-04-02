/**
 * Compatibility layer: replaces @base44/sdk with Supabase client
 * Mimics the base44.entities.X.create/filter/update/delete/list API
 */
import { supabase } from '@/integrations/supabase/client';

// Table name mapping (entity name -> PostgreSQL table name)
const TABLE_MAP = {
  AppUser: 'app_users',
  Appointment: 'appointments',
  AvailabilitySlot: 'availability_slots',
  AvaliacaoConsulta: 'avaliacao_consulta',
  Consulta: 'consultas',
  MensagemConsulta: 'mensagem_consulta',
  PatientProfile: 'patient_profiles',
  Professional: 'professionals',
  ProfessionalProfile: 'professional_profiles',
  ProfessionalPublicProfile: 'professional_public_profiles',
  ProfessionalBankingData: 'professional_banking_data',
  Prontuario: 'prontuarios',
  Question: 'questions',
  Queue: 'queues',
  Review: 'reviews',
  Saque: 'saques',
};

function createEntityProxy(tableName) {
  return {
    /**
     * Create a new record
     */
    async create(data) {
      const { data: result, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },

    /**
     * Bulk create records
     */
    async bulkCreate(items) {
      if (!items || items.length === 0) return [];
      const { data: result, error } = await supabase
        .from(tableName)
        .insert(items)
        .select();
      if (error) throw error;
      return result;
    },

    /**
     * Filter records by criteria
     * base44 API: .filter(filters, orderBy?, limit?)
     */
    async filter(filters = {}, orderBy, limit) {
      let query = supabase.from(tableName).select('*');

      // Apply filters
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'boolean') {
          query = query.eq(key, value);
        } else {
          query = query.eq(key, value);
        }
      }

      // Apply ordering
      if (orderBy) {
        const desc = orderBy.startsWith('-');
        const column = desc ? orderBy.slice(1) : orderBy;
        query = query.order(column, { ascending: !desc });
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    /**
     * List all records with optional ordering and limit
     */
    async list(orderBy, limit) {
      return this.filter({}, orderBy, limit);
    },

    /**
     * Update a record by ID
     */
    async update(id, data) {
      const { data: result, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },

    /**
     * Delete a record by ID
     */
    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },

    /**
     * Subscribe to real-time changes (stub - uses polling in original)
     */
    subscribe(callback) {
      const channel = supabase
        .channel(`${tableName}_changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
          callback({
            id: payload.new?.id || payload.old?.id,
            type: payload.eventType === 'INSERT' ? 'create' : payload.eventType === 'UPDATE' ? 'update' : 'delete',
            data: payload.new,
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

// Build entities proxy
const entities = {};
for (const [entityName, tableName] of Object.entries(TABLE_MAP)) {
  entities[entityName] = createEntityProxy(tableName);
}

// File upload via Supabase Storage
const integrations = {
  Core: {
    async UploadFile({ file }) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      return { file_url: publicUrl };
    },
  },
};

// Auth stub (not used - app uses custom auth via AuthContext)
const auth = {
  me: async () => null,
  logout: () => {},
  redirectToLogin: () => {},
};

// App logs stub
const appLogs = {
  logUserInApp: async () => {},
};

export const base44 = {
  entities,
  integrations,
  auth,
  appLogs,
};
