'use client';
import { useRef, useState, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { AuthSession, ManagedUser } from '@/lib/auth';
import Avatar from '@/components/ui/Avatar';

interface LandingProps {
  userId: string;
  authSession: AuthSession | null;
  managedUsers: ManagedUser[];
  onStart: () => void;
  onJoin: (roomId: string, teamId: string, userName: string) => void;
  onLogin: (userId: string, password: string) => void;
  onLogout: () => void;
  onCreateUser: (userId: string, password: string) => void;
  onToggleUser: (userId: string) => void;
}

interface JoinRoomDetails {
  id: string;
  name: string;
  sport: string;
  tournament: string;
  budget: number;
  participants: Array<{
    id: string;
    name: string;
    color: string;
    ownerId: string | null;
  }>;
}

const FEATURES = [
  ['⚡', 'Live Bidding', 'Choose 30s or 60s timer — bids dynamically extend the clock'],
  ['🔍', 'AI Player Scout', 'Search any player name or URL; AI fetches role, country & base price'],
  ['📁', 'Smart Upload', 'Import from Excel (.xlsx) — columns auto-detected'],
  ['📄', 'PDF Parsing', 'Upload a PDF squad list; AI extracts all players automatically'],
  ['🎨', 'Custom Teams', 'Set your team name and upload your own logo/photo'],
  ['🏟', 'Multi-Sport', 'IPL, UEFA, FIFA, NBA or any custom tournament'],
];

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(5,7,14,0.85)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 16,
};

const modalStyle: CSSProperties = {
  width: '100%',
  maxWidth: 480,
  animation: 'fadeUp 0.3s ease',
  border: '1px solid var(--bd2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  padding: 24,
};

function Label({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--t3)',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </label>
  );
}

function formatCreatedAt(createdAt: number) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(createdAt);
}

export default function Landing({
  userId,
  authSession,
  managedUsers,
  onStart,
  onJoin,
  onLogin,
  onLogout,
  onCreateUser,
  onToggleUser,
}: LandingProps) {
  const [showJoin, setShowJoin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loginIntent, setLoginIntent] = useState<'nav' | 'host'>('nav');
  const [roomCode, setRoomCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roomDetails, setRoomDetails] = useState<JoinRoomDetails | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamPhoto, setTeamPhoto] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ userId: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [settingsForm, setSettingsForm] = useState({ userId: '', password: '' });
  const [settingsError, setSettingsError] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const teamPhotoRef = useRef<HTMLInputElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [news, setNews] = useState<string[]>([
    '🔴 LIVE: Virat Kohli SOLD ₹260L',
    'Bumrah going ₹228L',
    'New IPL 2025 room open',
    'Rashid Khan SOLD ₹148L'
  ]);

  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => {
        if (data.headlines && data.headlines.length > 0) {
          setNews(data.headlines);
        }
      })
      .catch(err => console.warn('Failed to load news ticker:', err));
  }, []);

  useEffect(() => {
    if (userId) {
      fetch(`/api/rooms?userId=${encodeURIComponent(userId)}`)
        .then(res => res.json())
        .then(data => {
          if (data.history) setHistory(data.history);
        })
        .catch(err => console.warn('Failed to load rooms history:', err));
    }
  }, [userId]);

  const isAdmin = authSession?.isAdmin ?? false;
  async function checkRoom() {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    setLoading(true);
    setError('');
    setRoomDetails(null);
    setTeamName('');
    setTeamPhoto(null);
    try {
      const code = roomCode.trim().toUpperCase();
      const formattedCode = code.startsWith('AUC-') ? code : `AUC-${code}`;
      const res = await fetch(`/api/rooms/${formattedCode}?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setRoomDetails(data.room as JoinRoomDetails);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Room not found');
    } finally {
      setLoading(false);
    }
  }

  async function submitJoin() {
    if (!roomDetails) return;
    if (!userName.trim()) {
      setError('Please enter your display name');
      return;
    }
    if (!teamName.trim()) {
      setError('Please enter your team name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/rooms/${roomDetails.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName: userName.trim(),
          teamName: teamName.trim(),
          teamPhoto,
        }),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      onJoin(roomDetails.id, data.teamId, userName.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join');
    } finally {
      setLoading(false);
    }
  }

  function handleCloseJoin() {
    setShowJoin(false);
    setRoomCode('');
    setUserName('');
    setTeamName('');
    setTeamPhoto(null);
    setRoomDetails(null);
    setError('');
  }

  function openLogin(intent: 'nav' | 'host') {
    setLoginIntent(intent);
    setLoginError('');
    setLoginForm({ userId: '', password: '' });
    setShowLogin(true);
  }

  function closeLogin() {
    setShowLogin(false);
    setLoginError('');
    setLoginForm({ userId: '', password: '' });
  }

  function handleHostAccess() {
    if (authSession) {
      onStart();
      return;
    }
    openLogin('host');
  }

  async function submitLogin() {
    if (!loginForm.userId.trim() || !loginForm.password.trim()) {
      setLoginError('Enter both user ID and password');
      return;
    }

    try {
      await onLogin(loginForm.userId, loginForm.password);
      closeLogin();
      if (loginIntent === 'host') {
        onStart();
      }
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? e.message : 'Login failed');
    }
  }

  async function submitManagedUser() {
    if (!settingsForm.userId.trim() || !settingsForm.password.trim()) {
      setSettingsError('Add both a user ID and password');
      return;
    }

    try {
      await onCreateUser(settingsForm.userId, settingsForm.password);
      setSettingsForm({ userId: '', password: '' });
      setSettingsError('');
      setSettingsMessage(`User ${settingsForm.userId.trim().toLowerCase()} created successfully`);
    } catch (e: unknown) {
      setSettingsMessage('');
      setSettingsError(e instanceof Error ? e.message : 'Failed to create user');
    }
  }

  function handleToggleManagedUser(targetUserId: string, active: boolean) {
    try {
      onToggleUser(targetUserId);
      setSettingsError('');
      setSettingsMessage(`${targetUserId} ${active ? 'deactivated' : 'activated'} successfully`);
    } catch (e: unknown) {
      setSettingsMessage('');
      setSettingsError(e instanceof Error ? e.message : 'Failed to update user');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div 
        style={{ background: 'var(--g)', overflow: 'hidden', whiteSpace: 'nowrap', padding: '5px 0' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span style={{ display: 'inline-block', animation: 'ticker 24s linear infinite', animationPlayState: isHovered ? 'paused' : 'running', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 12, color: '#000', letterSpacing: 1 }}>
          {news.join(' \u00A0•\u00A0 ')} &nbsp;•&nbsp;
        </span>
      </div>

      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          padding: '14px clamp(16px,4vw,40px)',
          borderBottom: '1px solid var(--bd)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--g)', letterSpacing: 3 }}>SAR</span>
          {authSession && (
            <span
              className="tag"
              style={{
                background: authSession.isAdmin ? 'rgba(245,158,11,0.12)' : 'rgba(0,220,114,0.1)',
                color: authSession.isAdmin ? 'var(--am)' : 'var(--g)',
                border: `1px solid ${authSession.isAdmin ? 'rgba(245,158,11,0.2)' : 'rgba(0,220,114,0.18)'}`,
              }}
            >
              {authSession.isAdmin ? 'Admin Mode' : `Logged In: ${authSession.userId}`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button className="btn bs bsm" onClick={() => setShowJoin(true)}>Join Room</button>
          {authSession ? (
            <>
              {isAdmin && (
                <button className="btn bs bsm" onClick={() => setShowSettings(true)}>Settings</button>
              )}
              <button className="btn bp bsm" onClick={onStart}>Create Room</button>
              <button className="btn bs bsm" onClick={onLogout}>Logout</button>
              
              {/* Logged in User Profile Box */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '6px 12px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.3s ease',
                  cursor: 'default',
                  marginLeft: 6
                }}
              >
                <div style={{
                  position: 'relative',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: authSession.isAdmin ? 'linear-gradient(135deg, var(--am) 0%, #d97706 100%)' : 'linear-gradient(135deg, var(--g) 0%, #00a854 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#000',
                  textTransform: 'uppercase',
                  boxShadow: authSession.isAdmin ? '0 0 10px rgba(245,158,11,0.3)' : '0 0 10px rgba(0,220,114,0.3)'
                }}>
                  {(authSession.userName || authSession.userId).charAt(0)}
                  <span style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#00DC72',
                    border: '1px solid var(--bg)',
                    boxShadow: '0 0 4px #00DC72'
                  }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'left' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)', fontFamily: "'Rajdhani', sans-serif", lineHeight: 1 }}>
                    {authSession.userName || authSession.userId}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', fontFamily: "'Rajdhani', sans-serif" }}>
                    {authSession.isAdmin ? '🛡️ Admin' : '👤 Participant'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <button className="btn bp bsm" onClick={() => openLogin('nav')}>Login</button>
          )}
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'stretch' }}>
        {/* ROOM HISTORY SIDEBAR */}
        {userId && history.length > 0 && (
          <div style={{ width: 'clamp(260px, 25vw, 340px)', borderRight: '1px solid var(--bd)', padding: '24px 20px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, color: 'var(--t1)', marginBottom: 16 }}>Your Recent Rooms</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {history.map((room) => (
                <div key={room.id} className="card hover-lift" style={{ padding: 14, cursor: 'pointer', border: '1px solid var(--bd2)' }} onClick={() => {
                  setRoomCode(room.id);
                  setShowJoin(true);
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{room.name}</div>
                    <span className="tag" style={{ fontSize: 9, padding: '2px 6px', background: room.phase === 'done' ? 'rgba(255,255,255,0.1)' : room.phase === 'bidding' ? 'rgba(0,220,114,0.15)' : 'rgba(245,158,11,0.15)', color: room.phase === 'done' ? 'var(--t3)' : room.phase === 'bidding' ? 'var(--g)' : 'var(--am)' }}>
                      {room.phase.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{room.sport}</span>
                    <span>{new Date(room.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 8, opacity: 0.6 }}>ID: {room.id}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px clamp(16px,4vw,40px) 36px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,220,114,.045) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ textAlign: 'center', animation: 'fadeUp .55s ease', position: 'relative', zIndex: 1, width: '100%' }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(54px,9vw,108px)', lineHeight: 0.87, letterSpacing: 4, marginBottom: 14 }}>
            SPORTS<br />AUCTION<br /><span style={{ color: 'var(--g)' }}>ROOM</span>
          </h1>
          <p style={{ color: 'var(--t2)', fontSize: 17, maxWidth: 430, margin: '18px auto 32px', lineHeight: 1.65, fontWeight: 300 }}>
            Host live fantasy auctions with friends. Bid on players, build your squad, and see who gets the best value.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn bp" onClick={handleHostAccess} style={{ fontSize: 17, padding: '13px 34px' }}>
              {authSession ? '🚀 Host Auction' : '🔐 Login to Host'}
            </button>
            <button className="btn bs" onClick={() => setShowJoin(true)} style={{ fontSize: 17, padding: '13px 34px' }}>Join a Room</button>
          </div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 48, flexWrap: 'wrap' }}>
            {[{ v: '2,400+', l: 'Auctions' }, { v: '18K+', l: 'Players Sold' }, { v: '4.9★', l: 'Rating' }].map((s) => (
              <div key={s.l} style={{ textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: 'var(--g)', letterSpacing: 2 }}>{s.v}</div>
                <div style={{ color: 'var(--t3)', fontSize: 12, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      <div style={{ padding: '64px clamp(16px,4vw,40px)', background: 'linear-gradient(to bottom, var(--bg) 0%, var(--bg2) 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, var(--g), transparent)', opacity: 0.3 }} />
        
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-block', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--g)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, padding: '6px 14px', background: 'rgba(0,220,114,0.1)', borderRadius: 20, border: '1px solid rgba(0,220,114,0.2)' }}>
            Platform Features
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(40px, 6vw, 56px)', letterSpacing: 3, color: 'var(--t1)', margin: 0 }}>
            WHAT&apos;S <span style={{ color: 'var(--g)' }}>INSIDE</span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24, maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="card hover-lift" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, transparent 100%)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,220,114,0.1)', border: '1px solid rgba(0,220,114,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 0 20px rgba(0,220,114,0.1) inset' }}>
                {icon}
              </div>
              <div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 8, letterSpacing: 0.5 }}>{title}</div>
                <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.6 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showJoin && (
        <div style={overlayStyle}>
          <div className="card" style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2 }}>JOIN AUCTION ROOM</h3>
              <button onClick={handleCloseJoin} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {error && (
              <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: 'var(--re)', border: '1px solid rgba(239,68,68,0.2)' }}>
                ⚠️ {error}
              </div>
            )}

            {!roomDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label>Room Code</Label>
                  <input className="inp" placeholder="e.g. 7291 or AUC-7291" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') checkRoom(); }} />
                </div>
                <button className="btn bp" onClick={checkRoom} disabled={loading} style={{ width: '100%', padding: 12 }}>
                  {loading ? 'Finding...' : 'Find Room →'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  const joinedTeams = roomDetails.participants.filter((participant) => participant.ownerId !== null).length;
                  const openTeams = roomDetails.participants.length - joinedTeams;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: 'var(--bg3)', border: '1px solid var(--bd2)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>Joined Teams</div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--g)', letterSpacing: 2 }}>{joinedTeams}</div>
                      </div>
                      <div style={{ background: 'var(--bg3)', border: '1px solid var(--bd2)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>Open Slots</div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: openTeams > 0 ? 'var(--am)' : 'var(--re)', letterSpacing: 2 }}>{openTeams}</div>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ background: 'var(--bg3)', border: '1px solid var(--bd2)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--g)', letterSpacing: 1 }}>{roomDetails.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t2)', marginTop: 4, gap: 12, flexWrap: 'wrap' }}>
                    <span>🏆 {roomDetails.tournament} ({roomDetails.sport})</span>
                    <span>💰 Budget: ₹{roomDetails.budget}L</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label>Your Name / Alias</Label>
                  <input className="inp" placeholder="Enter your name" value={userName} onChange={(e) => setUserName(e.target.value)} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label>Your Team Name</Label>
                  <input className="inp" placeholder="Enter your team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                </div>

                <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => teamPhotoRef.current?.click()}>
                    <Avatar name={teamName || 'Team'} size={60} color="var(--g)" photo={teamPhoto} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Label>Team Logo (Optional)</Label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn bs bsm" onClick={() => teamPhotoRef.current?.click()}>
                        Upload Logo
                      </button>
                      {teamPhoto && (
                        <button className="btn bs bsm" onClick={() => setTeamPhoto(null)}>
                          Remove Logo
                        </button>
                      )}
                    </div>
                    <div style={{ color: 'var(--t3)', fontSize: 11 }}>
                      The next available slot will be assigned to this team.
                    </div>
                  </div>
                  <input
                    ref={teamPhotoRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setTeamPhoto((event.target?.result as string) || null);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button className="btn bs" onClick={() => { setRoomDetails(null); setTeamName(''); setTeamPhoto(null); }} style={{ flex: 1 }}>Back</button>
                  <button className="btn bp" onClick={submitJoin} disabled={loading || !userName || !teamName} style={{ flex: 2 }}>
                    {loading ? 'Joining...' : 'Join Auction →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showLogin && (
        <div style={overlayStyle}>
          <div className="card" style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2 }}>LOGIN</h3>
                <p style={{ color: 'var(--t3)', fontSize: 12, marginTop: 4 }}>
                  Sign in to host auctions and access admin settings.
                </p>
              </div>
              <button onClick={closeLogin} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {loginError && (
              <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: 'var(--re)', border: '1px solid rgba(239,68,68,0.2)' }}>
                ⚠️ {loginError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label>User ID</Label>
                <input
                  className="inp"
                  placeholder="Enter your user ID"
                  value={loginForm.userId}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, userId: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitLogin(); }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label>Password</Label>
                <input
                  className="inp"
                  type="password"
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitLogin(); }}
                />
              </div>
            </div>

            <button className="btn bp" onClick={submitLogin} style={{ width: '100%', padding: 12 }}>
              Login →
            </button>
          </div>
        </div>
      )}

      {showSettings && isAdmin && (
        <div style={overlayStyle}>
          <div className="card" style={{ ...modalStyle, maxWidth: 760, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: 2 }}>USER SETTINGS</h3>
                <p style={{ color: 'var(--t3)', fontSize: 12, marginTop: 4 }}>
                  Create user IDs and activate or deactivate access.
                </p>
              </div>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
              <div className="card" style={{ padding: 18, background: 'rgba(0,220,114,0.04)', border: '1px solid rgba(0,220,114,0.16)' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1.5, marginBottom: 14 }}>CREATE USER</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Label>New User ID</Label>
                    <input
                      className="inp"
                      placeholder="e.g. auctionhost01"
                      value={settingsForm.userId}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, userId: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Label>Password</Label>
                    <input
                      className="inp"
                      type="password"
                      placeholder="Set a password"
                      value={settingsForm.password}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, password: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitManagedUser(); }}
                    />
                  </div>
                  <button className="btn bp" onClick={submitManagedUser}>Create User</button>
                </div>
              </div>


            </div>

            {(settingsError || settingsMessage) && (
              <div style={{
                fontSize: 13,
                padding: '10px 12px',
                borderRadius: 8,
                background: settingsError ? 'rgba(239,68,68,0.08)' : 'rgba(0,220,114,0.08)',
                color: settingsError ? 'var(--re)' : 'var(--g)',
                border: `1px solid ${settingsError ? 'rgba(239,68,68,0.2)' : 'rgba(0,220,114,0.18)'}`,
              }}>
                {settingsError ? `⚠️ ${settingsError}` : `✅ ${settingsMessage}`}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 1.5 }}>MANAGED USERS</h4>
                <span style={{ color: 'var(--t3)', fontSize: 12 }}>
                  {managedUsers.length} user{managedUsers.length === 1 ? '' : 's'}
                </span>
              </div>

              {managedUsers.length === 0 ? (
                <div className="card" style={{ padding: 18, color: 'var(--t3)', textAlign: 'center' }}>
                  No additional users yet. Create one above to allow more hosts to log in.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                  {[...managedUsers]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((managedUser) => (
                      <div key={managedUser.userId} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div>
                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 16 }}>{managedUser.userId}</div>
                            <div style={{ color: 'var(--t3)', fontSize: 11, marginTop: 3 }}>
                              Created {formatCreatedAt(managedUser.createdAt)}
                            </div>
                          </div>
                          <span
                            className="tag"
                            style={{
                              background: managedUser.active ? 'rgba(0,220,114,0.1)' : 'rgba(239,68,68,0.1)',
                              color: managedUser.active ? 'var(--g)' : 'var(--re)',
                            }}
                          >
                            {managedUser.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <button
                          className={`btn ${managedUser.active ? 'bs' : 'bp'}`}
                          onClick={() => handleToggleManagedUser(managedUser.userId, managedUser.active)}
                        >
                          {managedUser.active ? 'Deactivate User' : 'Activate User'}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
