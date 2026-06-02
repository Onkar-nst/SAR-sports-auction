import { NextResponse } from 'next/server';
import { getUserByEmail, createUser, hashPassword } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { userId, password } = await req.json();
    if (!userId || !password) {
      return NextResponse.json({ error: 'User ID and password are required' }, { status: 400 });
    }

    const email = userId.includes('@') ? userId : `${userId}@sportsauction.com`;
    
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser && existingUser.password_hash) {
      return NextResponse.json({ error: 'User ID already exists' }, { status: 400 });
    }

    // Hash the password and create the user record
    const passwordHash = hashPassword(password);
    const user = await createUser(email, passwordHash, userId);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    });
  } catch (error: any) {
    console.error('Custom Signup API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
