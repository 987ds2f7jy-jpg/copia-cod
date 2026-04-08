/**
 * Compatibility layer: replaces @base44/sdk with Supabase client
 * Mimics the base44.entities.X.create/filter/update/delete/list API
 */
import { supabase } from '@/integrations/supabase/client';
import { logApiError, logApiRequest, logApiResponse, serializeError } from '@/lib/observability';

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
  SolicitacaoExame: 'solicitacoes_exames',
  ProfessionalOfficeLocation: 'professional_office_locations',
};

function createEntityProxy(tableName) {
  async function execute(action, meta, runner) {
    logApiRequest({ table: tableName, action, ...meta });

    try {
      const result = await runner();
      const count = Array.isArray(result) ? result.length : result ? 1 : 0;
      logApiResponse({ table: tableName, action, count, id: result?.id || null });
      return result;
    } catch (error) {
      logApiError({
        table: tableName,
        action,
        ...meta,
        error: serializeError(error),
      });
      throw error;
    }
  }

  return {
    /**
     * Create a new record
     */
    async create(data) {
      return execute('create', { fields: Object.keys(data || {}) }, async () => {
        const { data: result, error } = await supabase
          .from(tableName)
          .insert(data)
          .select()
          .single();
        if (error) throw error;
        return result;
      });
    },

    /**
     * Bulk create records
     */
    async bulkCreate(items) {
      if (!items || items.length === 0) return [];
      return execute('bulkCreate', { items: items.length }, async () => {
        const { data: result, error } = await supabase
          .from(tableName)
          .insert(items)
          .select();
        if (error) throw error;
        return result;
      });
    },

    /**
     * Filter records by criteria
     * base44 API: .filter(filters, orderBy?, limit?)
     */
    async filter(filters = {}, orderBy, limit) {
      return execute('filter', { filters, orderBy: orderBy || null, limit: limit || null }, async () => {
        let query = supabase.from(tableName).select('*');

        for (const [key, value] of Object.entries(filters)) {
          if (value === undefined || value === null) continue;
          query = query.eq(key, value);
        }

        if (orderBy) {
          const desc = orderBy.startsWith('-');
          const column = desc ? orderBy.slice(1) : orderBy;
          query = query.order(column, { ascending: !desc });
        }

        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      });
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
      return execute('update', { id, fields: Object.keys(data || {}) }, async () => {
        const { data: result, error } = await supabase
          .from(tableName)
          .update(data)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return result;
      });
    },

    /**
     * Get a record by ID
     */
    async get(id) {
      return execute('get', { id }, async () => {
        const { data: result, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        return result;
      });
    },

    /**
     * Delete a record by ID
     */
    async delete(id) {
      return execute('delete', { id }, async () => {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', id);
        if (error) throw error;
        return null;
      });
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
