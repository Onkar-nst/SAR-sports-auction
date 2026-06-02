/**
 * Client-side offline authentication fallback.
 * Uses Web Crypto API (SHA-256) to hash passwords and stores credentials in localStorage.
 * This allows authentication to work even when the server API is unreachable.
 */

const USERS_STORAGE_KEY = 'sar_offline_users';

async function hashPasswordClient(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getLocalUsers(): Record<string, { id: string; email: string; name: string; password_hash: string; active?: boolean }> {
  let users: Record<string, any> = {};
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) users = JSON.parse(raw);
  } catch {
    users = {};
  }

  // Pre-seed default admin credentials so offline login works immediately
  const adminEmail = 'admin@sportsauction.com';
  if (!users[adminEmail]) {
    users[adminEmail] = {
      id: '3f4152f4-dfb9-44ab-83f0-8e23366bf4bd',
      email: adminEmail,
      name: 'admin',
      // Hash of 'adminpassword2026'
      password_hash: 'e35f704b7cff61dbb3aadb8fb1461c388ec4aee66fc7a86a0f2e7dfaccc75e83'
    };
  }
  return users;
}

function saveLocalUsers(users: Record<string, any>): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function generateDeterministicId(str: string): string {
  // Simple deterministic ID (client-side fallback, not crypto-grade)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(0, 3)}-8${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`;
}

export async function offlineLogin(userId: string, password: string): Promise<{ id: string; email: string; name: string }> {
  const email = userId.includes('@') ? userId.toLowerCase().trim() : `${userId.toLowerCase().trim()}@sportsauction.com`;
  const users = getLocalUsers();
  const user = users[email];

  if (!user || !user.password_hash) {
    throw new Error('Invalid user ID or password');
  }

  if ((user as any).active === false) {
    throw new Error('User is deactivated');
  }

  const inputHash = await hashPasswordClient(password);
  if (user.password_hash !== inputHash) {
    throw new Error('Invalid user ID or password');
  }

  return { id: user.id, email: user.email, name: user.name };
}

export async function offlineSignup(userId: string, password: string): Promise<{ id: string; email: string; name: string }> {
  const email = userId.includes('@') ? userId.toLowerCase().trim() : `${userId.toLowerCase().trim()}@sportsauction.com`;
  const users = getLocalUsers();

  if (users[email] && users[email].password_hash) {
    throw new Error('User ID already exists');
  }

  const passwordHash = await hashPasswordClient(password);
  const id = generateDeterministicId(email);
  const newUser = { id, email, name: userId, password_hash: passwordHash, active: true };
  users[email] = newUser;
  saveLocalUsers(users);

  return { id, email, name: userId };
}

/**
 * Sync a successfully server-created user to the offline store,
 * so future logins work even without server connectivity.
 */
export async function syncUserToOfflineStore(userId: string, password: string, serverUser: { id: string; email: string; name: string }): Promise<void> {
  const email = serverUser.email.toLowerCase().trim();
  const users = getLocalUsers();
  const passwordHash = await hashPasswordClient(password);
  users[email] = {
    id: serverUser.id,
    email: serverUser.email,
    name: serverUser.name,
    password_hash: passwordHash,
    active: (serverUser as any).active !== false
  };
  saveLocalUsers(users);
}
