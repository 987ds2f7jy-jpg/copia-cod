import { env } from '@/config/env';
import { supabase } from '@/integrations/supabase/client';

function normalizeEmail(email) {
  return email?.toLowerCase().trim() || '';
}

export const supabaseAuthRepository = {
  isEnabled() {
    return env.enableSupabaseAuth;
  },

  async getUser() {
    if (!this.isEnabled()) {
      return null;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return data.user || null;
  },

  async signIn({ email, password }) {
    if (!this.isEnabled()) {
      return null;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signUp({ email, password, metadata = {} }) {
    if (!this.isEnabled()) {
      return null;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signOut() {
    if (!this.isEnabled()) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },

  subscribe(listener) {
    if (!this.isEnabled()) {
      return () => {};
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      listener(session);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  },
};
