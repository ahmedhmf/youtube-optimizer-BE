export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role?: string;
    // Add other JWT payload properties
  };

  // Explicitly define headers with common auth headers
  headers: Request['headers'] & {
    authorization?: string;
    'x-api-key'?: string;
    'x-csrf-token'?: string;
    'content-type'?: string;
  };
  ip: string;
}
