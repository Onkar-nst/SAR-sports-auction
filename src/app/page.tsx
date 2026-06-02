'use client';
import { useState, useEffect } from 'react';
import Landing from '@/components/Landing';
import CreateRoom from '@/components/CreateRoom';
import AuctionRoom from '@/components/AuctionRoom';
import { STORAGE_KEYS } from '@/lib/auth';
import type { AuthSession } from '@/lib/auth';
import { syncUserToOfflineStore, offlineLogin, offlineSignup } from '@/lib/client-auth';

type View = 'landing' | 'create' | 'auction';

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [guestUserId, setGuestUserId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [teamId, setTeamId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [managedUsers, setManagedUsers] = useState<any[]>([]);

  const fetchManagedUsers = async () => {
    try {
      const res = await fetch('/api/auth/users');
      const data = await res.json();
      if (data.users) setManagedUsers(data.users);
    } catch (err) {
      console.error('Failed to fetch managed users:', err);
    }
  };

  useEffect(() => {
    if (authSession?.isAdmin) {
      fetchManagedUsers();
    } else {
      setManagedUsers([]);
    }
  }, [authSession]);

  useEffect(() => {
    // Guest User ID hydration
    let nextGuestUserId = localStorage.getItem(STORAGE_KEYS.guestUserId);
    if (!nextGuestUserId) {
      nextGuestUserId = `usr_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem(STORAGE_KEYS.guestUserId, nextGuestUserId);
    }
    setGuestUserId(nextGuestUserId);

    // Custom Auth Hydration
    const savedSession = localStorage.getItem('sar_auth_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setAuthSession({
          userId: parsed.userId,
          userName: parsed.userName || parsed.name || parsed.userId,
          isAdmin: parsed.isAdmin ?? (parsed.userId === 'admin' || parsed.userId === 'admin@sportsauction.com'),
          loggedInAt: parsed.loggedInAt ?? Date.now()
        });
      } catch (e) {
        console.warn('Failed to parse saved auth session:', e);
      }
    }

    // Restore room state
    const savedRoomId = sessionStorage.getItem('sar_room_id');
    const savedTeamId = sessionStorage.getItem('sar_team_id');
    const savedName = sessionStorage.getItem('sar_user_name');
    if (savedRoomId && savedTeamId) {
      setRoomId(savedRoomId);
      setTeamId(savedTeamId);
      if (savedName) setUserName(savedName);
      setView('auction');
    }
  }, []);

  const activeUserId = authSession?.userId || guestUserId;

  const handleJoinRoom = (rid: string, tid: string, name: string) => {
    setRoomId(rid);
    setTeamId(tid);
    setUserName(name);
    sessionStorage.setItem('sar_room_id', rid);
    sessionStorage.setItem('sar_team_id', tid);
    sessionStorage.setItem('sar_user_name', name);
    setView('auction');
  };

  const handleLeaveRoom = () => {
    sessionStorage.removeItem('sar_room_id');
    sessionStorage.removeItem('sar_team_id');
    setRoomId('');
    setTeamId('');
    setView('landing');
  };

  const handleLogin = async (loginUserId: string, password: string) => {
    // Try server API first
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loginUserId, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Login failed');
      }

      // Sync to offline store for future offline logins
      await syncUserToOfflineStore(loginUserId, password, data.user);

      const isAdmin = loginUserId.toLowerCase().trim() === 'admin' || loginUserId.toLowerCase().trim() === 'admin@sportsauction.com';
      const session = {
        userId: data.user.id,
        userName: data.user.name || loginUserId,
        isAdmin,
        loggedInAt: Date.now(),
      };
      localStorage.setItem('sar_auth_session', JSON.stringify(session));
      setAuthSession({
        userId: session.userId,
        userName: session.userName,
        isAdmin: session.isAdmin,
        loggedInAt: session.loggedInAt,
      });
      return;
    } catch (err: any) {
      // If it's a network error, fall back to offline auth
      const isNetworkError = err instanceof TypeError || err.message === 'Failed to fetch' || err.status === 0 || String(err).includes('fetch');
      if (isNetworkError) {
        console.warn('Server unreachable, attempting offline login...');
        try {
          const user = await offlineLogin(loginUserId, password);
          const isAdmin = loginUserId.toLowerCase().trim() === 'admin' || loginUserId.toLowerCase().trim() === 'admin@sportsauction.com';
          const session = {
            userId: user.id,
            userName: user.name || loginUserId,
            isAdmin,
            loggedInAt: Date.now(),
          };
          localStorage.setItem('sar_auth_session', JSON.stringify(session));
          setAuthSession({
            userId: session.userId,
            userName: session.userName,
            isAdmin: session.isAdmin,
            loggedInAt: session.loggedInAt,
          });
          return;
        } catch (offlineErr: any) {
          throw new Error(offlineErr.message || 'Login failed (offline)');
        }
      }
      throw err;
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('sar_auth_session');
    setAuthSession(null);
    if (view === 'create') {
      setView('landing');
    }
  };

  const handleCreateUser = async (newUserId: string, password: string) => {
    // Try server API first
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newUserId, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Signup failed');
      }

      // Sync to offline store
      await syncUserToOfflineStore(newUserId, password, data.user);

      // Refresh managed users list
      await fetchManagedUsers();

      // DO NOT overwrite active session since admin is creating user for someone else
      return;
    } catch (err: any) {
      // If it's a network error, fall back to offline signup
      const isNetworkError = err instanceof TypeError || err.message === 'Failed to fetch' || err.status === 0 || String(err).includes('fetch');
      if (isNetworkError) {
        console.warn('Server unreachable, attempting offline signup...');
        try {
          await offlineSignup(newUserId, password);
          // Refresh managed users locally
          const localUsers = localStorage.getItem('sar_offline_users');
          if (localUsers) {
            const parsed = JSON.parse(localUsers);
            const formatted = Object.values(parsed)
              .filter((u: any) => u.name !== 'admin' && u.email !== 'admin@sportsauction.com')
              .map((u: any) => ({
                userId: u.name || u.email,
                active: u.active !== false,
                createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now()
              }));
            setManagedUsers(formatted);
          }
          // Simply return without overwriting session
          return;
        } catch (offlineErr: any) {
          throw new Error(offlineErr.message || 'Signup failed (offline)');
        }
      }
      throw err;
    }
  };

  const handleToggleUser = async (managedUserId: string) => {
    const userObj = managedUsers.find(u => u.userId === managedUserId);
    const nextActive = userObj ? !userObj.active : false;
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: managedUserId, active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to toggle user status');
      }
      await fetchManagedUsers();
    } catch (err: any) {
      // Offline fallback for toggle user status
      const isNetworkError = err instanceof TypeError || err.message === 'Failed to fetch' || err.status === 0 || String(err).includes('fetch');
      if (isNetworkError) {
        console.warn('Server unreachable, toggling user status locally...');
        const localUsersStr = localStorage.getItem('sar_offline_users');
        if (localUsersStr) {
          try {
            const localUsers = JSON.parse(localUsersStr);
            const emailKey = managedUserId.includes('@') ? managedUserId.toLowerCase().trim() : `${managedUserId.toLowerCase().trim()}@sportsauction.com`;
            if (localUsers[emailKey]) {
              localUsers[emailKey].active = nextActive;
              localStorage.setItem('sar_offline_users', JSON.stringify(localUsers));
              
              const formatted = Object.values(localUsers)
                .filter((u: any) => u.name !== 'admin' && u.email !== 'admin@sportsauction.com')
                .map((u: any) => ({
                  userId: u.name || u.email,
                  active: u.active !== false,
                  createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now()
                }));
              setManagedUsers(formatted);
              return;
            }
          } catch (e) {
            console.error('Failed to toggle active state offline:', e);
          }
        }
      }
      throw err;
    }
  };

  if (view === 'landing') {
    return (
      <Landing
        userId={activeUserId}
        authSession={authSession}
        managedUsers={managedUsers}
        onStart={() => setView('create')}
        onJoin={handleJoinRoom}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onCreateUser={handleCreateUser}
        onToggleUser={handleToggleUser}
      />
    );
  }
  if (view === 'create') {
    return (
      <CreateRoom
        userId={activeUserId}
        userName={authSession?.userName || activeUserId}
        onLaunch={(rid, tid, name) => handleJoinRoom(rid, tid, name)}
        onBack={() => setView('landing')}
      />
    );
  }
  if (view === 'auction' && roomId) {
    return (
      <AuctionRoom
        roomId={roomId}
        userId={activeUserId}
        teamId={teamId}
        userName={userName}
        onLeave={handleLeaveRoom}
      />
    );
  }
  return null;
}
