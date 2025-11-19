import { SocialProvider } from '../dto/social-login.dto';

export type SocialRegistration = {
  name: string;
  picture: string | undefined;
  updated_at: string;
  provider?: SocialProvider;
};
