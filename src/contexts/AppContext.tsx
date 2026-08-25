import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { db } from '../lib/db';
import { doSync, pullFromCloud, setSyncCallback, triggerSync, fullSync } from '../lib/sync';
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
  unlockAndSync: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshAll: () => void;
  completeSetup: (profile: Profile) => void;
  forceSync: () => Promise<void>;
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
      setLocked(false);
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

  /** Called after successful PIN unlock — pull cloud data then refresh UI */
  const unlockAndSync = useCallback(async () => {
    setLocked(false);
    if (navigator.onLine) {
      try {
        await fullSync();
        await refreshProfile();
        setRefreshKey(k => k + 1);
      } catch (e) {
        console.error('[app] unlock sync failed:', e);
      }
    }
  }, [refreshProfile]);

  const forceSync = useCallback(async () => {
    if (!navigator.onLine) return;
    await fullSync();
    await refreshProfile();
    setRefreshKey(k => k + 1);
  }, [refreshProfile]);

  useEffect(() => {
    setSyncCallback(setSyncStatus);

    (async () => {
      // Load local profile first so lock screen can show quickly
      await refreshProfile();
      hasInitialized.current = true;
      setLoading(false);

      // Then pull from cloud in background (even while locked)
      if (navigator.onLine) {
        try {
          await pullFromCloud();
          await refreshProfile();
          setRefreshKey(k => k + 1);
          triggerSync();
        } catch (e) {
          console.error('[app] initial pull failed:', e);
        }
      }
    })();

    const onOnline = () => {
      setOnline(true);
      fullSync().then(() => {
        refreshProfile();
        setRefreshKey(k => k + 1);
      });
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Re-sync when tab becomes visible (user returns to app)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        fullSync().then(() => {
          refreshProfile();
          setRefreshKey(k => k + 1);
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshProfile]);

  return (
    <AppContext.Provider value={{
      profile, loading, locked, needsSetup, online, syncStatus,
      activePage, refreshKey, setActivePage, setLocked, unlockAndSync,
      refreshProfile, refreshAll, completeSetup, forceSync,
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
