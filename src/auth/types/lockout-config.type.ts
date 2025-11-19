export type LockoutConfig = {
  maxAttempts: number;
  lockoutDurationMinutes: number;
  resetWindowMinutes: number;
};
