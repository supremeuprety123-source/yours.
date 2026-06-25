import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { db } from '../lib/db';
import { doSync, pullFromCloud, setSyncCallback, triggerSync } from '../lib/sync';
import type { Profile } from '../lib/types';

export type PageName = 'home' | 'study' | 'planner' | 'finance' | 'diary' | 'settings';

interface AppContextType {
  profile: Profile | null;
  loading: boolean;
  locked: boolean;
  needsSetup: boolean;
  online: boolean;
  syncStatus: string;
  activePage: PageName;
  refreshKey: number;
  setActivePage: (p: PageName) => void;
  setLocked: (v: boolean) => void;
  refreshProfile: () => Promise<void>;
  refreshAll: () => void;
  completeSetup: (profile: Profile) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [activePage, setActivePage] = useState<PageName>('home');
  const [refreshKey, setRefreshKey] = useState(0);
  const hasInitialized = useRef(false);

  const refreshProfile = useCallback(async () => {
    const profiles = await db.profile.toArray();
    if (profiles.length > 0) {
      setProfile(profiles[0]);
      setNeedsSetup(false);
      // Only set locked on the very first load — never re-lock after unlock
      if (!hasInitialized.current) {
        setLocked(profiles[0].pin_enabled);
      }
    } else {
      setNeedsSetup(true);
    }
  }, []);

  const refreshAll = useCallback(() => {
    setRefreshKey(k => k + 1);
    refreshProfile();
  }, [refreshProfile]);

  const completeSetup = useCallback((p: Profile) => {
    setProfile(p);
    setNeedsSetup(false);
    setLocked(p.pin_enabled);
  }, []);

  useEffect(() => {
    setSyncCallback(setSyncStatus);
    refreshProfile().finally(() => {
      hasInitialized.current = true;
      setLoading(false);
    });

    const onOnline = () => {
      setOnline(true);
      pullFromCloud().then(() => doSync());
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshProfile]);

  useEffect(() => {
    if (navigator.onLine && !needsSetup) {
      pullFromCloud().then(() => {
        refreshProfile();
        triggerSync();
      });
    }
  }, []);

  return (
    <AppContext.Provider value={{
      profile, loading, locked, needsSetup, online, syncStatus,
      activePage, refreshKey, setActivePage, setLocked, refreshProfile, refreshAll, completeSetup,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
