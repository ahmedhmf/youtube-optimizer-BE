export type AccountLockoutStatus = {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutUntil?: Date;
  totalFailedAttempts: number;
};
