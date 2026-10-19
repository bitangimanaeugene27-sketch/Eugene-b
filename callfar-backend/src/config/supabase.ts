import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from './env.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Check if Supabase API credentials are configured in environment variables
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(ENV.SUPABASE_URL && (ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY));
};

/**
 * Returns the initialized Supabase client singleton, or null if credentials are not configured.
 * Uses service role key for backend elevated operations (storage management, admin operations)
 * if available, otherwise falls back to anon key.
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseClient) return supabaseClient;

  if (!isSupabaseConfigured()) {
    return null;
  }

  const key = ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY;
  try {
    supabaseClient = createClient(ENV.SUPABASE_URL, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseClient;
  } catch (error) {
    console.warn('[Supabase Client] Failed to initialize Supabase client:', error);
    return null;
  }
};

/**
 * Storage helpers for CallFar user avatars & media attachments
 */
export const SupabaseStorageService = {
  /**
   * Upload an avatar or attachment buffer to Supabase Storage
   */
  async uploadFile(bucket: 'avatars' | 'attachments', filePath: string, fileBuffer: Buffer, contentType: string) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase client is not configured. Set SUPABASE_URL and keys in .env');
    }

    const { data, error } = await client.storage.from(bucket).upload(filePath, fileBuffer, {
      contentType,
      upsert: true,
    });

    if (error) throw error;

    const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(data.path);
    return { path: data.path, publicUrl: publicUrlData.publicUrl };
  },

  /**
   * Delete a file from a Supabase Storage bucket
   */
  async deleteFile(bucket: 'avatars' | 'attachments', filePath: string) {
    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client.storage.from(bucket).remove([filePath]);
    return !error;
  },

  /**
   * Get public URL for a file in Supabase Storage
   */
  getPublicUrl(bucket: 'avatars' | 'attachments', filePath: string): string | null {
    const client = getSupabaseClient();
    if (!client) return null;
    return client.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
  },
};

export default getSupabaseClient;
