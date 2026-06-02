import { NextResponse } from 'next/server';
import { getAllUsers, toggleUserActive } from '@/lib/db';

export async function GET() {
  try {
    const users = await getAllUsers();
    const formatted = users
      .filter(u => u.name !== 'admin' && u.email !== 'admin@sportsauction.com') // Hide admin from list
      .map(u => ({
        userId: u.name || u.email,
        active: u.active !== false,
        createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now()
      }));
    return NextResponse.json({ users: formatted });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, active } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    await toggleUserActive(userId, active);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error toggling user active status:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
