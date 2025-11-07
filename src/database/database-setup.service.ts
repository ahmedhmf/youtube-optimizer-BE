import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DatabaseSetupService {
  private readonly logger = new Logger(DatabaseSetupService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async setupDatabase() {
    try {
      this.logger.log('Setting up database tables...');
      
      const client = this.supabase.getClient();
      
      // Check if the audits table exists by trying to select from it
      const { data, error } = await client
        .from('audits')
        .select('count', { count: 'exact', head: true })
        .limit(1);

      if (error && error.code === 'PGRST116') {
        this.logger.error('The "audits" table does not exist in your Supabase database.');
        this.logger.error('Please create the table using the SQL in database-setup.sql');
        this.logger.error('You can run this SQL in your Supabase SQL Editor:');
        this.logger.error('https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql');
        throw new Error('Database table "audits" does not exist');
      } else if (error) {
        this.logger.error('Database error:', error);
        throw error;
      } else {
        this.logger.log('Database tables verified successfully');
        return true;
      }
    } catch (error) {
      this.logger.error('Database setup failed:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client.auth.getSession();
      
      if (error) {
        this.logger.error('Supabase connection test failed:', error);
        return false;
      }
      
      this.logger.log('Supabase connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Supabase connection test error:', error);
      return false;
    }
  }
}