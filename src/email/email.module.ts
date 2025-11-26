import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
