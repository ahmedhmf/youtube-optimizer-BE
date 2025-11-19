import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient<any, any, any>;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
    );
  }

  getClient(): SupabaseClient<any, any, any> {
    return this.supabase;
  }

  getServiceClient(): SupabaseClient<any, any, any> {
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

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
      },
    );

    return authenticatedClient;
  }
}
