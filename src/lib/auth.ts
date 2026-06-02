export interface ManagedUser {
  userId: string;
  password: string;
  active: boolean;
  createdAt: number;
}

export interface AuthSession {
  userId: string;
  userName: string;
  isAdmin: boolean;
  loggedInAt: number;
}


export const STORAGE_KEYS = {
  guestUserId: 'sar_user_id',
  managedUsers: 'sar_managed_users',
  authSession: 'sar_auth_session',
} as const;

export function normalizeUserId(value: string) {
  return value.trim().toLowerCase();
}
