const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = 'https://tsgbpohltvkfzcyvzkoh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZ2Jwb2hsdHZrZnpjeXZ6a29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODQ2ODEsImV4cCI6MjA5NTk2MDY4MX0.QkdDj2_ClDAskuvHGHFCDkUSepw1y3jFnSAnYChMCaA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function populate() {
  console.log('Signing up admin user...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'admin@sportsauction.com',
    password: 'kola@ipl'
  });

  if (authError) {
    console.error('Error signing up (might already exist):', authError.message);
  }

  let hostId;
  
  if (authData?.user) {
    hostId = authData.user.id;
    console.log('Signed up hostId:', hostId);
  } else {
    // Try to login if already exists
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@sportsauction.com',
      password: 'kola@ipl'
    });
    if (signInError) {
      console.error('Sign in failed:', signInError.message);
      return;
    }
    hostId = signInData.user.id;
    console.log('Logged in hostId:', hostId);
  }

  const roomId = crypto.randomUUID();
  console.log('Creating room:', roomId);

  const { error: roomError } = await supabase.from('rooms').insert([{
    id: roomId,
    name: 'IPL Mega Auction 2026',
    sport: 'Cricket',
    tournament: 'IPL',
    budget: 10000, // 100 CR -> 10000 L
    squad_size: 25,
    enable_bots: true,
    host_id: hostId,
    phase: 'lobby',
    current_bid: 0
  }]);

  if (roomError) {
    console.error('Error creating room:', roomError);
    return;
  }

  console.log('Creating team...');
  const teamId = crypto.randomUUID();
  const { error: teamError } = await supabase.from('teams').insert([{
    id: teamId,
    room_id: roomId,
    name: 'Mumbai Indians',
    budget: 10000,
    spent: 0,
    color: '#004B8D',
    owner_id: hostId
  }]);

  if (teamError) {
    console.error('Error creating team:', teamError);
  }

  console.log('Creating some players...');
  const players = [
    {
      id: crypto.randomUUID(),
      room_id: roomId,
      name: 'Virat Kohli',
      country: 'India',
      role: 'Batsman',
      tier: 'Gold',
      base_price: 200,
      status: 'unsold'
    },
    {
      id: crypto.randomUUID(),
      room_id: roomId,
      name: 'Jasprit Bumrah',
      country: 'India',
      role: 'Bowler',
      tier: 'Gold',
      base_price: 200,
      status: 'unsold'
    },
    {
      id: crypto.randomUUID(),
      room_id: roomId,
      name: 'Rashid Khan',
      country: 'Afghanistan',
      role: 'All-rounder',
      tier: 'Gold',
      base_price: 200,
      status: 'unsold'
    }
  ];

  const { error: playersError } = await supabase.from('players').insert(players);
  if (playersError) {
    console.error('Error adding players:', playersError);
  }

  console.log('Successfully populated Supabase database!');
  console.log(`Room ID: ${roomId}`);
}

populate();
