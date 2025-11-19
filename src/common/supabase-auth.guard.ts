import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { Request } from 'express';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
  );
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;

    const token = authHeader.replace('Bearer ', '');
    const { data } = await this.supabase.auth.getUser(token);

    if (!data?.user) return false;

    req.user = data.user;
    return true;
  }
}
