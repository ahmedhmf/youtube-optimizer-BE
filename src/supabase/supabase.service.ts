import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient<any, any, any>;

  constructor() {
    try {
      this.supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_KEY!,
      );
      this.logger.log('Supabase client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client:', error);
      throw error;
    }
  }

  getClient(): SupabaseClient<any, any, any> {
    return this.supabase;
  }

  getServiceClient(): SupabaseClient<any, any, any> {
    try {
      const client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
      );
      return client;
    } catch (error) {
      this.logger.error('Failed to create service client:', error);
      throw error;
    }
  }

  getAuthenticatedClient(accessToken: string): SupabaseClient {
    try {
      const authenticatedClient = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        },
      );

      return authenticatedClient;
    } catch (error) {
      this.logger.error('Failed to create authenticated client:', error);
      throw error;
    }
  }
}
