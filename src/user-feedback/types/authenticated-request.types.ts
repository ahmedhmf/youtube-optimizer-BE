import { UserRole } from 'src/auth/types/roles.types';

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
};
