/**
 * Client-side offline authentication fallback.
 * Uses Web Crypto API (SHA-256) to hash passwords and stores credentials in localStorage.
 * This allows authentication to work even when the server API is unreachable.
 */

const USERS_STORAGE_KEY = 'sar_offline_users';

async function hashPasswordClient(password: string): Promise<string> {
  // Pure JavaScript SHA-256 implementation that does not depend on crypto.subtle.
  // This allows the hashing to work in insecure local contexts (like HTTP on mobile hotspots).
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';

  const words: number[] = [];
  const asciiLength = password[lengthProperty] * 8;
  
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let paddedAscii = password + '\x80';
  while (paddedAscii[lengthProperty] % 64 - 56) {
    paddedAscii += '\x00';
  }
  
  for (i = 0; i < paddedAscii[lengthProperty]; i++) {
    j = paddedAscii.charCodeAt(i);
    if (j >> 8) return ''; // prevent non-ASCII characters
    words[i >> 2] |= j << ((3 - i % 4) * 8);
  }
  
  words[words[lengthProperty]] = ((asciiLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiLength | 0);
  
  for (j = 0; j < words[lengthProperty];) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);
    
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const a = hash[0], e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ (~e & hash[6]))
        + k[i]
        + w[i];
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.length = 8;
    }
    
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  
  for (i = 0; i < 8; i++) {
    const s = hash[i] >>> 0;
    result += s.toString(16).padStart(8, '0');
  }
  return result;
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
