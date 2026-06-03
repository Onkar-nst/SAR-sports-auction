/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getRoom, saveRoom, getDeterministicUuid } from '@/lib/db';
import { supabase } from '@/lib/supabase';

const BID_TIMER_MS = 60000;
const BID_EXTENSION_MS = 20000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await req.json();
    const { action, userId } = body;

    if (!action || !action.type) {
      return NextResponse.json({ error: 'Action type is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const now = Date.now();
    const dbRoomId = getDeterministicUuid(roomId);

    switch (action.type) {
      // ─────────────────────────────────────────────────────────────────
      // START: Phase transition — full saveRoom is appropriate here
      // ─────────────────────────────────────────────────────────────────
      case 'START': {
        if (room.hostId !== userId) {
          return NextResponse.json({ error: 'Only the host can start the auction' }, { status: 403 });
        }
        if (room.phase !== 'lobby' && room.phase !== 'scheduled') {
          return NextResponse.json({ error: 'Auction has already started' }, { status: 400 });
        }

        room.phase = 'bidding';
        room.playerIdx = 0;
        room.currentBid = room.players[0].base;
        room.currentBidder = null;
        room.endsAt = now + ((room.timerDuration || 60) * 1000);

        await saveRoom(room);
        break;
      }

      // ─────────────────────────────────────────────────────────────────
      // BID: Use safe saveRoom pattern to avoid DB mapping issues
      // ─────────────────────────────────────────────────────────────────
      case 'BID': {
        const { bidder, amount } = action;

        if (room.phase !== 'bidding') {
          return NextResponse.json({ error: 'Bidding is not active' }, { status: 400 });
        }

        // Validate bidder exists as a participant
        const team = room.participants.find((p: any) => p.id === bidder);
        if (!team) {
          return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        // Validate ownership
        if (team.ownerId !== userId) {
          return NextResponse.json({ error: 'You do not own this team' }, { status: 403 });
        }

        if (bidder === room.currentBidder) {
          return NextResponse.json({ error: 'You are already the highest bidder' }, { status: 400 });
        }

        const nextBidVal = room.currentBid + amount;

        if (team.spent + nextBidVal > team.budget) {
          return NextResponse.json({ error: 'Insufficient budget' }, { status: 400 });
        }

        // Calculate new timer (extend but cap at room.timerDuration from now)
        const timerMs = (room.timerDuration || 60) * 1000;
        const extensionMs = room.timerDuration === 30 ? 10000 : 20000;
        const newEndsAt = Math.min((room.endsAt || now) + extensionMs, now + timerMs);

        // Mutate room state safely in memory
        room.currentBid = nextBidVal;
        room.currentBidder = bidder;
        room.endsAt = newEndsAt;
        room.bidHistory.unshift({ id: now, bidder, amount: nextBidVal });
        room.bidHistory = room.bidHistory.slice(0, 30);

        // Save the entire room back to database
        await saveRoom(room);

        const timeLeft = room.endsAt ? Math.max(0, Math.ceil((room.endsAt - Date.now()) / 1000)) : 60;
        return NextResponse.json({ room: { ...room, timeLeft } });
      }

      // ─────────────────────────────────────────────────────────────────
      // CHAT: Direct insert — no blob saveRoom needed
      // ─────────────────────────────────────────────────────────────────
      case 'CHAT': {
        const { msg, user } = action;
        if (!msg || !msg.trim()) {
          return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
        }

        // Use the saveRoom pattern for chat to ensure user mapping is handled correctly by db.ts
        room.chat.push({ id: now, user: user || 'Guest', msg: msg.trim() });
        room.chat = room.chat.slice(-60);
        await saveRoom(room);
        
        const timeLeft = room.endsAt ? Math.max(0, Math.ceil((room.endsAt - Date.now()) / 1000)) : 60;
        return NextResponse.json({ room: { ...room, timeLeft } });
      }

      // ─────────────────────────────────────────────────────────────────
      // RENAME_TEAM: Host renames a team
      // ─────────────────────────────────────────────────────────────────
      case 'RENAME_TEAM': {
        const { targetTeamId, newName } = action;
        if (room.hostId !== userId) {
          return NextResponse.json({ error: 'Only the host can rename teams' }, { status: 403 });
        }
        if (!newName || !newName.trim()) {
          return NextResponse.json({ error: 'Team name cannot be empty' }, { status: 400 });
        }
        const team = room.participants.find((p: any) => p.id === targetTeamId);
        if (!team) {
          return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }
        team.name = newName.trim();
        await saveRoom(room);
        
        const timeLeft = room.endsAt ? Math.max(0, Math.ceil((room.endsAt - Date.now()) / 1000)) : 60;
        return NextResponse.json({ room: { ...room, timeLeft } });
      }

      default:
        return NextResponse.json({ error: `Unsupported action type: ${action.type}` }, { status: 400 });
    }

    // For START action (falls through from switch without early return)
    const freshRoom = await getRoom(roomId);
    if (!freshRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    const timeLeft = freshRoom.endsAt
      ? Math.max(0, Math.ceil((freshRoom.endsAt - Date.now()) / 1000))
      : 60;

    return NextResponse.json({ room: { ...freshRoom, timeLeft } });
  } catch (error: any) {
    console.error('Error handling action:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
