export interface Player {
  id: number | string;
  name: string;
  country: string;
  role: 'Batter' | 'Bowler' | 'All-rounder' | 'WK-Batter' | string;
  tier: 'Elite' | 'Platinum' | 'Gold' | 'Silver' | string;
  base: number;
  img: string;
  nat: string;
  bio?: string;
  soldPrice?: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  photo: string | null;
}

export interface Participant extends Team {
  budget: number;
  spent: number;
  squad: Player[];
  ownerId?: string | null;
}

export interface BidEntry {
  id: number;
  bidder: string;
  amount: number;
}

export interface ChatEntry {
  id: number;
  user: string;
  msg: string;
}

export interface SoldLogEntry {
  player: Player;
  buyer: string;
  price: number;
}

export type AuctionPhase = 'lobby' | 'scheduled' | 'bidding' | 'sold' | 'unsold' | 'done';

export interface AuctionState {
  phase: AuctionPhase;
  playerIdx: number;
  currentBid: number;
  currentBidder: string | null;
  timeLeft?: number;
  bidHistory: BidEntry[];
  chat: ChatEntry[];
  participants: Participant[];
  soldLog: SoldLogEntry[];
  unsoldLog: Player[];
  players: Player[];
}

export interface ServerRoom extends AuctionState {
  id: string;
  name: string;
  sport: string;
  tournament: string;
  budget: number;
  squadSize: number;
  enableBots: boolean;
  timerDuration: number;
  endsAt: number | null;
  scheduledAt?: number | null;
  hostId?: string;
  createdAt?: number;
  updatedAt?: number;
}


export type AuctionAction =
  | { type: 'TICK' }
  | { type: 'BID'; bidder: string; amount: number }
  | { type: 'NEXT' }
  | { type: 'CHAT'; msg: string; user?: string };

export interface RoomConfig {
  name: string;
  sport: string;
  tournament: string;
  participants: number;
  budget: number;
  squadSize: number;
  timerDuration: number;
}
