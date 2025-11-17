import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
    );
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  // Service role client for admin operations (bypasses RLS)
  getServiceClient(): SupabaseClient {
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!, // This bypasses RLS
    );
  }

  // Create authenticated client with proper session
  getAuthenticatedClient(accessToken: string): SupabaseClient {
    const authenticatedClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );
    
    return authenticatedClient;
  }
}