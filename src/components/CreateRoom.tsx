'use client';
/* eslint-disable react-hooks/purity */
import { useRef, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Player, RoomConfig } from '@/lib/types';
import {
  buildDefaultTeams,
  getPlayersForSport,
} from '@/lib/data';
import Avatar from '@/components/ui/Avatar';
import { RBadge, TBadge } from '@/components/ui/Badges';
import Spinner from '@/components/ui/Spinner';

interface CreateRoomProps {
  userId: string;
  userName?: string;
  onLaunch: (roomId: string, teamId: string, userName: string) => void;
  onBack: () => void;
}

const SPORT_OPTIONS = [
  'Cricket / IPL',
  'Football / UEFA',
  'Football / FIFA',
  'Basketball / NBA',
  'Custom',
];

function getDefaultTournament(sport: string) {
  if (sport.includes('IPL')) return 'IPL 2025';
  if (sport.includes('UEFA')) return 'UEFA Champions League';
  if (sport.includes('FIFA')) return 'FIFA World Cup';
  if (sport.includes('NBA')) return 'NBA Season';
  return 'Custom Tournament';
}

function getRoleOptions(sport: string) {
  if (sport.includes('Football')) {
    return ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'];
  }
  if (sport.includes('Basketball')) {
    return ['Guard', 'Forward', 'Center'];
  }
  return ['Batter', 'Bowler', 'All-rounder', 'WK-Batter'];
}

function makeInitials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0] || '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function Lbl({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--t3)',
        letterSpacing: 1,
        textTransform: 'uppercase',
        display: 'block',
        marginBottom: 4,
      }}
    >
      {children}
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Lbl>{label}</Lbl>
      {children}
    </div>
  );
}

export default function CreateRoom({ userId, userName, onLaunch, onBack }: CreateRoomProps) {
  const [step, setStep] = useState(1);
  const [roomId] = useState(() => `AUC-${Math.floor(1000 + Math.random() * 9000)}`);
  // Use state for 'now' so it's only set client-side, preventing SSR hydration mismatch
  const [clientNow, setClientNow] = useState<number | null>(null);
  useEffect(() => { setClientNow(Date.now()); }, []);
  const [cfg, setCfg] = useState<RoomConfig & { enableBots: boolean }>({
    name: 'IPL Fantasy 2025',
    sport: 'Cricket / IPL',
    tournament: 'IPL 2025',
    participants: 4,
    budget: 1500,
    squadSize: 11,
    enableBots: true,
  });
  const [players, setPlayers] = useState<Player[]>(() => getPlayersForSport('Cricket / IPL'));
  const [hostTeamName, setHostTeamName] = useState('Your Team');
  const [hostTeamPhoto, setHostTeamPhoto] = useState<string | null>(null);

  const [sq, setSq] = useState('');
  const [sLoad, setSLoad] = useState(false);
  const [sErr, setSErr] = useState('');
  const [sRes, setSRes] = useState<Player[]>([]);
  const [fLoad, setFLoad] = useState(false);
  const [fMsg, setFMsg] = useState('');
  const [launching, setLaunching] = useState(false);
  const [launchErr, setLaunchErr] = useState('');
  const [launchMode, setLaunchMode] = useState<'now' | 'schedule'>('now');

  const getDefaultSchedule = () => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    date.setMinutes(date.getMinutes() >= 30 ? 0 : 30, 0, 0);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().slice(0, 5);
    return { date: dateStr, time: timeStr };
  };

  const defaults = getDefaultSchedule();
  const [scheduledDate, setScheduledDate] = useState(defaults.date);
  const [scheduledTime, setScheduledTime] = useState(defaults.time);

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualP, setManualP] = useState({
    name: '',
    role: getRoleOptions('Cricket / IPL')[0],
    country: 'India',
    base: 50,
  });

  const xlRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const hostPhotoRef = useRef<HTMLInputElement>(null);

  const roleOptions = getRoleOptions(cfg.sport);

  function handleSportChange(sport: string) {
    setCfg((prev) => ({
      ...prev,
      sport,
      tournament: getDefaultTournament(sport),
    }));
    setPlayers(getPlayersForSport(sport));
    setSRes([]);
    setSErr('');
    setShowManualForm(false);
    setManualP({
      name: '',
      role: getRoleOptions(sport)[0],
      country: sport.includes('Football') ? 'England' : sport.includes('Basketball') ? 'USA' : 'India',
      base: 50,
    });
  }

  async function doSearch() {
    if (!sq.trim()) return;
    setSLoad(true);
    setSErr('');
    setSRes([]);
    try {
      const res = await fetch('/api/search-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sq }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSRes(data.players || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Search failed';
      setSErr(
        msg.includes('API_KEY')
          ? 'Add GROQ_API_KEY to .env.local to enable AI search.'
          : `Search failed: ${msg}`
      );
    }
    setSLoad(false);
  }

  function addResult(player: Player) {
    setPlayers((prev) => [...prev, { ...player, id: Date.now() + Math.random() }]);
    setSRes((results) => results.filter((item) => item.name !== player.name));
  }

  function saveManualPlayer() {
    if (!manualP.name.trim()) return;
    setPlayers((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: manualP.name.trim(),
        role: manualP.role,
        country: manualP.country,
        nat: '🌍',
        tier: 'Gold',
        base: manualP.base,
        img: makeInitials(manualP.name),
      },
    ]);
    setShowManualForm(false);
    setManualP({
      name: '',
      role: roleOptions[0],
      country: manualP.country,
      base: 50,
    });
  }

  async function onExcel(file: File) {
    setFLoad(true);
    setFMsg('⏳ Reading Excel…');
    try {
      const xlsxModule = (await import('xlsx')) as any;
      const XLSX = xlsxModule.default && xlsxModule.default.read ? xlsxModule.default : xlsxModule;
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
      const parsedPlayers: Player[] = rows
        .map((row, index) => ({
          id: Date.now() + index,
          name: String(row.Name || row.name || row.Player || row.player || ''),
          role: String(row.Role || row.role || row.Position || roleOptions[0]),
          country: String(row.Country || row.country || ''),
          nat: String(row.nat || row.Emoji || row.Flag || '🌍'),
          tier: String(row.Tier || row.tier || 'Gold'),
          base: parseInt(String(row.Base || row.base || row['Base Price'] || row.Price || 50), 10) || 50,
          img: makeInitials(String(row.Name || row.name || 'XX')),
        }))
        .filter((player) => player.name);

      setPlayers((prev) => [...prev, ...parsedPlayers]);
      setFMsg(`✅ Added ${parsedPlayers.length} players from Excel`);
    } catch (e: unknown) {
      setFMsg(`❌ ${e instanceof Error ? e.message : 'Error reading file'}`);
    }
    setFLoad(false);
    if (xlRef.current) xlRef.current.value = '';
  }

  async function onPDF(file: File) {
    setFLoad(true);
    setFMsg('⏳ AI reading PDF…');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64 }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setPlayers((prev) => [...prev, ...data.players]);
      setFMsg(`✅ Added ${data.players.length} players from PDF`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      setFMsg(
        msg.includes('API_KEY')
          ? '⚠️ Add ANTHROPIC_API_KEY to .env.local to enable PDF parsing.'
          : `❌ ${msg}`
      );
    }
    setFLoad(false);
    if (pdfRef.current) pdfRef.current.value = '';
  }

  const stepList = [
    { n: 1, l: 'Setup' },
    { n: 2, l: 'Players' },
    { n: 3, l: 'Launch' },
  ];

  const displayUserName = userName || userId;
  const isAdminUser = displayUserName.toLowerCase().trim() === 'admin' || displayUserName.toLowerCase().trim() === 'admin@sportsauction.com' || userId.toLowerCase().trim() === 'admin' || userId.toLowerCase().trim() === 'admin@sportsauction.com';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '13px 36px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: 'var(--g)', letterSpacing: 2 }}>SAR</span>
          <span style={{ color: 'var(--t3)' }}>/</span>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: 'var(--t2)' }}>Create Auction Room</span>
        </div>

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
            cursor: 'default'
          }}
        >
          <div style={{
            position: 'relative',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: isAdminUser ? 'linear-gradient(135deg, var(--am) 0%, #d97706 100%)' : 'linear-gradient(135deg, var(--g) 0%, #00a854 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 700,
            color: '#000',
            textTransform: 'uppercase',
            boxShadow: isAdminUser ? '0 0 10px rgba(245,158,11,0.3)' : '0 0 10px rgba(0,220,114,0.3)'
          }}>
            {displayUserName.charAt(0)}
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
              {displayUserName}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', fontFamily: "'Rajdhani', sans-serif" }}>
              {isAdminUser ? '🛡️ Admin' : '👤 Participant'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '32px 18px' }}>
        <div style={{ width: '100%', maxWidth: 720 }}>
          <div style={{ display: 'flex', gap: 3, marginBottom: 28, background: 'var(--bg2)', borderRadius: 9, padding: 3, border: '1px solid var(--bd)' }}>
            {stepList.map((item) => (
              <button
                key={item.n}
                onClick={() => {
                  if (item.n < step) setStep(item.n);
                }}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 7,
                  border: 'none',
                  cursor: item.n <= step ? 'pointer' : 'default',
                  background: step === item.n ? 'var(--g)' : 'transparent',
                  color: step === item.n ? '#000' : step > item.n ? 'var(--t2)' : 'var(--t3)',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  transition: 'all .2s',
                }}
              >
                {item.n}. {item.l}
              </button>
            ))}
          </div>

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp .4s ease' }}>
              <div className="card" style={{ padding: 22 }}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: 2, marginBottom: 20 }}>ROOM SETUP</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label="Room Name">
                    <input className="inp" value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} />
                  </Field>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Sport">
                      <select className="inp" value={cfg.sport} onChange={(e) => handleSportChange(e.target.value)}>
                        {SPORT_OPTIONS.map((sport) => (
                          <option key={sport}>{sport}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tournament">
                      <input className="inp" value={cfg.tournament} onChange={(e) => setCfg({ ...cfg, tournament: e.target.value })} />
                    </Field>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <Field label="Participants">
                      <input className="inp" type="number" min={2} max={12} value={cfg.participants} onChange={(e) => setCfg({ ...cfg, participants: parseInt(e.target.value, 10) || 2 })} />
                    </Field>
                    <Field label="Budget (₹L)">
                      <input className="inp" type="number" value={cfg.budget} onChange={(e) => setCfg({ ...cfg, budget: parseInt(e.target.value, 10) || 500 })} />
                    </Field>
                    <Field label="Squad Size">
                      <input className="inp" type="number" value={cfg.squadSize} onChange={(e) => setCfg({ ...cfg, squadSize: parseInt(e.target.value, 10) || 11 })} />
                    </Field>
                  </div>

                  <Field label="CPU Bots Bidding">
                    <select className="inp" value={cfg.enableBots ? 'Enabled' : 'Disabled'} onChange={(e) => setCfg({ ...cfg, enableBots: e.target.value === 'Enabled' })}>
                      <option value="Enabled">Enabled (Bots bid automatically)</option>
                      <option value="Disabled">Disabled (Only real players bid)</option>
                    </select>
                  </Field>

                  <div className="card" style={{ padding: 18, border: '1px solid rgba(0,220,114,0.14)', background: 'rgba(0,220,114,0.04)' }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1.5, marginBottom: 12 }}>HOST TEAM</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'center' }}>
                      <div style={{ cursor: 'pointer' }} onClick={() => hostPhotoRef.current?.click()}>
                        <Avatar name={hostTeamName || 'Your Team'} size={72} color="#00DC72" photo={hostTeamPhoto} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Field label="Your Team Name">
                          <input className="inp" value={hostTeamName} onChange={(e) => setHostTeamName(e.target.value)} placeholder="Enter your team name" />
                        </Field>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn bs bsm" type="button" onClick={() => hostPhotoRef.current?.click()}>Upload Logo</button>
                          {hostTeamPhoto && (
                            <button className="btn bs bsm" type="button" onClick={() => setHostTeamPhoto(null)}>Remove Logo</button>
                          )}
                        </div>
                        <input
                          ref={hostPhotoRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setHostTeamPhoto((event.target?.result as string) || null);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--bd2)', fontSize: 14, color: 'var(--t2)', lineHeight: 1.5 }}>
                    ⏱️ Timer fixed at <b style={{ color: 'var(--g)' }}>60 seconds</b> per player.<br />
                    Every bid extends the clock by <b style={{ color: 'var(--am)' }}>20 seconds</b> (max 60s).
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn bs" onClick={onBack} style={{ flex: 1 }}>← Back to Home</button>
                <button className="btn bp" onClick={() => setStep(2)} style={{ flex: 2, fontSize: 15, padding: 13 }}>Next: Player Pool →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp .4s ease' }}>
              <div className="card" style={{ padding: 18 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, marginBottom: 12 }}>🔍 FETCH FROM WEB / AI</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input className="inp" value={sq} onChange={(e) => setSq(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }} placeholder="Player name or https://en.wikipedia.org/wiki/..." />
                  <button className="btn bp bsm" onClick={doSearch} disabled={sLoad} style={{ flexShrink: 0 }}>
                    {sLoad ? <Spinner /> : 'Search'}
                  </button>
                </div>
                <button className="btn bs bsm" onClick={() => setShowManualForm(true)} style={{ marginBottom: sErr || sRes.length > 0 || showManualForm ? 10 : 0 }}>＋ Add Player Manually</button>

                {showManualForm && (
                  <div className="card hover-lift" style={{ marginBottom: 12, padding: 16, background: 'rgba(0,220,114,0.05)', border: '1px solid var(--g)' }}>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--g)' }}>ADD MANUAL PLAYER</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input className="inp" placeholder="Player Name" value={manualP.name} onChange={(e) => setManualP({ ...manualP, name: e.target.value })} />
                      <select className="inp" value={manualP.role} onChange={(e) => setManualP({ ...manualP, role: e.target.value })}>
                        {roleOptions.map((role) => (
                          <option key={role}>{role}</option>
                        ))}
                      </select>
                      <input className="inp" placeholder="Country" value={manualP.country} onChange={(e) => setManualP({ ...manualP, country: e.target.value })} />
                      <input className="inp" type="number" placeholder="Base Price (Lakhs)" value={manualP.base} onChange={(e) => setManualP({ ...manualP, base: parseInt(e.target.value, 10) || 50 })} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="btn bp" onClick={saveManualPlayer}>Save Player</button>
                      <button className="btn bs" onClick={() => setShowManualForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {sErr && <div style={{ fontSize: 12, padding: '7px 10px', borderRadius: 6, marginBottom: 8, background: 'rgba(239,68,68,.08)', color: 'var(--re)', lineHeight: 1.4 }}>{sErr}</div>}
                {sRes.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sRes.map((player, index) => (
                      <div key={`${player.name}-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--bd2)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--t1)', marginBottom: 5 }}>{player.nat || '🌍'} {player.name}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            <RBadge role={player.role || roleOptions[0]} />
                            <TBadge tier={player.tier || 'Gold'} />
                            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: 'var(--g)', marginLeft: 2 }}>₹{player.base || 50}L</span>
                          </div>
                          {player.bio && <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.4 }}>{player.bio}</div>}
                        </div>
                        <button className="btn bp bsm" onClick={() => addResult(player)}>+ Add</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 18 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, marginBottom: 12 }}>📁 UPLOAD FILE</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <button className="btn bs" onClick={() => xlRef.current?.click()} disabled={fLoad} style={{ flex: 1 }}>📊 Upload Excel (.xlsx / .csv)</button>
                  <button className="btn bs" onClick={() => pdfRef.current?.click()} disabled={fLoad} style={{ flex: 1 }}>
                    {fLoad ? <Spinner /> : '📄 Upload PDF (AI)'}
                  </button>
                </div>
                <input ref={xlRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) onExcel(e.target.files[0]); }} />
                <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) onPDF(e.target.files[0]); }} />
                {fMsg && (
                  <div style={{ fontSize: 13, padding: '7px 10px', borderRadius: 6, marginTop: 4, lineHeight: 1.4, color: fMsg.startsWith('✅') ? 'var(--g)' : fMsg.startsWith('⏳') ? 'var(--am)' : fMsg.startsWith('⚠️') ? 'var(--am)' : 'var(--re)', background: fMsg.startsWith('✅') ? 'rgba(0,220,114,.08)' : 'rgba(245,158,11,.06)' }}>
                    {fMsg}
                  </div>
                )}
                <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>Excel columns: Name, Role, Country, Base (price in ₹L). PDF is parsed by AI (requires ANTHROPIC_API_KEY in .env.local).</p>
              </div>

              <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2 }}>
                    PLAYER POOL
                  </div>
                  <span style={{ color: 'var(--g)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: 14 }}>
                    {cfg.sport} · {players.length} players
                  </span>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {players.map((player, index) => (
                    <div key={String(player.id) + index} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', background: 'var(--bg3)', borderRadius: 7, border: '1px solid var(--bd)' }}>
                      <span style={{ fontSize: 14 }}>{player.nat || '🌍'}</span>
                      <span style={{ flex: 1, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
                      <RBadge role={player.role} />
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: 'var(--g)', letterSpacing: 0.5, margin: '0 4px' }}>₹{player.base}L</span>
                      <button onClick={() => setPlayers((prev) => prev.filter((_, playerIndex) => playerIndex !== index))} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 13, padding: '0 3px', lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn bs" onClick={() => setStep(1)} style={{ flex: 1 }}>← Back</button>
                <button className="btn bp" onClick={() => setStep(3)} style={{ flex: 2, fontSize: 15 }}>Next: Launch →</button>
              </div>
            </div>
          )}

          {step === 3 && (() => {
            const getScheduleTs = () => new Date(`${scheduledDate}T${scheduledTime}`).getTime();
            const isScheduleValid = launchMode === 'now' || (clientNow !== null && getScheduleTs() > clientNow + 60000);
            const scheduleLabel = launchMode === 'schedule'
              ? new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
              : '';

            const presets = (() => {
              const today = new Date();
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const formatDate = (date: Date) => date.toISOString().split('T')[0];
              return [
                { label: '☀️ Today 7 AM', date: formatDate(today), time: '07:00' },
                { label: '🌙 Today 8 PM', date: formatDate(today), time: '20:00' },
                { label: '🌅 Tomorrow 10 AM', date: formatDate(tomorrow), time: '10:00' },
              ].filter((preset) => new Date(`${preset.date}T${preset.time}`).getTime() > Date.now() + 60000);
            })();

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp .4s ease' }}>
                <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 68, color: 'var(--g)', letterSpacing: 4, marginBottom: 10 }}>READY!</div>
                  <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 18, marginBottom: 18, border: '1px solid var(--bd2)' }}>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 11, color: 'var(--t3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Invite Code</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, letterSpacing: 4, color: 'var(--g)' }}>{roomId}</div>
                    <div style={{ color: 'var(--t3)', fontSize: 12, marginTop: 5 }}>Share this code with your friends to join</div>
                  </div>

                  {launchErr && (
                    <div style={{ fontSize: 13, padding: '9px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: 'var(--re)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14 }}>
                      ⚠️ {launchErr}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, textAlign: 'left' }}>
                    {[
                      ['🏏', cfg.sport],
                      ['💰', `₹${cfg.budget}L per team`],
                      ['📋', `${players.length} players`],
                      ['⏱️', '60s timer · +20s per bid'],
                    ].map(([icon, value]) => (
                      <div key={value} style={{ background: 'var(--bg3)', padding: '10px 13px', borderRadius: 8, border: '1px solid var(--bd)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: 'var(--t1)', fontSize: 13 }}>
                        {icon} {value}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', gap: 3, background: 'var(--bg2)', borderRadius: 9, padding: 3, border: '1px solid var(--bd)', marginBottom: 14 }}>
                      <button
                        onClick={() => setLaunchMode('now')}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 7,
                          border: 'none',
                          cursor: 'pointer',
                          background: launchMode === 'now' ? 'var(--g)' : 'transparent',
                          color: launchMode === 'now' ? '#000' : 'var(--t3)',
                          fontFamily: "'Rajdhani', sans-serif",
                          fontWeight: 700,
                          fontSize: 14,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          transition: 'all .25s',
                        }}
                      >
                        🚀 Launch Now
                      </button>
                      <button
                        onClick={() => setLaunchMode('schedule')}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 7,
                          border: 'none',
                          cursor: 'pointer',
                          background: launchMode === 'schedule' ? 'var(--am)' : 'transparent',
                          color: launchMode === 'schedule' ? '#000' : 'var(--t3)',
                          fontFamily: "'Rajdhani', sans-serif",
                          fontWeight: 700,
                          fontSize: 14,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          transition: 'all .25s',
                        }}
                      >
                        🕐 Schedule
                      </button>
                    </div>

                    {launchMode === 'schedule' && (
                      <div style={{ animation: 'fadeUp .3s ease', textAlign: 'left' }}>
                        <div className="card" style={{ padding: 18, border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.04)' }}>
                          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--am)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
                            📅 Schedule Auction Start
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                            <div>
                              <Lbl>Date</Lbl>
                              <input type="date" className="inp" value={scheduledDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setScheduledDate(e.target.value)} style={{ colorScheme: 'dark' }} />
                            </div>
                            <div>
                              <Lbl>Time</Lbl>
                              <input type="time" className="inp" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} style={{ colorScheme: 'dark' }} />
                            </div>
                          </div>

                          {presets.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <Lbl>Quick Select</Lbl>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {presets.map((preset) => (
                                  <button
                                    key={preset.label}
                                    className="btn bs bsm"
                                    onClick={() => {
                                      setScheduledDate(preset.date);
                                      setScheduledTime(preset.time);
                                    }}
                                    style={{
                                      background: scheduledDate === preset.date && scheduledTime === preset.time ? 'rgba(245,158,11,0.15)' : undefined,
                                      borderColor: scheduledDate === preset.date && scheduledTime === preset.time ? 'var(--am)' : undefined,
                                      color: scheduledDate === preset.date && scheduledTime === preset.time ? 'var(--am)' : undefined,
                                    }}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--bd)', textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
                              Auction will auto-start at
                            </div>
                            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: isScheduleValid ? 'var(--am)' : 'var(--re)' }}>
                              {isScheduleValid ? scheduleLabel : '⚠️ Select a future time'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    className="btn bp"
                    disabled={launching || !hostTeamName.trim() || (launchMode === 'schedule' && !isScheduleValid)}
                    style={{
                      width: '100%',
                      fontSize: 18,
                      padding: 15,
                      letterSpacing: 2,
                      animation: launchMode === 'schedule' && !isScheduleValid ? 'none' : 'glow 2s infinite',
                      background: launchMode === 'schedule' ? 'var(--am)' : undefined,
                      boxShadow: launchMode === 'schedule' ? '0 4px 14px 0 rgba(245,158,11,0.15)' : undefined,
                    }}
                    onClick={async () => {
                      setLaunching(true);
                      setLaunchErr('');
                      try {
                        const scheduledAt = launchMode === 'schedule' ? getScheduleTs() : null;
                        const teams = buildDefaultTeams(
                          cfg.participants,
                          hostTeamName.trim() || 'Host Team',
                          hostTeamPhoto
                        );

                        const res = await fetch('/api/rooms', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            roomId,
                            name: cfg.name,
                            sport: cfg.sport,
                            tournament: cfg.tournament,
                            participants: cfg.participants,
                            budget: cfg.budget,
                            squadSize: cfg.squadSize,
                            enableBots: cfg.enableBots,
                            teams,
                            players,
                            hostId: userId,
                            scheduledAt,
                          }),
                        });
                        const data = await res.json();
                        if (data.error) throw new Error(data.error);
                        onLaunch(data.room.id, 'you', hostTeamName.trim() || 'Host Team');
                      } catch (e: unknown) {
                        setLaunchErr(e instanceof Error ? e.message : 'Failed to launch room');
                      } finally {
                        setLaunching(false);
                      }
                    }}
                  >
                    {launching ? 'CREATING ROOM...' : launchMode === 'schedule' ? '🕐 SCHEDULE AUCTION' : '🚀 LAUNCH AUCTION'}
                  </button>
                </div>

                <button className="btn bs" onClick={() => setStep(2)} style={{ width: '100%' }}>← Back</button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
