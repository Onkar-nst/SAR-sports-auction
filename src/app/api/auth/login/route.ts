import { NextResponse } from 'next/server';
import { getUserByEmail, hashPassword } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { userId, password } = await req.json();
    if (!userId || !password) {
      return NextResponse.json({ error: 'User ID and password are required' }, { status: 400 });
    }

    const email = userId.includes('@') ? userId : `${userId}@sportsauction.com`;
    const user = await getUserByEmail(email);

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'Invalid user ID or password' }, { status: 401 });
    }

    if (user.active === false) {
      return NextResponse.json({ error: 'User is deactivated' }, { status: 403 });
    }

    const inputHash = hashPassword(password);
    if (user.password_hash !== inputHash) {
      return NextResponse.json({ error: 'Invalid user ID or password' }, { status: 401 });
    }

    // Return session structure
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        active: user.active !== false
      }
    });
  } catch (error: any) {
    console.error('Custom Login API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
